"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggeredGrid, StaggeredItem, MotionCard, AnimatedCounter, SkeletonToContent } from "@/components/animations";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { usePageLoading } from "@/hooks/use-page-loading";
import {
  Phone,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useDashboardKPIs, useLiveAgents } from "@/hooks/use-analytics";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardEvents } from "@/hooks/use-dashboard-events";
import type { SparklinePoint } from "@/components/dashboard/KPISparkline";

const CallVolumeChart = dynamic(() => import("@/components/dashboard/CallVolumeChart"), { ssr: false });
const ConversionFunnel = dynamic(() => import("@/components/dashboard/ConversionFunnel"), { ssr: false });
const KPISparkline = dynamic(() => import("@/components/dashboard/KPISparkline"), { ssr: false });
const LiveAgentStatus = dynamic(() => import("@/components/dashboard/LiveAgentStatus"), { ssr: false });
const ActivityFeed = dynamic(() => import("@/components/dashboard/ActivityFeed"), { ssr: false });
const CallVolumeHeatmap = dynamic(() => import("@/components/dashboard/CallVolumeHeatmap"), { ssr: false });

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function trendToSparkline(trend: number[] = []): SparklinePoint[] {
  return trend.map((v, i) => ({ day: DAYS[i] ?? `D${i + 1}`, value: v }));
}

function fmtChange(n: number | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function DashboardPage() {
  const loading = usePageLoading(800);
  const { data: kpis } = useDashboardKPIs();
  const { data: user } = useCurrentUser();
  const { data: initialAgents, isLoading: agentsLoading } = useLiveAgents();

  const orgId = user?.organization_id ?? null;
  const { agents: wsAgents, activities, setAgents } = useDashboardEvents(orgId);

  // Seed WS state from API once agents load; fall back to API data if WS hasn't received any yet
  const agents = useMemo(() => {
    if (wsAgents.length > 0) return wsAgents;
    return initialAgents ?? [];
  }, [wsAgents, initialAgents]);

  useMemo(() => {
    if (initialAgents?.length && wsAgents.length === 0) {
      setAgents(initialAgents);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAgents]);

  const callsSparkline = useMemo(() => trendToSparkline(kpis?.calls_trend), [kpis?.calls_trend]);
  const conversionSparkline = useMemo(() => trendToSparkline(kpis?.conversion_trend), [kpis?.conversion_trend]);
  const leadsSparkline = useMemo(() => trendToSparkline(kpis?.leads_trend), [kpis?.leads_trend]);
  const revenueSparkline = useMemo(() => trendToSparkline(kpis?.revenue_trend), [kpis?.revenue_trend]);

  const kpiCards = useMemo(() => [
    {
      title: "Total Calls Today",
      numericValue: kpis?.total_calls ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
      change: fmtChange(kpis?.calls_change),
      trend: (kpis?.calls_change ?? 0) >= 0 ? ("up" as const) : ("down" as const),
      icon: Phone,
      color: "text-blue-400",
      sparklineColor: "#3b82f6",
      sparklineData: callsSparkline,
    },
    {
      title: "Conversion Rate",
      numericValue: kpis?.conversion_rate ?? 0,
      format: (n: number) => `${n.toFixed(1)}%`,
      change: fmtChange(kpis?.conversion_change),
      trend: (kpis?.conversion_change ?? 0) >= 0 ? ("up" as const) : ("down" as const),
      icon: TrendingUp,
      color: "text-green-400",
      sparklineColor: "#22c55e",
      sparklineData: conversionSparkline,
    },
    {
      title: "Active Leads",
      numericValue: kpis?.active_leads ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
      change: fmtChange(kpis?.leads_change),
      trend: (kpis?.leads_change ?? 0) >= 0 ? ("up" as const) : ("down" as const),
      icon: Users,
      color: "text-cyan-400",
      sparklineColor: "#06b6d4",
      sparklineData: leadsSparkline,
    },
    {
      title: "Revenue Pipeline",
      numericValue: kpis?.revenue ? kpis.revenue / 1000 : 0,
      format: (n: number) => `$${Math.round(n)}K`,
      change: fmtChange(kpis?.revenue_change),
      trend: (kpis?.revenue_change ?? 0) >= 0 ? ("up" as const) : ("down" as const),
      icon: DollarSign,
      color: "text-yellow-400",
      sparklineColor: "#eab308",
      sparklineData: revenueSparkline,
    },
  ], [kpis, callsSparkline, conversionSparkline, leadsSparkline, revenueSparkline]);

  return (
    <SkeletonToContent loading={loading} skeleton={<DashboardSkeleton />}>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your insurance voice agent platform
        </p>
      </div>

      {/* KPI Cards with 7-day sparklines — staggered entrance */}
      <StaggeredGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <StaggeredItem key={kpi.title}>
            <MotionCard className="glass-card h-full">
              <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between pb-2 flex-row">
                <div className="flex flex-row items-center justify-between w-full pb-2">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="p-6 pt-0">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      <AnimatedCounter value={kpi.numericValue} format={kpi.format} />
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {kpi.trend === "up" ? (
                        <ArrowUpRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                      )}
                      <span
                        className={`text-xs ${
                          kpi.trend === "up" ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {kpi.change} from yesterday
                      </span>
                    </div>
                  </div>
                  <KPISparkline data={kpi.sparklineData} color={kpi.sparklineColor} />
                </div>
              </div>
            </MotionCard>
          </StaggeredItem>
        ))}
      </StaggeredGrid>

      {/* Call Volume Chart + Conversion Funnel */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Call Volume — Last 24 Hours</CardTitle>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Total
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" /> Answered
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CallVolumeChart />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversionFunnel />
          </CardContent>
        </Card>
      </div>

      {/* Live Agent Status + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Live Agent Status</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveAgentStatus
              agents={agents}
              isLoading={agentsLoading && agents.length === 0}
            />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed events={activities} />
          </CardContent>
        </Card>
      </div>

      {/* Weekly Call Volume Heatmap */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Weekly Call Volume Heatmap</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Calls by hour of day × day of week
          </p>
        </CardHeader>
        <CardContent>
          <CallVolumeHeatmap />
        </CardContent>
      </Card>
    </div>
    </SkeletonToContent>
  );
}
