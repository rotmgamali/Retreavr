"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Disable the hover glow/scale effect (e.g. for large layout cards) */
  noHover?: boolean;
}

export function MotionCard({ children, className, noHover, ...props }: MotionCardProps) {
  return (
    <motion.div
      whileHover={
        noHover
          ? undefined
          : {
              scale: 1.02,
              boxShadow: "0 0 0 1px rgba(96,165,250,0.35), 0 8px 32px rgba(59,130,246,0.18)",
            }
      }
      whileTap={noHover ? undefined : { scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "rounded-lg border border-white/10 bg-card text-card-foreground shadow-sm backdrop-blur-xl",
        className
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}
