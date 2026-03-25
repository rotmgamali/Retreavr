'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/animations/spinner'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton-cards' | 'skeleton-table' | 'skeleton-list'
  className?: string
  count?: number
  message?: string
}

export function LoadingState({
  variant = 'spinner',
  className,
  count = 3,
  message,
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
        <Spinner className="h-8 w-8" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    )
  }

  if (variant === 'skeleton-cards') {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'skeleton-table') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex gap-4">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  // skeleton-list
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
