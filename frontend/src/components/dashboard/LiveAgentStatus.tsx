"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusPulse } from "@/components/animations";
import { generateAgentData, formatSecondsToMMSS, AgentStatus } from "./mockData";


const STATUS_VARIANTS: Record<AgentStatus["status"], "success" | "info" | "warning" | "default"> = {
  "On Call": "success",
  Available: "info",
  Paused: "warning",
  Offline: "default",
};

export default function LiveAgentStatus() {
  const initialAgents = useMemo(() => generateAgentData(), []);
  const [agents, setAgents] = useState(initialAgents);

  // Tick seconds-on-call for active agents
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) =>
          a.status === "On Call"
            ? { ...a, secondsOnCall: a.secondsOnCall + 1 }
            : a
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
