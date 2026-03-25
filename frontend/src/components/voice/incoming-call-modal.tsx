'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface IncomingCallModalProps {
  open: boolean
  callerName: string
  callerPhone: string
  leadStatus?: string | null
  onAccept: () => void
  onDecline: () => void
  /** Auto-decline after this many seconds. Default 30. */
  timeoutSeconds?: number
}

export function IncomingCallModal({
  open,
  callerName,
  callerPhone,
  leadStatus,
  onAccept,
  onDecline,
  timeoutSeconds = 30,
}: IncomingCallModalProps) {
  const [remaining, setRemaining] = useState(timeoutSeconds)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) {
      setRemaining(timeoutSeconds)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    setRemaining(timeoutSeconds)
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          onDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [open, timeoutSeconds, onDecline])

  const statusConfig: Record<string, { variant: 'success' | 'warning' | 'info' | 'secondary'; label: string }> = {
    new: { variant: 'info', label: 'New Lead' },
    contacted: { variant: 'secondary', label: 'Contacted' },
    qualified: { variant: 'success', label: 'Qualified' },
    quoted: { variant: 'warning', label: 'Quoted' },
    bound: { variant: 'success', label: 'Customer' },
  }

  const statusInfo = leadStatus && statusConfig[leadStatus]
    ? statusConfig[leadStatus]
    : null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onDecline}
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 w-full max-w-sm mx-4"
          >
            <div className="rounded-2xl bg-[#0f172a]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
              {/* Animated rings */}
              <div className="relative flex items-center justify-center pt-10 pb-6">
                {/* Outer ring animations */}
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full border border-blue-400/20"
                    initial={{ width: 80, height: 80, opacity: 0 }}
                    animate={{
                      width: [80, 80 + i * 60],
                      height: [80, 80 + i * 60],
                      opacity: [0.6, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: 'easeOut',
                    }}
                  />
                ))}

                {/* Avatar */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="relative z-10 h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20"
                >
                  <User className="h-10 w-10 text-white" />
                </motion.div>
              </div>

              {/* Caller info */}
              <div className="text-center px-6 pb-4">
                <p className="text-xs uppercase tracking-wider text-blue-400 mb-1">Incoming Call</p>
                <h2 className="text-xl font-semibold text-white">{callerName}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{callerPhone}</p>
                {statusInfo && (
                  <Badge variant={statusInfo.variant} className="mt-2 text-[10px]">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>

              {/* Timer */}
              <div className="text-center pb-4">
                <p className="text-xs text-muted-foreground">
                  Auto-decline in{' '}
                  <span className={cn(
                    'font-mono font-semibold',
                    remaining <= 10 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {remaining}s
                  </span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 px-6 pb-6">
                <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={onDecline}
                    variant="destructive"
                    className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 gap-2"
                  >
                    <PhoneOff className="h-5 w-5" />
                    Decline
                  </Button>
                </motion.div>
                <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={onAccept}
                    className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-500 text-white gap-2"
                  >
                    <Phone className="h-5 w-5" />
                    Accept
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
