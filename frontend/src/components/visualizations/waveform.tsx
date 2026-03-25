"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";

interface WaveformProps {
  /** Whether the waveform is actively animating */
  isActive?: boolean;
  /** Visual variant */
  variant?: "default" | "accent" | "muted";
  /** Number of bars (8-12 recommended) */
  bars?: number;
  className?: string;
}

const variantColors = {
  default: "bg-blue-400",
  accent: "bg-cyan-400",
  muted: "bg-white/30",
};

export function Waveform({
  isActive = true,
  variant = "default",
  bars = 10,
  className,
}: WaveformProps) {
  const reduced = prefersReducedMotion();

  return (
    <div
      className={cn("flex items-end gap-[2px]", className)}
      role="img"
      aria-label={isActive ? "Audio active" : "Audio idle"}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const minH = 0.15;
        const maxH = 0.4 + Math.sin(phase) * 0.35;

        return (
          <motion.span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              isActive ? variantColors[variant] : "bg-white/15"
            )}
            animate={
              isActive && !reduced
                ? {
                    scaleY: [minH, maxH, minH],
                    opacity: [0.7, 1, 0.7],
                  }
                : { scaleY: minH, opacity: 0.4 }
            }
            transition={
              isActive && !reduced
                ? {
                    duration: 0.8 + Math.random() * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.06,
                  }
                : { duration: 0.3 }
            }
            style={{ height: 24, transformOrigin: "bottom" }}
          />
        );
      })}
    </div>
  );
}
