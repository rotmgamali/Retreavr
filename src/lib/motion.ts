import type { Variants, Transition } from "framer-motion";

// ── Page transitions ────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransition: Transition = {
  type: "tween",
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: 0.28,
};

// ── Stagger containers ──────────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

// ── Sidebar nav stagger ─────────────────────────────────────────────
export const sidebarContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

export const sidebarItem: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 26 },
  },
};

// ── Card hover ──────────────────────────────────────────────────────
export const cardHover = {
  scale: 1.02,
  boxShadow: "0 0 0 1px rgba(96,165,250,0.35), 0 8px 32px rgba(59,130,246,0.18)",
};

export const cardTap = { scale: 0.97 };

export const cardSpring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
};

// ── Button press ────────────────────────────────────────────────────
export const buttonTap = { scale: 0.97 };
export const buttonHover = { scale: 1.02 };

// ── Fade in ─────────────────────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

// ── KPI counter spring ──────────────────────────────────────────────
export const counterSpring: Transition = {
  type: "spring",
  stiffness: 80,
  damping: 18,
  mass: 0.8,
};

// ── Badge pulse ─────────────────────────────────────────────────────
export const badgePulse = {
  scale: [1, 1.08, 1],
  transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const },
};

// ── Reduced-motion helper ───────────────────────────────────────────
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
