"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <motion.span
      className={cn("inline-block rounded-full border-2 border-current border-t-transparent", sizeMap[size], className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
      aria-label="Loading"
    />
  );
}
