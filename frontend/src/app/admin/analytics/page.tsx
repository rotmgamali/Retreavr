"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
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
import {
  Phone,
  TrendingUp,
  BarChart3,
  PieChart,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";

interface AnalyticsData {
  top_tenants_by_calls: { id: string; name: string; slug: string; total_calls: number; calls_this_month: number }[];
  daily_call_volume: { date: string; calls: number }[];
  tenant_growth: { month: string; new_tenants: number }[];
  calls_by_status: { status: string; count: number }[];
  top_tenants_by_conversion: { id: string; name: string; total_leads: number; bound_leads: number; conversion_rate: number }[];
  tier_distribution: { subscription_tier: string; count: number }[];
}

const FALLBACK: AnalyticsData = {
  top_tenants_by_calls: [
    { id: "1", name: "Apex Insurance Group", slug: "apex", total_calls: 3120, calls_this_month: 480 },
    { id: "2", name: "Blue Harbor Agency", slug: "blue-harbor", total_calls: 1840, calls_this_month: 310 },
    { id: "3", name: "Delta Risk Partners", slug: "delta-risk", total_calls: 2100, calls_this_month: 375 },
    { id: "4", name: "Coastal Coverage LLC", slug: "coastal", total_calls: 620, calls_this_month: 95 },
    { id: "5", name: "Evergreen Benefits", slug: "evergreen", total_calls: 45, calls_this_month: 45 },
  ],
  daily_call_volume: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    calls: Math.floor(Math.random() * 200 + 80),
  })),
  tenant_growth: [
    { month: "2025-04-01", new_tenants: 2 },
    { month: "2025-05-01", new_tenants: 3 },
    { month: "2025-06-01", new_tenants: 1 },
    { month: "2025-07-01", new_tenants: 4 },
    { month: "2025-08-01", new_tenants: 2 },
    { month: "2025-09-01", new_tenants: 5 },
    { month: "2025-10-01", new_tenants: 3 },
    { month: "2025-11-01", new_tenants: 2 },
    { month: "2025-12-01", new_tenants: 4 },
    { month: "2026-01-01", new_tenants: 3 },
    { month: "2026-02-01", new_tenants: 2 },
    { month: "2026-03-01", new_tenants: 1 },
  ],
  calls_by_status: [
    { status: "completed", count: 12400 },
    { status: "no-answer", count: 2800 },
    { status: "failed", count: 1200 },
    { status: "busy", count: 800 },
    { status: "in-progress", count: 120 },
  ],
  top_tenants_by_conversion: [
    { id: "1", name: "Apex Insurance Group", total_leads: 540, bound_leads: 86, conversion_rate: 15.9 },
    { id: "2", name: "Blue Harbor Agency", total_leads: 290, bound_leads: 38, conversion_rate: 13.1 },
    { id: "3", name: "Coastal Coverage LLC", total_leads: 88, bound_leads: 10, conversion_rate: 11.4 },
    { id: "4", name: "Delta Risk Partners", total_leads: 340, bound_leads: 34, conversion_rate: 10.0 },
  ],
  tier_distribution: [
    { subscription_tier: "enterprise", count: 5 },
    { subscription_tier: "pro", count: 9 },
    { subscription_tier: "starter", count: 7 },
    { subscription_tier: "trial", count: 3 },
  ],
};

const STATUS_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#3b82f6"];
const TIER_COLORS: Record<string, string> = {
  enterprise: "#f59e0b",
  pro: "#6366f1",
  starter: "#10b981",
  trial: "#3b82f6",
};
const PIE_COLORS = ["#f59e0b", "#6366f1", "#10b981", "#3b82f6"];

export default function PlatformAnalyticsPage() {
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["admin", "analytics", "full"],
    queryFn: () => api.get<AnalyticsData>("/admin/analytics"),
    placeholderData: FALLBACK,
    staleTime: 60_000,
  });

  const d = analytics ?? FALLBACK;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Platform Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Cross-tenant insights and platform-wide metrics</p>
      </div>

      {/* Call Volume Chart */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-indigo-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            Daily Call Volume (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.daily_call_volume}>
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  interval={4}
                />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip
                  contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#e0e7ff" }}
                  labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                />
                <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#analyticsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Tenant Growth + Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tenant Growth */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Tenant Growth (12 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.tenant_growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="month"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short" })}
                  />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#e0e7ff" }}
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  />
                  <Bar dataKey="new_tenants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tier + Status Distribution */}
        <div className="space-y-4">
          <Card className="glass-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-indigo-100 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-amber-400" />
                Subscription Tiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={d.tier_distribution}
                      dataKey="count"
                      nameKey="subscription_tier"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      strokeWidth={0}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label={((props: any) => `${props.subscription_tier}: ${props.count}`) as any}
                    >
                      {d.tier_distribution.map((entry, i) => (
                        <Cell key={entry.subscription_tier} fill={TIER_COLORS[entry.subscription_tier] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#e0e7ff" }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Call Status Breakdown */}
          <Card className="glass-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-indigo-100">Call Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.calls_by_status.slice(0, 5).map((s, i) => {
                const max = d.calls_by_status[0]?.count || 1;
                const pct = (s.count / max) * 100;
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 capitalize truncate">{s.status}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{s.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Tenants Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Call Volume */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-100 flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-400" />
              Top Tenants by Call Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Tenant</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.top_tenants_by_calls.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/admin/tenants/${t.id}`} className="text-sm font-medium hover:text-indigo-300 transition-colors">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm">{t.total_calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{t.calls_this_month.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Conversion Rate */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Top Tenants by Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Tenant</TableHead>
                  <TableHead className="text-xs text-right">Leads</TableHead>
                  <TableHead className="text-xs text-right">Bound</TableHead>
                  <TableHead className="text-xs text-right">Conv %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.top_tenants_by_conversion.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/admin/tenants/${t.id}`} className="text-sm font-medium hover:text-indigo-300 transition-colors">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm">{t.total_leads}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{t.bound_leads}</TableCell>
                    <TableCell className="text-right">
                      <Badge className="text-[10px] border-0 bg-emerald-500/20 text-emerald-300">
                        {t.conversion_rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
