"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusPulse } from "@/components/animations";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import type { LiveAgent } from "@/hooks/use-dashboard-events";

type StatusVariant = "success" | "info" | "warning" | "default";

const STATUS_VARIANTS: Record<LiveAgent["status"], StatusVariant> = {
  "On Call": "success",
  Available: "info",
  Paused: "warning",
  Offline: "default",
};

function formatSecondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface LiveAgentStatusProps {
  agents: LiveAgent[];
  isLoading?: boolean;
  onAgentsChange?: (agents: LiveAgent[]) => void;
}

export default function LiveAgentStatus({
  agents: externalAgents,
  isLoading = false,
  onAgentsChange,
}: LiveAgentStatusProps) {
  const [agents, setAgents] = useState<LiveAgent[]>(externalAgents);

  // Sync when parent provides updated agents (e.g. initial load or WS reconnect)
  useEffect(() => {
    if (externalAgents.length > 0) {
      setAgents(externalAgents);
    }
  }, [externalAgents]);

  // Tick seconds-on-call for active agents
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) => {
        const next = prev.map((a) =>
          a.status === "On Call" ? { ...a, secondsOnCall: a.secondsOnCall + 1 } : a
        );
        onAgentsChange?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onAgentsChange]);

  if (isLoading) return <LoadingState variant="skeleton-list" count={5} />;
  if (!agents.length)
    return (
      <EmptyState
        icon={Users}
        title="No agents active"
        description="Agent status will appear once voice agents are configured."
      />
    );

  const onCallCount = agents.filter((a) => a.status === "On Call").length;
  const availableCount = agents.filter((a) => a.status === "Available").length;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-xs text-muted-foreground pb-1">
        <span>
          <span className="text-green-400 font-semibold">{onCallCount}</span> on call
        </span>
        <span>
          <span className="text-blue-400 font-semibold">{availableCount}</span> available
        </span>
      </div>

      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
        >
          <div className="flex items-center gap-3">
            <StatusPulse
              status={
                agent.status === "On Call"
                  ? "active"
                  : agent.status === "Available"
                  ? "available"
                  : agent.status === "Paused"
                  ? "paused"
                  : "idle"
              }
            />
            <span className="font-medium text-sm">{agent.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {agent.status === "On Call" && (
              <span className="text-xs font-mono text-green-400 tabular-nums">
                {formatSecondsToMMSS(agent.secondsOnCall)}
              </span>
            )}
            <Badge variant={STATUS_VARIANTS[agent.status]}>{agent.status}</Badge>
            <span className="text-xs text-muted-foreground w-14 text-right">
              {agent.callsToday} calls
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
