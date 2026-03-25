"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useInView } from "framer-motion";
import { counterSpring, prefersReducedMotion } from "@/lib/motion";

interface AnimatedCounterProps {
  /** Target value to animate to (raw number) */
  value: number;
  /** Format function applied to the animated number for display */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Animates a number counting up from 0 when it enters the viewport.
 * Respects prefers-reduced-motion.
 */
export function AnimatedCounter({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, counterSpring);
  const [display, setDisplay] = useState(format(0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(format(value));
      return;
    }
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, value, motionVal, format]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setDisplay(format(v));
    });
    return unsubscribe;
  }, [spring, format]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
