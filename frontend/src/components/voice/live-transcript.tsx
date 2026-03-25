'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: string
  /** true while the assistant is still speaking this segment */
  partial?: boolean
}

interface LiveTranscriptProps {
  entries: TranscriptEntry[]
  className?: string
}

export function LiveTranscript({ entries, className }: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length, entries[entries.length - 1]?.text])

  if (entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full text-sm text-muted-foreground', className)}>
        Transcript will appear here when the call starts...
      </div>
    )
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-3 p-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              'flex flex-col gap-0.5',
              entry.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {entry.role === 'user' ? 'Customer' : entry.role === 'assistant' ? 'Agent' : 'System'}
            </span>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                entry.role === 'user'
                  ? 'bg-blue-600/20 text-blue-100'
                  : entry.role === 'assistant'
                  ? 'bg-white/10 text-foreground'
                  : 'bg-yellow-500/10 text-yellow-200 text-xs italic',
                entry.partial && 'opacity-70'
              )}
            >
              {entry.text}
              {entry.partial && (
                <span className="inline-block ml-1 animate-pulse">...</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
