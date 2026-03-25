'use client'

import { useState, useEffect } from 'react'
import { SkeletonToContent } from '@/components/animations'
import { CallCenterSkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { Phone, PhoneOff, Ear, MessageSquare, Hand, Clock, Wifi, WifiOff, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveCall {
  id: string
  callerName: string
  callerPhone: string
  agent: string
  status: 'ringing' | 'connected' | 'on-hold'
  duration: number // seconds
  sentiment: 'positive' | 'neutral' | 'negative'
  topic: string
  waveform: number[]
}

interface QueueItem {
  id: string
  callerName: string
  callerPhone: string
  waitTime: number // seconds
  priority: 'high' | 'medium' | 'low'
  reason: string
}

// ── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_CALLS: ActiveCall[] = [
  {
    id: 'c1', callerName: 'James Wilson', callerPhone: '(555) 123-4567',
    agent: 'Sarah AI', status: 'connected', duration: 187, sentiment: 'positive',
    topic: 'Auto Quote Inquiry',
    waveform: Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.1),
  },
  {
    id: 'c2', callerName: 'Maria Garcia', callerPhone: '(555) 234-5678',
    agent: 'Mike AI', status: 'connected', duration: 342, sentiment: 'neutral',
    topic: 'Claims Follow-up',
    waveform: Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.1),
  },
  {
    id: 'c3', callerName: 'Robert Chen', callerPhone: '(555) 345-6789',
    agent: 'Alex AI', status: 'ringing', duration: 8, sentiment: 'neutral',
    topic: 'Inbound - New Lead',
    waveform: Array.from({ length: 30 }, () => 0.05),
  },
  {
    id: 'c4', callerName: 'Emily Brown', callerPhone: '(555) 456-7890',
    agent: 'Sarah AI', status: 'connected', duration: 523, sentiment: 'negative',
    topic: 'Policy Cancellation Request',
    waveform: Array.from({ length: 30 }, () => Math.random() * 0.6 + 0.2),
  },
  {
    id: 'c5', callerName: 'David Kim', callerPhone: '(555) 567-8901',
    agent: 'Jordan AI', status: 'on-hold', duration: 91, sentiment: 'neutral',
    topic: 'Transferring to Specialist',
    waveform: Array.from({ length: 30 }, () => 0.02),
  },
]

const INITIAL_QUEUE: QueueItem[] = [
  { id: 'q1', callerName: 'Patricia Moore', callerPhone: '(555) 678-9012', waitTime: 45, priority: 'high', reason: 'Urgent claim' },
  { id: 'q2', callerName: 'Thomas Anderson', callerPhone: '(555) 789-0123', waitTime: 23, priority: 'medium', reason: 'Quote request' },
  { id: 'q3', callerName: 'Lisa Wang', callerPhone: '(555) 890-1234', waitTime: 12, priority: 'low', reason: 'General inquiry' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SENTIMENT_CONFIG = {
  positive: { color: 'text-green-400', bg: 'bg-green-400/10', label: 'Positive' },
  neutral: { color: 'text-slate-400', bg: 'bg-slate-400/10', label: 'Neutral' },
  negative: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Negative' },
} as const

const STATUS_CONFIG = {
  ringing: { color: 'bg-amber-400', label: 'Ringing', badge: 'warning' as const },
  connected: { color: 'bg-green-400', label: 'Connected', badge: 'success' as const },
  'on-hold': { color: 'bg-purple-400', label: 'On Hold', badge: 'info' as const },
}

const PRIORITY_CONFIG = {
  high: { badge: 'destructive' as const },
  medium: { badge: 'warning' as const },
  low: { badge: 'secondary' as const },
}

// ── Waveform visualization ───────────────────────────────────────────────────

function Waveform({ data, active }: { data: number[]; active: boolean }) {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all ${
            active ? 'bg-blue-400/70' : 'bg-slate-600/40'
          }`}
          style={{
            height: `${Math.max(4, v * 32)}px`,
            animationDelay: active ? `${i * 50}ms` : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ── Active call card ─────────────────────────────────────────────────────────

function ActiveCallCard({ call }: { call: ActiveCall }) {
  const status = STATUS_CONFIG[call.status]
  const sentiment = SENTIMENT_CONFIG[call.sentiment]

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${status.color} ${call.status === 'ringing' ? 'animate-pulse' : ''}`} />
            <p className="text-sm font-medium">{call.callerName}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{call.callerPhone}</p>
        </div>
        <Badge variant={status.badge} className="text-[10px]">{status.label}</Badge>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <Waveform data={call.waveform} active={call.status === 'connected'} />
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{formatDuration(call.duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-slate-400">Agent: <span className="text-foreground/70">{call.agent}</span></span>
        <span className={`${sentiment.color} ${sentiment.bg} px-1.5 py-0.5 rounded text-[10px]`}>
          {sentiment.label}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-3">{call.topic}</p>

      {/* Action buttons */}
      <div className="flex gap-1.5 pt-2 border-t border-white/5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 flex-1">
          <Ear className="h-3 w-3" />
          Listen
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 flex-1">
          <MessageSquare className="h-3 w-3" />
          Whisper
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 flex-1">
          <Hand className="h-3 w-3" />
          Takeover
        </Button>
        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs">
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CallCenterPage() {
  const loading = usePageLoading(600)
  const [calls] = useState<ActiveCall[]>(INITIAL_CALLS)
  const [queue] = useState<QueueItem[]>(INITIAL_QUEUE)
  const [durations, setDurations] = useState<Record<string, number>>({})

  // Simulate live timer
  useEffect(() => {
    const initial: Record<string, number> = {}
    calls.forEach(c => { initial[c.id] = c.duration })
    setDurations(initial)

    const interval = setInterval(() => {
      setDurations(prev => {
        const next = { ...prev }
        calls.forEach(c => {
          if (c.status !== 'ringing') next[c.id] = (next[c.id] ?? c.duration) + 1
        })
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [calls])

  const activeCalls = calls.filter(c => c.status === 'connected').length
  const totalCalls = calls.length

  return (
    <SkeletonToContent loading={loading} skeleton={<CallCenterSkeleton />}>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Call Center</h1>
        <p className="text-muted-foreground mt-1">Live call monitoring with listen-in, whisper, and takeover</p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-green-400">
            <Wifi className="h-4 w-4" />
            <span className="font-semibold">{activeCalls}</span>
          </div>
          <span className="text-muted-foreground">active calls</span>
        </div>
        <div className="text-white/10">|</div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Phone className="h-4 w-4" />
            <span className="font-semibold">{totalCalls}</span>
          </div>
          <span className="text-muted-foreground">total calls</span>
        </div>
        <div className="text-white/10">|</div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Users className="h-4 w-4" />
            <span className="font-semibold">{queue.length}</span>
          </div>
          <span className="text-muted-foreground">in queue</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active calls grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Active Calls
                <span className="text-xs text-muted-foreground font-normal">Auto-refreshing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {calls.map(call => (
                  <ActiveCallCard
                    key={call.id}
                    call={{ ...call, duration: durations[call.id] ?? call.duration }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue panel */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Queue
                <Badge variant="warning" className="text-[10px]">{queue.length} waiting</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queue.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-medium">{item.callerName}</p>
                      <p className="text-xs text-slate-500">{item.callerPhone}</p>
                    </div>
                    <Badge variant={PRIORITY_CONFIG[item.priority].badge} className="text-[10px] capitalize">
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{item.reason}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Waiting {formatDuration(item.waitTime)}
                    </span>
                    <Button size="sm" className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-500">
                      <Phone className="h-3 w-3 mr-1" />
                      Pick Up
                    </Button>
                  </div>
                </div>
              ))}

              {queue.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <WifiOff className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">No calls in queue</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Today&apos;s Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Total Calls', value: '247', change: '+12%' },
                { label: 'Avg Wait Time', value: '0:18', change: '-23%' },
                { label: 'Avg Call Duration', value: '4:32', change: '+5%' },
                { label: 'Resolution Rate', value: '94%', change: '+2%' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-400">{stat.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{stat.value}</span>
                    <span className={`text-[10px] ${stat.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </SkeletonToContent>
  )
}
