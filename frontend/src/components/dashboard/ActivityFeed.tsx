"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { generateActivityEvents, formatRelativeTime, ActivityEvent } from "./mockData";

const STATUS_DOT: Record<ActivityEvent["status"], string> = {
  success: "bg-green-400",
  info: "bg-blue-400",
  warning: "bg-yellow-400",
  error: "bg-red-400",
};

export default function ActivityFeed() {
  const initialEvents = useMemo(() => generateActivityEvents(), []);
  const [events, setEvents] = useState(initialEvents);
  const [, setTick] = useState(0); // force re-render for relative time updates
  const feedRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  // Update relative timestamps every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Simulate new events arriving periodically
  useEffect(() => {
    const newEventTemplates: Omit<ActivityEvent, "id" | "timestamp">[] = [
      { event: "New lead qualified", agent: "Sarah AI", status: "success" },
      { event: "Quote generated", agent: "Mike AI", status: "info" },
      { event: "Policy bound", agent: "Alex AI", status: "success" },
      { event: "Follow-up scheduled", agent: "Jordan AI", status: "info" },
      { event: "Call transferred", agent: "Lisa AI", status: "warning" },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      const template = newEventTemplates[idx % newEventTemplates.length];
      idx++;
      const newEvent: ActivityEvent = {
        ...template,
        id: `live-${Date.now()}`,
        timestamp: new Date(),
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Track if user is scrolled to bottom
  const handleScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  };

  // Auto-scroll to top on new events (feed is newest-first)
  useEffect(() => {
    const el = feedRef.current;
    if (el && isAtBottom.current) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [events]);

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      className="space-y-2 max-h-64 overflow-y-auto pr-1"
    >
      {events.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
        >
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status]}`}
          />
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
