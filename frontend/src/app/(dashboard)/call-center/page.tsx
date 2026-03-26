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
import { useCallHistory, useQueuedCalls } from '@/hooks/use-call-history'
import { useDashboardEvents, type ActiveCallWS } from '@/hooks/use-dashboard-events'
import { useDashboardKPIs } from '@/hooks/use-analytics'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useCallMonitor, type MonitorMode } from '@/hooks/use-call-monitor'
import type { Call } from '@/lib/api-types'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'

// ── Types ────────────────────────────────────────────────────────────────────

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

function mapCallToQueueItem(call: Call): QueueItem {
  const waitMs = Date.now() - new Date(call.created_at).getTime()
  return {
    id: call.id,
    callerName: call.phone_from || 'Unknown',
    callerPhone: call.phone_from || '',
    waitTime: Math.max(0, Math.floor(waitMs / 1000)),
    priority: 'medium',
    reason: call.direction === 'inbound' ? 'Inbound call' : 'Outbound call',
  }
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

interface ActiveCallCardProps {
  call: ActiveCallWS & { displayDuration: number }
  isMonitored: boolean
  monitorMode: MonitorMode | null
  onListen: () => void
  onWhisper: () => void
  onTakeover: () => void
  onStopMonitor: () => void
}

function ActiveCallCard({ call, isMonitored, monitorMode, onListen, onWhisper, onTakeover, onStopMonitor }: ActiveCallCardProps) {
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
            {isMonitored && (
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded capitalize">
                {monitorMode === 'listen_in' ? 'Listening' : monitorMode}
              </span>
            )}
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
            <span className="font-mono">{formatDuration(call.displayDuration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-slate-400">Agent: <span className="text-foreground/70">{call.agent}</span></span>
        <span className={`${sentiment.color} ${sentiment.bg} px-1.5 py-0.5 rounded text-[10px]`}>
          {sentiment.label}
        </span>
      </div>

      {call.topic && <p className="text-xs text-slate-500 mb-3">{call.topic}</p>}

      <div className="flex gap-1.5 pt-2 border-t border-white/5">
        <Button
          size="sm"
          variant={isMonitored && monitorMode === 'listen_in' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs gap-1 flex-1"
          onClick={onListen}
        >
          <Ear className="h-3 w-3" />
          Listen
        </Button>
        <Button
          size="sm"
          variant={isMonitored && monitorMode === 'whisper' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs gap-1 flex-1"
          onClick={onWhisper}
        >
          <MessageSquare className="h-3 w-3" />
          Whisper
        </Button>
        <Button
          size="sm"
          variant={isMonitored && monitorMode === 'takeover' ? 'default' : 'outline'}
          className="h-7 px-2 text-xs gap-1 flex-1"
          onClick={onTakeover}
        >
          <Hand className="h-3 w-3" />
          Takeover
        </Button>
        {isMonitored ? (
          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={onStopMonitor}>
            <WifiOff className="h-3 w-3" />
          </Button>
        ) : (
          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled>
            <PhoneOff className="h-3 w-3" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CallCenterPage() {
  const loading = usePageLoading(600)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [showDialer, setShowDialer] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{
    open: boolean
    callerName: string
    callerPhone: string
    leadStatus?: string
  }>({ open: false, callerName: '', callerPhone: '' })

  const { data: currentUser } = useCurrentUser()
  const orgId = currentUser?.organization_id ?? null

  const { activeCalls, isConnected: wsConnected } = useDashboardEvents(orgId)
  const { data: queueData } = useQueuedCalls()
  const { data: kpiData } = useDashboardKPIs()
  const callMonitor = useCallMonitor()

  const voiceCall = useVoiceCall()
  const { data: agentsData } = useAgents({ limit: 50 })
  const { data: callHistoryData } = useCallHistory({ limit: 10 })

  // Build queue from REST data
  const queue: QueueItem[] = (queueData?.items ?? []).map(mapCallToQueueItem)

  // Map agent data for dialer
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

  // Duration timer for active calls
  useEffect(() => {
    const initial: Record<string, number> = {}
    activeCalls.forEach(c => { initial[c.id] = c.duration })
    setDurations(prev => {
      const next = { ...prev }
      activeCalls.forEach(c => {
        if (!(c.id in next)) next[c.id] = c.duration
      })
      // Remove entries for calls that ended
      const activeIds = new Set(activeCalls.map(c => c.id))
      Object.keys(next).forEach(id => { if (!activeIds.has(id)) delete next[id] })
      return next
    })
  }, [activeCalls])

  useEffect(() => {
    if (activeCalls.length === 0) return
    const interval = setInterval(() => {
      setDurations(prev => {
        const next = { ...prev }
        activeCalls.forEach(c => {
          if (c.status !== 'ringing') next[c.id] = (next[c.id] ?? 0) + 1
        })
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activeCalls])

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

  const activeCount = activeCalls.filter(c => c.status === 'connected').length

  return (
    <SkeletonToContent loading={loading} skeleton={<CallCenterSkeleton />}>
    <ErrorBoundary>
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
          <div className={`flex items-center gap-1.5 ${wsConnected ? 'text-green-400' : 'text-slate-500'}`}>
            {wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="font-semibold">{activeCount}</span>
          </div>
          <span className="text-muted-foreground">active calls</span>
        </div>
        <div className="text-white/10">|</div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Phone className="h-4 w-4" />
            <span className="font-semibold">{kpiData?.total_calls ?? '—'}</span>
          </div>
          <span className="text-muted-foreground">today</span>
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
                  onSaveNotes={(notes) => {
                    const leadId = voiceCall.callSummary?.callId
                    if (leadId) {
                      api.post(`/leads/${leadId}/interactions`, {
                        interaction_type: 'note',
                        notes: notes,
                      }).then(() => toast.success('Notes saved'))
                        .catch(() => toast.error('Failed to save notes'))
                    } else {
                      toast.error('No call ID available to save notes')
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Active Calls
                <span className="text-xs text-muted-foreground font-normal">
                  {wsConnected ? 'Live' : 'Connecting…'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCalls.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Phone className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">No active calls</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <AnimatePresence>
                    {activeCalls.map(call => (
                      <ActiveCallCard
                        key={call.id}
                        call={{ ...call, displayDuration: durations[call.id] ?? call.duration }}
                        isMonitored={callMonitor.activeCallId === call.id && callMonitor.isConnected}
                        monitorMode={callMonitor.activeCallId === call.id ? callMonitor.mode : null}
                        onListen={() => callMonitor.setMode(call.id, 'listen_in')}
                        onWhisper={() => callMonitor.setMode(call.id, 'whisper')}
                        onTakeover={() => callMonitor.setMode(call.id, 'takeover')}
                        onStopMonitor={() => callMonitor.disconnect()}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
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
                      <Button size="sm" className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-500" onClick={() => {
                        const defaultAgent = agentOptions[0]
                        if (!defaultAgent) {
                          toast.error('No agents available to take the call')
                          return
                        }
                        voiceCall.startCall(item.callerPhone, defaultAgent.id, { direction: 'inbound' })
                        toast.success(`Picking up call from ${item.callerName}`)
                      }}>
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

          {/* Today's stats card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Today&apos;s Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kpiData ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total calls</span>
                    <span className="font-semibold">{kpiData.total_calls}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Conversion rate</span>
                    <span className="font-semibold text-green-400">{(kpiData.conversion_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg duration</span>
                    <span className="font-semibold">{formatDuration(Math.round(kpiData.avg_call_duration))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Active leads</span>
                    <span className="font-semibold">{kpiData.active_leads}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 text-center py-2">Loading stats…</p>
              )}
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
    </ErrorBoundary>
    </SkeletonToContent>
  )
}
