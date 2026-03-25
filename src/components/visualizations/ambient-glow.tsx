"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";

interface AmbientGlowProps {
  className?: string;
}

/**
 * Floating gradient orbs that create an ambient glow effect behind content.
 * Place as a sibling before the main content with position: relative on the parent.
 */
export function AmbientGlow({ className }: AmbientGlowProps) {
  const reduced = prefersReducedMotion();

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden -z-10", className)}
      aria-hidden="true"
    >
      {/* Blue orb */}
      <motion.div
        className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
        animate={
          reduced
            ? {}
            : { x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Teal orb */}
      <motion.div
        className="absolute top-1/3 -right-24 h-56 w-56 rounded-full bg-cyan-500/8 blur-3xl"
        animate={
          reduced
            ? {}
            : { x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Purple orb */}
      <motion.div
        className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-indigo-500/6 blur-3xl"
        animate={
          reduced
            ? {}
            : { x: [0, 25, 0], y: [0, -15, 0], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 8 }}
      />
    </div>
  );
}
