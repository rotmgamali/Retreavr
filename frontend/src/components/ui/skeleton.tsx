"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn("relative overflow-hidden rounded-md bg-white/8", className)}
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
        }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
    </motion.div>
  );
}

/** Pre-built skeleton for a KPI card */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-card p-6 space-y-3 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

/** Pre-built skeleton for a list row */
export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
          <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
