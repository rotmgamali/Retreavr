"use client";

import { useMemo } from "react";
import { useConversionFunnel } from "@/hooks/use-analytics";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Filter } from "lucide-react";

const FUNNEL_COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#22c55e"];

export default function ConversionFunnel() {
  const { data: raw, isLoading, isError, refetch } = useConversionFunnel();

  const data = useMemo(() => {
    if (!raw?.length) return [];
    const max = raw[0].count;
    return raw.map((item, i) => ({
      ...item,
      pct: max > 0 ? (item.count / max) * 100 : 0,
      color: FUNNEL_COLORS[i] ?? "#6b7280",
    }));
  }, [raw]);

  if (isLoading) return <LoadingState variant="skeleton-list" count={4} />;
  if (isError) return <ErrorState title="Failed to load funnel" onRetry={() => refetch()} />;
  if (!data.length) return <EmptyState icon={Filter} title="No funnel data" description="Conversion funnel will appear once calls are recorded." />;

  const max = data[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {data.map((item, idx) => {
        const dropPct =
          idx > 0 ? Math.round((1 - item.count / data[idx - 1].count) * 100) : null;
        return (
          <div key={item.stage}>
            <div className="flex justify-between items-center text-sm mb-1.5">
              <span className="font-medium">{item.stage}</span>
              <div className="flex items-center gap-2">
                {dropPct !== null && (
                  <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                    -{dropPct}%
                  </span>
                )}
                <span className="text-muted-foreground font-mono">
                  {item.count.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
                  boxShadow: `0 0 8px ${item.color}66`,
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t border-white/5 flex justify-between text-xs text-muted-foreground">
        <span>Overall conversion</span>
        <span className="text-green-400 font-semibold">
          {max > 0 ? Math.round((data[data.length - 1].count / max) * 100) : 0}%
        </span>
      </div>
    </div>
  );
}
