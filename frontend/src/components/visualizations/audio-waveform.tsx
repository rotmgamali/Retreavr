"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  /** Playback progress 0-1 */
  progress: number;
  /** Total duration in seconds (for display) */
  duration: number;
  /** Whether audio is currently playing */
  isPlaying?: boolean;
  /** Number of waveform bars */
  bars?: number;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioWaveform({
  progress,
  duration,
  isPlaying = false,
  bars = 48,
  className,
}: AudioWaveformProps) {
  // Generate deterministic "waveform" heights from a seed pattern
  const heights = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < bars; i++) {
      // Pseudo-random using sine
      const v = Math.abs(Math.sin(i * 1.7 + 0.3) * Math.cos(i * 0.9 + 2.1));
      result.push(0.15 + v * 0.85);
    }
    return result;
  }, [bars]);

  const filledBars = Math.floor(progress * bars);
  const currentTime = progress * duration;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Waveform bars */}
      <div
        className="flex items-center gap-[1.5px] h-10 cursor-pointer"
        role="slider"
        aria-label="Audio playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {heights.map((h, i) => (
          <motion.span
            key={i}
            className={cn(
              "w-[2px] rounded-full",
              i <= filledBars ? "bg-blue-400" : "bg-white/20"
            )}
            style={{ height: `${h * 100}%` }}
            animate={
              isPlaying && i === filledBars
                ? { opacity: [0.6, 1, 0.6] }
                : { opacity: 1 }
            }
            transition={
              isPlaying && i === filledBars
                ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                : {}
            }
          />
        ))}
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-white/50 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
