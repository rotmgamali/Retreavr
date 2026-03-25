"use client";

import { useMemo } from "react";
import { useHeatmapData } from "@/hooks/use-analytics";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LayoutGrid } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

function getColor(value: number, max: number): string {
  if (value === 0) return "rgba(255,255,255,0.03)";
  const intensity = value / max;
  if (intensity < 0.33) {
    const t = intensity / 0.33;
    return `rgba(59, 130, 246, ${0.15 + t * 0.25})`;
  } else if (intensity < 0.66) {
    const t = (intensity - 0.33) / 0.33;
    const r = Math.round(59 + t * (6 - 59));
    const g = Math.round(130 + t * (182 - 130));
    const b = Math.round(246 + t * (212 - 246));
    return `rgba(${r}, ${g}, ${b}, ${0.4 + t * 0.25})`;
  } else {
    const t = (intensity - 0.66) / 0.34;
    return `rgba(6, 182, 212, ${0.65 + t * 0.35})`;
  }
}

export default function CallVolumeHeatmap() {
  const { data: cells, isLoading, isError, refetch } = useHeatmapData();

  const maxValue = useMemo(
    () => (cells?.length ? Math.max(...cells.map((c) => c.value)) : 1),
    [cells]
  );

  const cellsByDayHour = useMemo(() => {
    if (!cells) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    cells.forEach((c) => {
      map[`${c.day}-${c.hour}`] = c.value;
    });
    return map;
  }, [cells]);

  if (isLoading) return <LoadingState variant="skeleton-cards" count={1} className="h-40" />;
  if (isError) return <ErrorState title="Failed to load heatmap" onRetry={() => refetch()} />;
  if (!cells?.length)
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No heatmap data"
        description="Call volume heatmap will appear once data is available."
      />
    );

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[520px]">
        {/* Hour labels */}
        <div className="flex mb-1 ml-8">
          {HOURS.map((h, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-muted-foreground"
              style={{ minWidth: 0 }}
            >
              {i % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>

        {/* Rows per day */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-7 text-[10px] text-muted-foreground text-right pr-1 flex-shrink-0">
              {day}
            </div>
            {HOURS.map((_, hourIdx) => {
              const value = cellsByDayHour[`${dayIdx}-${hourIdx}`] ?? 0;
              const bg = getColor(value, maxValue);
              return (
                <div
                  key={hourIdx}
                  className="flex-1 aspect-square rounded-sm cursor-default transition-all duration-150 hover:ring-1 hover:ring-white/30 group relative"
                  style={{ background: bg, minWidth: 0 }}
                  title={`${day} ${HOURS[hourIdx]}: ${value} calls`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                    <div className="rounded border border-white/10 bg-slate-900/95 px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
                      {day} {HOURS[hourIdx]}: <span className="font-semibold">{value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-8">
          <span className="text-[10px] text-muted-foreground">Low</span>
          <div className="flex gap-0.5">
            {[0, 0.1, 0.25, 0.4, 0.6, 0.8, 1.0].map((t) => (
              <div
                key={t}
                className="h-2.5 w-4 rounded-sm"
                style={{ background: getColor(Math.round(t * maxValue), maxValue) }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
      </div>
    </div>
  );
}
