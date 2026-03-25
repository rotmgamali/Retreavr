"use client";

import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { generateSparklineData } from "./mockData";

interface KPISparklineProps {
  baseValue: number;
  color?: string;
  volatility?: number;
}

export default function KPISparkline({
  baseValue,
  color = "#3b82f6",
  volatility = 0.12,
}: KPISparklineProps) {
  const data = useMemo(
    () => generateSparklineData(baseValue, volatility),
    [baseValue, volatility]
  );

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded border border-white/10 bg-slate-900/95 px-2 py-1 text-xs text-white shadow-lg">
                  {payload[0].value?.toLocaleString()}
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "transparent" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
