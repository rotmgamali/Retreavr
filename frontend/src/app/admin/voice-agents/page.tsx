"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  Search,
  Building2,
  Phone,
  Volume2,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import Link from "next/link";

interface AgentWithOrg {
  id: string;
  name: string;
  persona: string;
  voice: string;
  status: string;
  system_prompt: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  total_calls: number;
  created_at: string;
}

const FALLBACK_AGENTS: AgentWithOrg[] = [
  { id: "a1", name: "Sarah - Auto Insurance", persona: "Friendly auto insurance specialist", voice: "nova", status: "active", system_prompt: "You are a helpful auto insurance agent. Greet the caller warmly and help them understand their coverage options...", organization_id: "1", organization_name: "Apex Insurance Group", organization_slug: "apex", total_calls: 1200, created_at: "2025-01-15T00:00:00Z" },
  { id: "a2", name: "Mike - Home Insurance", persona: "Expert home insurance advisor", voice: "echo", status: "active", system_prompt: "You are a knowledgeable home insurance agent...", organization_id: "1", organization_name: "Apex Insurance Group", organization_slug: "apex", total_calls: 890, created_at: "2025-02-01T00:00:00Z" },
  { id: "a3", name: "Lisa - Life Insurance", persona: "Compassionate life insurance counselor", voice: "alloy", status: "draft", system_prompt: "You are a caring life insurance specialist...", organization_id: "2", organization_name: "Blue Harbor Agency", organization_slug: "blue-harbor", total_calls: 0, created_at: "2025-03-10T00:00:00Z" },
  { id: "a4", name: "David - Claims Handler", persona: "Efficient claims processing specialist", voice: "onyx", status: "active", system_prompt: "You are a claims processing specialist...", organization_id: "2", organization_name: "Blue Harbor Agency", organization_slug: "blue-harbor", total_calls: 450, created_at: "2025-04-01T00:00:00Z" },
  { id: "a5", name: "Emma - Quote Generator", persona: "Quick and accurate quote provider", voice: "shimmer", status: "active", system_prompt: "You are a fast and friendly agent helping callers get insurance quotes...", organization_id: "3", organization_name: "Coastal Coverage LLC", organization_slug: "coastal", total_calls: 310, created_at: "2025-05-01T00:00:00Z" },
];

const voiceColors: Record<string, string> = {
  alloy: "text-purple-400",
  echo: "text-blue-400",
  fable: "text-emerald-400",
  onyx: "text-amber-400",
  nova: "text-pink-400",
  shimmer: "text-cyan-400",
};

export default function GlobalVoiceAgentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<AgentWithOrg | null>(null);
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ items: AgentWithOrg[]; total: number }>({
    queryKey: ["admin", "voice-agents", page],
    queryFn: () =>
      api.get<{ items: AgentWithOrg[]; total: number }>(
        `/admin/voice-agents?limit=${pageSize}&offset=${(page - 1) * pageSize}`
      ),
    placeholderData: { items: FALLBACK_AGENTS, total: FALLBACK_AGENTS.length },
    staleTime: 30_000,
  });

  const allAgents = data?.items ?? FALLBACK_AGENTS;
  const total = data?.total ?? FALLBACK_AGENTS.length;

  const filtered = allAgents.filter((a) => {
    const matchSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.organization_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Summary stats
  const activeCount = allAgents.filter((a) => a.status === "active").length;
  const draftCount = allAgents.filter((a) => a.status === "draft").length;
  const totalCalls = allAgents.reduce((sum, a) => sum + a.total_calls, 0);
  const uniqueOrgs = new Set(allAgents.map((a) => a.organization_id)).size;

  const summaryCards = [
    { label: "Total Agents", value: allAgents.length, icon: Bot, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Active", value: activeCount, icon: Bot, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Draft", value: draftCount, icon: Bot, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Total Agent Calls", value: totalCalls.toLocaleString(), icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Organizations", value: uniqueOrgs, icon: Building2, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Voice Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All voice agents across every tenant
        </p>
      </div>

      {/* Summary */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {summaryCards.map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <Card className="glass-card border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <div className={`${s.bg} p-1.5 rounded-md`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents or organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="glass-card border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead className="text-center">Calls</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                : filtered.map((agent) => (
                    <TableRow key={agent.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                            <Bot className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{agent.persona}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/tenants/${agent.organization_id}`} className="flex items-center gap-2 hover:text-indigo-300 transition-colors">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{agent.organization_name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Volume2 className={`h-3.5 w-3.5 ${voiceColors[agent.voice] || "text-muted-foreground"}`} />
                          <span className="text-sm capitalize">{agent.voice}</span>
                        </div>
                      </TableCell>
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-indigo-400"
                          onClick={() => setSelectedAgent(agent)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-400" />
              {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Organization</label>
                  <p className="text-sm">{selectedAgent.organization_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Voice</label>
                  <p className="text-sm capitalize">{selectedAgent.voice}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Status</label>
                  <Badge className={`text-[10px] border-0 ${
                    selectedAgent.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                    selectedAgent.status === "draft" ? "bg-amber-500/20 text-amber-300" :
                    "bg-red-500/20 text-red-300"
                  }`}>
                    {selectedAgent.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Total Calls</label>
                  <p className="text-sm">{selectedAgent.total_calls.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Persona</label>
                <p className="text-sm text-muted-foreground">{selectedAgent.persona || "Not set"}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">System Prompt</label>
                <pre className="p-3 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                  {selectedAgent.system_prompt || "Not set"}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link href={`/admin/tenants/${selectedAgent.organization_id}`}>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-1.5" /> View Tenant
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
