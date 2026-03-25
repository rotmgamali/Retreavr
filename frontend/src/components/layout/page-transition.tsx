"use client";

import { motion, type Variants } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const easing = [0.25, 0.1, 0.25, 1] as [number, number, number, number];

const variants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: easing },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: easing },
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}
