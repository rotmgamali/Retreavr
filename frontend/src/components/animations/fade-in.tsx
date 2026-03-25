'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface FadeInProps {
  show: boolean
  children: React.ReactNode
  className?: string
  /** Duration in seconds */
  duration?: number
  /** Vertical slide offset in px (0 = fade only) */
  y?: number
}

/**
 * Wraps content in an AnimatePresence fade+slide.
 * Use with `show` toggled from skeleton → real content.
 */
export function FadeIn({ show, children, className = '', duration = 0.3, y = 10 }: FadeInProps) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          key="content"
          className={className}
          initial={{ opacity: 0, y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -y / 2 }}
          transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Shows `skeleton` while loading, then cross-fades to `children`.
 * Prevents layout shift: both render at the same DOM level.
 */
export function SkeletonToContent({
  loading,
  skeleton,
  children,
  duration = 0.35,
}: {
  loading: boolean
  skeleton: React.ReactNode
  children: React.ReactNode
  duration?: number
}) {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration * 0.6 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
