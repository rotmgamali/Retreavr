"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { TenantOverview } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

const TIER_MRR: Record<string, number> = {
  starter: 99,
  pro: 299,
  enterprise: 999,
};

export default function BillingPage() {
  const { data: tenants } = useQuery<TenantOverview[]>({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get<TenantOverview[]>("/organizations/"),
    staleTime: 60_000,
  });

  const all = tenants ?? [];
  const active = all.filter((t) => t.is_active);

  const mrr = active.reduce((sum, t) => sum + (TIER_MRR[t.subscription_tier] ?? 0), 0);
  const arr = mrr * 12;

  const tierBreakdown = ["starter", "pro", "enterprise"].map((tier) => ({
    tier,
    count: active.filter((t) => t.subscription_tier === tier).length,
    revenue: active.filter((t) => t.subscription_tier === tier).length * (TIER_MRR[tier] ?? 0),
  }));

  const tierColor = (tier: string) => {
    if (tier === "enterprise") return "border-indigo-500/40 text-indigo-300";
    if (tier === "pro") return "border-blue-500/40 text-blue-300";
    return "border-emerald-500/40 text-emerald-300";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Billing Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Per-tenant usage and revenue breakdown</p>
      </div>

      {/* Top KPIs */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: "Monthly Recurring Revenue", value: `$${mrr.toLocaleString()}`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Annual Run Rate", value: `$${(arr / 1000).toFixed(1)}k`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Paying Tenants", value: active.length, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10" },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={staggerItem}>
            <Card className="glass-card border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <div className={`${kpi.bg} p-1.5 rounded-md`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tier breakdown */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {tierBreakdown.map((tb) => (
              <div key={tb.tier} className="rounded-lg border border-white/5 bg-white/2 p-4 text-center">
                <Badge variant="outline" className={`mb-2 text-[10px] capitalize ${tierColor(tb.tier)}`}>
                  {tb.tier}
                </Badge>
                <p className="text-xl font-bold mt-1">${tb.revenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tb.count} tenant{tb.count !== 1 ? "s" : ""} · ${TIER_MRR[tb.tier]}/mo each</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-tenant table */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Per-Tenant Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground">Organization</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Tier</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Calls</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Leads</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Users</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">MRR</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map((tenant) => (
                  <TableRow key={tenant.id} className="border-white/5 hover:bg-indigo-500/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] capitalize ${tierColor(tenant.subscription_tier)}`}>
                        {tenant.subscription_tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{tenant.total_calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{tenant.total_leads}</TableCell>
                    <TableCell className="text-right text-sm">{tenant.total_users}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-amber-300">
                      {tenant.is_active ? `$${TIER_MRR[tenant.subscription_tier] ?? 0}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${tenant.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                        {tenant.is_active ? "paying" : "inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
