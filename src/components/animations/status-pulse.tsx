"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type StatusType = "active" | "available" | "paused" | "idle";

const colorMap: Record<StatusType, string> = {
  active: "bg-green-400",
  available: "bg-blue-400",
  paused: "bg-yellow-400",
  idle: "bg-white/30",
};

const glowMap: Record<StatusType, string> = {
  active: "rgba(74,222,128,0.6)",
  available: "rgba(96,165,250,0.6)",
  paused: "rgba(250,204,21,0.6)",
  idle: "rgba(255,255,255,0.2)",
};

interface StatusPulseProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusPulse({ status, size = "md", className }: StatusPulseProps) {
  const isLive = status === "active";

  const sizeClass = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3.5 w-3.5",
  }[size];

  return (
    <span className={cn("relative inline-flex items-center justify-center shrink-0", className)}>
      {/* Outer ping ring — only for active/live state */}
      {isLive && (
        <motion.span
          className={cn("absolute rounded-full", colorMap[status])}
          style={{ width: "100%", height: "100%", opacity: 0.5 }}
          animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {/* Core dot */}
      <motion.span
        className={cn("rounded-full", sizeClass, colorMap[status])}
        style={{ boxShadow: `0 0 6px ${glowMap[status]}` }}
        animate={
          isLive
            ? { boxShadow: [`0 0 4px ${glowMap[status]}`, `0 0 12px ${glowMap[status]}`] }
            : {}
        }
        transition={isLive ? { duration: 1.4, repeat: Infinity, repeatType: "reverse" } : {}}
      />
    </span>
  );
}
