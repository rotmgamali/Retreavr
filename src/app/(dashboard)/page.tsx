"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggeredGrid, StaggeredItem, MotionCard, AnimatedCounter } from "@/components/animations";
import {
  Phone,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { kpiSparklineConfigs } from "@/components/dashboard/mockData";

const CallVolumeChart = dynamic(() => import("@/components/dashboard/CallVolumeChart"), { ssr: false });
const ConversionFunnel = dynamic(() => import("@/components/dashboard/ConversionFunnel"), { ssr: false });
const KPISparkline = dynamic(() => import("@/components/dashboard/KPISparkline"), { ssr: false });
const LiveAgentStatus = dynamic(() => import("@/components/dashboard/LiveAgentStatus"), { ssr: false });
const ActivityFeed = dynamic(() => import("@/components/dashboard/ActivityFeed"), { ssr: false });
const CallVolumeHeatmap = dynamic(() => import("@/components/dashboard/CallVolumeHeatmap"), { ssr: false });

const kpiCards = [
  {
    title: "Total Calls Today",
    numericValue: 1284,
    format: (n: number) => Math.round(n).toLocaleString(),
    change: "+12.5%",
    trend: "up" as const,
    icon: Phone,
    color: "text-blue-400",
    sparklineColor: "#3b82f6",
    sparklineIdx: 0,
  },
  {
    title: "Conversion Rate",
    numericValue: 23.8,
    format: (n: number) => `${n.toFixed(1)}%`,
    change: "+3.2%",
    trend: "up" as const,
    icon: TrendingUp,
    color: "text-green-400",
    sparklineColor: "#22c55e",
    sparklineIdx: 1,
  },
  {
    title: "Active Leads",
    numericValue: 3427,
    format: (n: number) => Math.round(n).toLocaleString(),
    change: "-2.1%",
    trend: "down" as const,
    icon: Users,
    color: "text-cyan-400",
    sparklineColor: "#06b6d4",
    sparklineIdx: 2,
  },
  {
    title: "Revenue Pipeline",
    numericValue: 847,
    format: (n: number) => `$${Math.round(n)}K`,
    change: "+18.7%",
    trend: "up" as const,
    icon: DollarSign,
    color: "text-yellow-400",
    sparklineColor: "#eab308",
    sparklineIdx: 3,
  },
];

export default function DashboardPage() {
  return (
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
                  <KPISparkline
                    baseValue={kpiSparklineConfigs[kpi.sparklineIdx].baseValue}
                    color={kpi.sparklineColor}
                    volatility={kpiSparklineConfigs[kpi.sparklineIdx].volatility}
                  />
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
            <LiveAgentStatus />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed />
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
  );
}
