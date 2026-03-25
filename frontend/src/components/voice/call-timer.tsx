'use client'

import { useEffect, useState } from 'react'

interface CallTimerProps {
  /** ISO timestamp when the call started. Null = not started. */
  startedAt: string | null
  /** Whether the call is currently active. */
  active: boolean
  className?: string
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function CallTimer({ startedAt, active, className }: CallTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active || !startedAt) {
      setElapsed(0)
      return
    }

    const start = new Date(startedAt).getTime()

    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [active, startedAt])

  return (
    <span className={className ?? 'text-sm tabular-nums text-muted-foreground'}>
      {formatDuration(elapsed)}
    </span>
  )
}
