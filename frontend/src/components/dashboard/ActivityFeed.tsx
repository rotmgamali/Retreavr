"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import type { DashboardActivityEvent } from "@/hooks/use-dashboard-events";

const STATUS_DOT: Record<DashboardActivityEvent["status"], string> = {
  success: "bg-green-400",
  info: "bg-blue-400",
  warning: "bg-yellow-400",
  error: "bg-red-400",
};

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

interface ActivityFeedProps {
  events: DashboardActivityEvent[];
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const [, setTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Update relative timestamps every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to top when new events arrive (feed is newest-first)
  const prevLengthRef = useRef(events.length);
  useEffect(() => {
    if (events.length > prevLengthRef.current) {
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  if (!events.length)
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Real-time events will appear here as calls happen."
      />
    );

  return (
    <div ref={feedRef} className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {events.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
        >
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.event}</p>
            <p className="text-xs text-muted-foreground">
              {item.agent} · {formatRelativeTime(item.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
