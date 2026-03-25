"use client";

import { useMemo } from "react";
import { generateFunnelData } from "./mockData";

export default function ConversionFunnel() {
  const data = useMemo(() => generateFunnelData(), []);
  const max = data[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {data.map((item, idx) => {
        const dropPct =
          idx > 0
            ? Math.round((1 - item.count / data[idx - 1].count) * 100)
            : null;
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
          {Math.round((data[data.length - 1].count / max) * 100)}%
        </span>
      </div>
    </div>
  );
}
