// Mock data generators for dashboard charts

export interface HourlyCallData {
  hour: string;
  calls: number;
  answered: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  pct: number;
  color: string;
}

export interface SparklinePoint {
  day: string;
  value: number;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "On Call" | "Available" | "Paused" | "Offline";
  callsToday: number;
  secondsOnCall: number;
}

export interface ActivityEvent {
  id: string;
  event: string;
  agent: string;
  status: "success" | "info" | "warning" | "error";
  timestamp: Date;
}

export interface HeatmapCell {
  hour: number;
  day: number;
  value: number;
}

// 24-hour call volume data
export function generateCallVolumeData(): HourlyCallData[] {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const label = i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
    // Simulate realistic call patterns: low at night, peak mid-morning and afternoon
    const base =
      i < 6 ? 20 : i < 9 ? 60 + i * 15 : i < 12 ? 200 + i * 10 : i < 14 ? 280 : i < 18 ? 240 - (i - 14) * 5 : i < 20 ? 180 - (i - 18) * 20 : 80 - (i - 20) * 15;
    const calls = Math.max(5, Math.round(base + (Math.random() - 0.5) * 40));
    return {
      hour: label,
      calls,
      answered: Math.round(calls * (0.82 + Math.random() * 0.12)),
    };
  });
  return hours;
}

// Conversion funnel stages
export function generateFunnelData(): FunnelStage[] {
  return [
    { stage: "Calls Made", count: 1284, pct: 100, color: "#3b82f6" },
    { stage: "Leads Qualified", count: 642, pct: 50, color: "#06b6d4" },
    { stage: "Quotes Sent", count: 385, pct: 30, color: "#8b5cf6" },
    { stage: "Policies Bound", count: 128, pct: 10, color: "#22c55e" },
  ];
}

// 7-day sparkline data for a KPI
export function generateSparklineData(
  baseValue: number,
  volatility: number = 0.1
): SparklinePoint[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let current = baseValue;
  return days.map((day) => {
    current = Math.max(0, current * (1 + (Math.random() - 0.48) * volatility));
    return { day, value: Math.round(current) };
  });
}

// Live agent status data
export function generateAgentData(): AgentStatus[] {
  return [
    { id: "1", name: "Sarah AI", status: "On Call", callsToday: 47, secondsOnCall: 312 },
    { id: "2", name: "Mike AI", status: "Available", callsToday: 38, secondsOnCall: 0 },
    { id: "3", name: "Alex AI", status: "On Call", callsToday: 52, secondsOnCall: 87 },
    { id: "4", name: "Lisa AI", status: "Paused", callsToday: 31, secondsOnCall: 0 },
    { id: "5", name: "Jordan AI", status: "On Call", callsToday: 29, secondsOnCall: 541 },
  ];
}

// Activity feed events
export function generateActivityEvents(): ActivityEvent[] {
  const events = [
    { event: "New lead qualified", agent: "Sarah AI", status: "success" as const, minsAgo: 2 },
    { event: "Quote generated", agent: "Mike AI", status: "info" as const, minsAgo: 5 },
    { event: "Policy bound", agent: "Sarah AI", status: "success" as const, minsAgo: 8 },
    { event: "Call transferred to human", agent: "Alex AI", status: "warning" as const, minsAgo: 12 },
    { event: "Lead contacted", agent: "Mike AI", status: "info" as const, minsAgo: 15 },
    { event: "Quote accepted", agent: "Jordan AI", status: "success" as const, minsAgo: 18 },
    { event: "Follow-up scheduled", agent: "Lisa AI", status: "info" as const, minsAgo: 22 },
    { event: "Call dropped", agent: "Alex AI", status: "error" as const, minsAgo: 27 },
    { event: "New lead qualified", agent: "Jordan AI", status: "success" as const, minsAgo: 31 },
    { event: "Policy renewal confirmed", agent: "Sarah AI", status: "success" as const, minsAgo: 35 },
  ];
  const now = new Date();
  return events.map((e, i) => ({
    id: `evt-${i}`,
    ...e,
    timestamp: new Date(now.getTime() - e.minsAgo * 60000),
  }));
}

// Weekly heatmap data (hour 0-23 × day 0-6)
export function generateHeatmapData(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Low on weekends, low at night, peak business hours
      const isWeekend = day >= 5;
      const isBusinessHour = hour >= 9 && hour <= 17;
      const isPeak = hour >= 10 && hour <= 14;
      const base = isWeekend
        ? isPeak ? 40 : 15
        : isBusinessHour
        ? isPeak ? 180 : 120
        : hour < 7 || hour > 20
        ? 5
        : 50;
      cells.push({
        hour,
        day,
        value: Math.max(0, Math.round(base + (Math.random() - 0.5) * base * 0.4)),
      });
    }
  }
  return cells;
}

// KPI sparkline configs
export const kpiSparklineConfigs = [
  { key: "calls", baseValue: 1100, volatility: 0.15 },
  { key: "conversion", baseValue: 22, volatility: 0.12 },
  { key: "leads", baseValue: 3200, volatility: 0.08 },
  { key: "revenue", baseValue: 750000, volatility: 0.1 },
];

export function formatSecondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
