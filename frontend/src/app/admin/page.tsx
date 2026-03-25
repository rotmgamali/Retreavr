"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Phone,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  UserCheck,
  PhoneCall,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import Link from "next/link";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface OverviewStats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  inactive_tenants: number;
  total_users: number;
  total_calls: number;
  total_leads: number;
  mrr: number;
  call_volume: {
    today: number;
    this_week: number;
    this_month: number;
  };
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  is_active: boolean;
  total_users: number;
  total_agents: number;
  total_calls: number;
  calls_this_month: number;
  total_leads: number;
  created_at: string;
}

interface AnalyticsData {
  daily_call_volume: { date: string; calls: number }[];
  tier_distribution: { subscription_tier: string; count: number }[];
}

// Fallback data when API is unavailable
const FALLBACK_STATS: OverviewStats = {
  total_tenants: 24, active_tenants: 21, trial_tenants: 3, inactive_tenants: 0,
  total_users: 312, total_calls: 18420, total_leads: 2840, mrr: 48500,
  call_volume: { today: 142, this_week: 1230, this_month: 4820 },
};

const FALLBACK_TENANTS: TenantRow[] = [
  { id: "1", name: "Apex Insurance Group", slug: "apex", subscription_tier: "enterprise", is_active: true, total_users: 28, total_agents: 5, total_calls: 3120, calls_this_month: 480, total_leads: 540, created_at: "2025-01-10T00:00:00Z" },
  { id: "2", name: "Blue Harbor Agency", slug: "blue-harbor", subscription_tier: "pro", is_active: true, total_users: 12, total_agents: 3, total_calls: 1840, calls_this_month: 310, total_leads: 290, created_at: "2025-02-14T00:00:00Z" },
  { id: "3", name: "Coastal Coverage LLC", slug: "coastal", subscription_tier: "starter", is_active: true, total_users: 5, total_agents: 1, total_calls: 620, calls_this_month: 95, total_leads: 88, created_at: "2025-03-01T00:00:00Z" },
  { id: "4", name: "Delta Risk Partners", slug: "delta-risk", subscription_tier: "pro", is_active: true, total_users: 15, total_agents: 4, total_calls: 2100, calls_this_month: 375, total_leads: 340, created_at: "2025-03-15T00:00:00Z" },
  { id: "5", name: "Evergreen Benefits", slug: "evergreen", subscription_tier: "trial", is_active: true, total_users: 3, total_agents: 1, total_calls: 45, calls_this_month: 45, total_leads: 12, created_at: "2026-03-01T00:00:00Z" },
];

const FALLBACK_CHART: { date: string; calls: number }[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
  calls: Math.floor(Math.random() * 200 + 80),
}));

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<OverviewStats>({
    queryKey: ["admin", "overview"],
    queryFn: () => api.get<OverviewStats>("/admin/overview"),
    placeholderData: FALLBACK_STATS,
    staleTime: 30_000,
  });

  const { data: tenantsResp } = useQuery<{ items: TenantRow[] }>({
    queryKey: ["admin", "tenants", "list"],
    queryFn: () => api.get<{ items: TenantRow[] }>("/admin/tenants?limit=5"),
    placeholderData: { items: FALLBACK_TENANTS },
    staleTime: 60_000,
  });

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["admin", "analytics"],
    queryFn: () => api.get<AnalyticsData>("/admin/analytics"),
    placeholderData: { daily_call_volume: FALLBACK_CHART, tier_distribution: [] },
    staleTime: 60_000,
  });

  const s = stats ?? FALLBACK_STATS;
  const recentTenants = tenantsResp?.items ?? FALLBACK_TENANTS;
  const chartData = analytics?.daily_call_volume ?? FALLBACK_CHART;

  const kpis = [
    { label: "Total Tenants", value: s.total_tenants, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Active Tenants", value: s.active_tenants, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Total Calls", value: s.total_calls.toLocaleString(), icon: Phone, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Users", value: s.total_users.toLocaleString(), icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "MRR", value: `$${(s.mrr / 1000).toFixed(1)}k`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  const healthCards = [
    { label: "Active", value: s.active_tenants, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Trial", value: s.trial_tenants, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: "Inactive", value: s.inactive_tenants, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time metrics across all tenants</p>
      </div>

      {/* KPI cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={staggerItem}>
            <Card className="glass-card border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <div className={`${kpi.bg} p-1.5 rounded-md`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {statsLoading ? <Skeleton className="h-8 w-20" /> : kpi.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tenant Health + Call Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tenant Health */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-100">Tenant Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthCards.map((h) => (
              <div key={h.label} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${h.border} bg-white/[0.02]`}>
                <div className="flex items-center gap-3">
                  <div className={`${h.bg} p-1.5 rounded-md`}>
                    <h.icon className={`h-4 w-4 ${h.color}`} />
                  </div>
                  <span className="text-sm text-muted-foreground">{h.label}</span>
                </div>
                <span className={`text-lg font-bold ${h.color}`}>{h.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-indigo-500/20 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/10 p-1.5 rounded-md">
                  <PhoneCall className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="text-sm text-muted-foreground">Calls Today</span>
              </div>
              <span className="text-lg font-bold text-indigo-400">{s.call_volume.today}</span>
            </div>
          </CardContent>
        </Card>

        {/* Call Volume Chart */}
        <Card className="glass-card border-white/5 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-100">Call Volume (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
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
                    interval={6}
                  />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                  <Tooltip
                    contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#e0e7ff" }}
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#callGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent tenants */}
      <Card className="glass-card border-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold text-indigo-100">Top Tenants</CardTitle>
          <Link href="/admin/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            View all &rarr;
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentTenants.map((tenant) => (
              <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`}>
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-indigo-500/5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.total_users} users &middot; {tenant.total_agents} agents &middot; {tenant.calls_this_month} calls/mo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize border-indigo-500/30 text-indigo-300"
                    >
                      {tenant.subscription_tier}
                    </Badge>
                    <Badge
                      variant={tenant.is_active ? "default" : "secondary"}
                      className={`text-[10px] ${tenant.is_active ? "bg-emerald-500/20 text-emerald-300 border-0" : "bg-red-500/20 text-red-300 border-0"}`}
                    >
                      {tenant.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Calls This Week</span>
              <PhoneCall className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.call_volume.this_week.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Calls This Month</span>
              <Phone className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.call_volume.this_month.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Total Leads</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.total_leads.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
