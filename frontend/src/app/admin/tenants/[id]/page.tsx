"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useTenantContextStore } from "@/stores/tenant-context-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ArrowLeft,
  Users,
  Bot,
  Phone,
  UserCheck,
  Settings,
  Eye,
  Megaphone,
  Power,
  PowerOff,
  Save,
  Edit3,
} from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDetail = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CallRow = Record<string, any>;

const roleColors: Record<string, string> = {
  admin: "bg-amber-500/20 text-amber-300",
  manager: "bg-indigo-500/20 text-indigo-300",
  agent: "bg-blue-500/20 text-blue-300",
  viewer: "bg-gray-500/20 text-gray-300",
};

const tierColors: Record<string, string> = {
  enterprise: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  pro: "border-indigo-500/40 text-indigo-300 bg-indigo-500/10",
  starter: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  trial: "border-blue-500/40 text-blue-300 bg-blue-500/10",
};

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setActiveTenant } = useTenantContextStore();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTier, setEditTier] = useState("");

  const { data: tenant } = useQuery<TenantDetail>({
    queryKey: ["admin", "tenant", id],
    queryFn: () => api.get<TenantDetail>(`/admin/tenants/${id}`),
    staleTime: 30_000,
  });

  const { data: usersResp } = useQuery<{ items: UserRow[] }>({
    queryKey: ["admin", "tenant", id, "users"],
    queryFn: () => api.get<{ items: UserRow[] }>(`/admin/tenants/${id}/users`),
    staleTime: 60_000,
  });

  const { data: agentsResp } = useQuery<{ items: AgentRow[] }>({
    queryKey: ["admin", "tenant", id, "agents"],
    queryFn: () => api.get<{ items: AgentRow[] }>(`/admin/tenants/${id}/agents`),
    staleTime: 60_000,
  });

  const { data: callsResp } = useQuery<{ items: CallRow[] }>({
    queryKey: ["admin", "tenant", id, "calls"],
    queryFn: () => api.get<{ items: CallRow[] }>(`/admin/tenants/${id}/calls`),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/admin/tenants/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      setEditOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (is_active: boolean) =>
      api.patch(`/admin/tenants/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });

  const t = tenant ?? { id: "", name: "Loading...", slug: "", subscription_tier: "starter", is_active: true, settings: {}, created_at: "", updated_at: "" };
  const users = usersResp?.items ?? [];
  const agents = agentsResp?.items ?? [];
  const calls = callsResp?.items ?? [];

  const handleImpersonate = () => {
    setActiveTenant(t.id, t.name);
    router.push("/");
  };

  const openEdit = () => {
    setEditName(t.name);
    setEditTier(t.subscription_tier);
    setEditOpen(true);
  };

  const statCards = [
    { label: "Users", value: t.total_users, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Voice Agents", value: t.total_agents, icon: Bot, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Calls This Month", value: t.calls_this_month.toLocaleString(), icon: Phone, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Total Calls", value: t.total_calls.toLocaleString(), icon: Phone, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Leads", value: t.total_leads.toLocaleString(), icon: UserCheck, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Campaigns", value: t.total_campaigns, icon: Megaphone, color: "text-pink-400", bg: "bg-pink-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-indigo-100">{t.name}</h1>
              <Badge variant="outline" className={`text-[10px] capitalize ${tierColors[t.subscription_tier] || ""}`}>
                {t.subscription_tier}
              </Badge>
              <Badge
                className={`text-[10px] border-0 ${t.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
              >
                {t.is_active ? "active" : "inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.slug} &middot; joined {new Date(t.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs border border-white/10"
            onClick={openEdit}
          >
            <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs border border-white/10"
            onClick={() => toggleMutation.mutate(!t.is_active)}
          >
            {t.is_active ? (
              <><PowerOff className="h-3.5 w-3.5 mr-1.5 text-red-400" /> Deactivate</>
            ) : (
              <><Power className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Activate</>
            )}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleImpersonate}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Impersonate
          </Button>
        </div>
      </div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <Card className="glass-card border-white/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`${s.bg} p-1 rounded`}>
                    <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-lg font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="agents">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="agents" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            <Bot className="h-4 w-4 mr-1.5" /> Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="calls" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            <Phone className="h-4 w-4 mr-1.5" /> Calls
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            <Users className="h-4 w-4 mr-1.5" /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            <Settings className="h-4 w-4 mr-1.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-4">
          <Card className="glass-card border-white/5">
            <CardContent className="p-0">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No voice agents configured for this tenant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Voice</TableHead>
                      <TableHead className="text-center">Calls</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                              <Bot className="h-3.5 w-3.5 text-blue-400" />
                            </div>
                            <span className="text-sm font-medium">{agent.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{agent.persona || "---"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{agent.voice}</TableCell>
                        <TableCell className="text-center text-sm">{agent.total_calls.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${
                            agent.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                            agent.status === "draft" ? "bg-amber-500/20 text-amber-300" :
                            "bg-red-500/20 text-red-300"
                          }`}>
                            {agent.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="mt-4">
          <Card className="glass-card border-white/5">
            <CardContent className="p-0">
              {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No calls found for this tenant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direction</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${call.direction === "inbound" ? "border-blue-500/30 text-blue-300" : "border-emerald-500/30 text-emerald-300"}`}>
                            {call.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{call.agent_name || "---"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{call.lead_name || "---"}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${
                            call.status === "completed" ? "bg-emerald-500/20 text-emerald-300" :
                            call.status === "in-progress" ? "bg-blue-500/20 text-blue-300" :
                            "bg-amber-500/20 text-amber-300"
                          }`}>
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "---"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.sentiment_score != null ? (
                            <span className={call.sentiment_score >= 0.6 ? "text-emerald-400" : call.sentiment_score >= 0.3 ? "text-amber-400" : "text-red-400"}>
                              {(call.sentiment_score * 100).toFixed(0)}%
                            </span>
                          ) : "---"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(call.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card className="glass-card border-white/5">
            <CardContent className="p-0">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No users found for this tenant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="text-sm font-medium">{user.first_name} {user.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 capitalize ${roleColors[user.role] || "bg-gray-500/20 text-gray-300"}`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${user.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                            {user.is_active ? "active" : "inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card className="glass-card border-white/5">
            <CardHeader>
              <CardTitle className="text-base">Organization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Organization ID</label>
                  <Input value={t.id} readOnly className="bg-white/[0.02] border-white/10 text-muted-foreground text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Slug</label>
                  <Input value={t.slug} readOnly className="bg-white/[0.02] border-white/10 text-muted-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Created At</label>
                  <Input value={new Date(t.created_at).toLocaleString()} readOnly className="bg-white/[0.02] border-white/10 text-muted-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Updated At</label>
                  <Input value={new Date(t.updated_at).toLocaleString()} readOnly className="bg-white/[0.02] border-white/10 text-muted-foreground text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Settings (JSON)</label>
                <pre className="p-3 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-muted-foreground font-mono overflow-auto max-h-40">
                  {JSON.stringify(t.settings, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update tenant settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Organization Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Subscription Tier</label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={() => updateMutation.mutate({ name: editName, subscription_tier: editTier })}
              disabled={updateMutation.isPending}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
