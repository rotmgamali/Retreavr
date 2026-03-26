'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SkeletonToContent } from '@/components/animations'
import { CallCenterSkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { Phone, PhoneOff, Ear, MessageSquare, Hand, Clock, Wifi, WifiOff, Users, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OutboundDialer } from '@/components/voice/outbound-dialer'
import { IncomingCallModal } from '@/components/voice/incoming-call-modal'
import { CallSummaryPanel } from '@/components/voice/call-summary-panel'
import { useVoiceCall } from '@/hooks/use-voice-call'
import { useAgents } from '@/hooks/use-agents'
import { useCallHistory } from '@/hooks/use-call-history'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveCall {
  id: string
  callerName: string
  callerPhone: string
  agent: string
  status: 'ringing' | 'connected' | 'on-hold'
  duration: number
  sentiment: 'positive' | 'neutral' | 'negative'
  topic: string
  waveform: number[]
}

interface QueueItem {
  id: string
  callerName: string
  callerPhone: string
  waitTime: number
  priority: 'high' | 'medium' | 'low'
  reason: string
}

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
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${
            active ? 'bg-blue-400/70' : 'bg-slate-600/40'
          }`}
          animate={{
            height: `${Math.max(4, v * 32)}px`,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors"
    >
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
    </motion.div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CallCenterPage() {
  const loading = usePageLoading(600)
  const [calls] = useState<ActiveCall[]>([])
  const [queue] = useState<QueueItem[]>([])
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [showDialer, setShowDialer] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{
    open: boolean
    callerName: string
    callerPhone: string
    leadStatus?: string
  }>({ open: false, callerName: '', callerPhone: '' })

  const voiceCall = useVoiceCall()
  const { data: agentsData } = useAgents({ limit: 50 })
  const { data: callHistoryData } = useCallHistory({ limit: 10 })

  // Map agent data for dialer — cast status from API union to component union
  const agentOptions = (agentsData?.items ?? [])
    .filter(a => a.status !== 'training')
    .map(a => ({
      id: a.id,
      name: a.name,
      voice: a.voice,
      status: a.status as 'active' | 'inactive' | 'draft',
    })) satisfies { id: string; name: string; voice: string; status: 'active' | 'inactive' | 'draft' }[]

  // Map recent calls for dialer
  const recentCalls = (callHistoryData?.items ?? []).map(c => ({
    id: c.id,
    contactName: c.phone_to ?? 'Unknown',
    phone: c.phone_to ?? '',
    timestamp: c.created_at,
    duration: c.duration ?? 0,
  }))

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

  const handleDial = useCallback((phoneNumber: string, agentId: string) => {
    voiceCall.startCall(phoneNumber, agentId, { direction: 'outbound' })
    setShowDialer(false)
  }, [voiceCall])

  const handleAcceptIncoming = useCallback(() => {
    setIncomingCall(prev => ({ ...prev, open: false }))
  }, [])

  const handleDeclineIncoming = useCallback(() => {
    setIncomingCall(prev => ({ ...prev, open: false }))
  }, [])

  const activeCalls = calls.filter(c => c.status === 'connected').length
  const totalCalls = calls.length

  return (
    <SkeletonToContent loading={loading} skeleton={<CallCenterSkeleton />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Center</h1>
          <p className="text-muted-foreground mt-1">Live call monitoring with listen-in, whisper, and takeover</p>
        </div>
        <Button
          onClick={() => setShowDialer(!showDialer)}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          New Call
        </Button>
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
        {voiceCall.callState !== 'idle' && (
          <>
            <div className="text-white/10">|</div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-purple-400">
                <Phone className="h-4 w-4" />
                <span className="font-semibold capitalize">{voiceCall.callState}</span>
              </div>
              <span className="text-muted-foreground">your call</span>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active calls grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Outbound Dialer (expandable) */}
          <AnimatePresence>
            {showDialer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <OutboundDialer
                  agents={agentOptions}
                  recentCalls={recentCalls}
                  isLoading={voiceCall.callState === 'connecting'}
                  onDial={handleDial}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Call summary after call ends */}
          <AnimatePresence>
            {voiceCall.callState === 'ended' && voiceCall.callSummary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <CallSummaryPanel
                  summary={voiceCall.callSummary}
                  onClose={() => voiceCall.resetCall()}
                  onSaveNotes={() => {}}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Active Calls
                <span className="text-xs text-muted-foreground font-normal">Auto-refreshing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <AnimatePresence>
                  {calls.map(call => (
                    <ActiveCallCard
                      key={call.id}
                      call={{ ...call, duration: durations[call.id] ?? call.duration }}
                    />
                  ))}
                </AnimatePresence>
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
              <AnimatePresence>
                {queue.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
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
                  </motion.div>
                ))}
              </AnimatePresence>

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
              <p className="text-xs text-slate-500 text-center py-2">
                Live stats load from the analytics dashboard
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    {/* Incoming call modal */}
    <IncomingCallModal
      open={incomingCall.open}
      callerName={incomingCall.callerName}
      callerPhone={incomingCall.callerPhone}
      leadStatus={incomingCall.leadStatus}
      onAccept={handleAcceptIncoming}
      onDecline={handleDeclineIncoming}
    />
    </SkeletonToContent>
  )
}
