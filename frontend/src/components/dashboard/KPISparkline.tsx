"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

export interface SparklinePoint {
  day: string;
  value: number;
}

interface KPISparklineProps {
  data: SparklinePoint[];
  color?: string;
}

export default function KPISparkline({ data, color = "#3b82f6" }: KPISparklineProps) {
  if (!data.length) return <div className="h-10 w-24" />;

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
