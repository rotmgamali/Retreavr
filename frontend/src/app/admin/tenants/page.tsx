"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Plus,
  Search,
  Users,
  Bot,
  Power,
  PowerOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import Link from "next/link";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  is_active: boolean;
  user_count: number;
  agent_count: number;
  call_count: number;
  lead_count: number;
  created_at: string;
}

const tierColors: Record<string, string> = {
  enterprise: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  pro: "border-indigo-500/40 text-indigo-300 bg-indigo-500/10",
  starter: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  trial: "border-blue-500/40 text-blue-300 bg-blue-500/10",
};

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantTier, setNewTenantTier] = useState("trial");
  const pageSize = 20;

  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";

  const { data, isLoading } = useQuery<{ items: TenantRow[]; total: number }>({
    queryKey: ["admin", "tenants", page, statusFilter, search],
    queryFn: () =>
      api.get<{ items: TenantRow[]; total: number }>(
        `/admin/tenants?limit=${pageSize}&offset=${(page - 1) * pageSize}${statusParam}${searchParam}`
      ),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; subscription_tier: string }) =>
      api.post("/admin/tenants", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      setCreateOpen(false);
      setNewTenantName("");
      setNewTenantTier("trial");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ orgId, is_active }: { orgId: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${orgId}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });

  const tenants = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-indigo-100">Tenant Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all organizations on the platform
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              <Plus className="h-4 w-4" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new organization to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Organization Name</label>
                <Input
                  placeholder="Acme Insurance Co."
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Subscription Tier</label>
                <Select value={newTenantTier} onValueChange={setNewTenantTier}>
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
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={() => createMutation.mutate({ name: newTenantName, subscription_tier: newTenantTier })}
                disabled={!newTenantName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Tenant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <motion.div
        className="flex flex-col sm:flex-row gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>
      </motion.div>

      {/* Table */}
      <Card className="glass-card border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Agents</TableHead>
                <TableHead className="text-center">Calls/Mo</TableHead>
                <TableHead className="text-center">Total Calls</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                : tenants.map((t) => (
                    <TableRow key={t.id} className="group">
                      <TableCell>
                        <Link href={`/admin/tenants/${t.id}`} className="flex items-center gap-3 hover:text-indigo-300 transition-colors">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground">{t.slug}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${tierColors[t.subscription_tier] || ""}`}>
                          {t.subscription_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{t.user_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Bot className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{t.agent_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{(t.call_count ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center text-sm">{(t.call_count ?? 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] border-0 ${t.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
                        >
                          {t.is_active ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleMutation.mutate({ orgId: t.id, is_active: !t.is_active });
                            }}
                          >
                            {t.is_active ? (
                              <><PowerOff className="h-3.5 w-3.5 mr-1 text-red-400" /> Deactivate</>
                            ) : (
                              <><Power className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Activate</>
                            )}
                          </Button>
                          <Link href={`/admin/tenants/${t.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-indigo-400">
                              View
                            </Button>
                          </Link>
                        </div>
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
    </div>
  );
}
