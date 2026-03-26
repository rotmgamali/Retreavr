'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Headphones,
  Mic,
  PhoneForwarded,
  Phone,
  PhoneOff,
  Users,
  Radio,
  Eye,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboardEvents, type ActiveCallWS } from '@/hooks/use-dashboard-events'
import { useCallMonitor, type MonitorMode } from '@/hooks/use-call-monitor'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toast } from 'sonner'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const MODE_CONFIG: Record<MonitorMode, { label: string; icon: typeof Headphones; color: string; bg: string; description: string }> = {
  listen_in: {
    label: 'Listening',
    icon: Headphones,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    description: 'You can hear the call but neither party can hear you',
  },
  whisper: {
    label: 'Whispering',
    icon: Mic,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    description: 'The agent can hear you but the caller cannot',
  },
  takeover: {
    label: 'Takeover',
    icon: PhoneForwarded,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    description: 'You are speaking directly to the caller',
  },
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-green-400',
  neutral: 'bg-slate-400',
  negative: 'bg-red-400',
}

// ── Active Call Card ─────────────────────────────────────────────────────────

function ActiveCallCard({
  call,
  isMonitored,
  onListen,
  onWhisper,
  onTakeover,
}: {
  call: ActiveCallWS & { liveDuration: number }
  isMonitored: boolean
  onListen: () => void
  onWhisper: () => void
  onTakeover: () => void
}) {
  return (
    <Card className={`glass-card transition-all ${isMonitored ? 'ring-1 ring-blue-500/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <Phone className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm">{call.agent}</CardTitle>
              <p className="text-xs text-muted-foreground">{call.callerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMonitored && (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                <Eye className="h-3 w-3 mr-1" />
                Monitored
              </Badge>
            )}
            <Badge
              variant={call.status === 'connected' ? 'success' : call.status === 'ringing' ? 'warning' : 'secondary'}
              className="capitalize text-[10px]"
            >
              {call.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-xs font-mono truncate">{call.callerPhone || '--'}</p>
          </div>
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-semibold tabular-nums">{formatDuration(call.liveDuration)}</p>
          </div>
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Sentiment</p>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className={`h-2 w-2 rounded-full ${SENTIMENT_DOT[call.sentiment] ?? SENTIMENT_DOT.neutral}`} />
              <span className="text-xs capitalize">{call.sentiment}</span>
            </div>
          </div>
        </div>

        {call.topic && (
          <p className="text-xs text-muted-foreground truncate">
            Topic: <span className="text-foreground/70">{call.topic}</span>
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            onClick={onListen}
          >
            <Headphones className="h-3.5 w-3.5" />
            Listen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            onClick={onWhisper}
          >
            <Mic className="h-3.5 w-3.5" />
            Whisper
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={onTakeover}
          >
            <PhoneForwarded className="h-3.5 w-3.5" />
            Takeover
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Monitoring Panel ─────────────────────────────────────────────────────────

function MonitoringPanel({
  callId,
  callInfo,
  mode,
  isConnected,
  onSetMode,
  onDisconnect,
}: {
  callId: string
  callInfo: (ActiveCallWS & { liveDuration: number }) | undefined
  mode: MonitorMode | null
  isConnected: boolean
  onSetMode: (mode: MonitorMode) => void
  onDisconnect: () => void
}) {
  const modeConfig = mode ? MODE_CONFIG[mode] : null

  return (
    <Card className="glass-card border-blue-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-lg p-2 ${modeConfig?.bg ?? 'bg-white/10'}`}>
              {modeConfig ? <modeConfig.icon className={`h-4 w-4 ${modeConfig.color}`} /> : <Radio className="h-4 w-4" />}
            </div>
            <div>
              <CardTitle className="text-sm">
                {isConnected ? `${modeConfig?.label ?? 'Connected'}` : 'Connecting...'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {callInfo ? `${callInfo.agent} - ${callInfo.callerName}` : `Call ${callId.slice(0, 8)}...`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-[10px]">
                <WifiOff className="h-3 w-3 mr-1" />
                Connecting
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {modeConfig && (
          <p className="text-xs text-muted-foreground">{modeConfig.description}</p>
        )}

        {callInfo && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">{formatDuration(callInfo.liveDuration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{callInfo.callerPhone || 'Unknown'}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {(Object.entries(MODE_CONFIG) as [MonitorMode, typeof MODE_CONFIG[MonitorMode]][]).map(([key, cfg]) => (
            <Button
              key={key}
              variant={mode === key ? 'default' : 'outline'}
              size="sm"
              className={
                mode === key
                  ? `flex-1 gap-1.5 text-xs ${cfg.bg} ${cfg.color} border-0`
                  : `flex-1 gap-1.5 text-xs`
              }
              onClick={() => onSetMode(key)}
              disabled={!isConnected}
            >
              <cfg.icon className="h-3.5 w-3.5" />
              {cfg.label}
            </Button>
          ))}
        </div>

        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-1.5"
          onClick={onDisconnect}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SupervisionPage() {
  const { data: currentUser } = useCurrentUser()
  const orgId = currentUser?.organization_id ?? null
  const { activeCalls, agents, isConnected: wsConnected } = useDashboardEvents(orgId)
  const { activeCallId, mode, isConnected: monitorConnected, monitor, disconnect, setMode } = useCallMonitor()

  // Live duration timers
  const [durations, setDurations] = useState<Record<string, number>>({})

  useEffect(() => {
    // Initialize durations for new calls
    setDurations((prev) => {
      const next = { ...prev }
      for (const call of activeCalls) {
        if (!(call.id in next)) {
          next[call.id] = call.duration
        }
      }
      // Remove ended calls
      for (const id of Object.keys(next)) {
        if (!activeCalls.some((c) => c.id === id)) {
          delete next[id]
        }
      }
      return next
    })
  }, [activeCalls])

  useEffect(() => {
    if (activeCalls.length === 0) return
    const interval = setInterval(() => {
      setDurations((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          next[id] = (next[id] ?? 0) + 1
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activeCalls.length])

  const handleMonitor = useCallback(
    (callId: string, monitorMode: MonitorMode) => {
      monitor(callId, monitorMode)
      const modeLabel = MODE_CONFIG[monitorMode].label
      toast.success(`${modeLabel} mode activated`)
    },
    [monitor]
  )

  const handleSetMode = useCallback(
    (newMode: MonitorMode) => {
      if (activeCallId) {
        setMode(activeCallId, newMode)
        toast.info(`Switched to ${MODE_CONFIG[newMode].label} mode`)
      }
    },
    [activeCallId, setMode]
  )

  const handleDisconnect = useCallback(() => {
    disconnect()
    toast.info('Monitoring disconnected')
  }, [disconnect])

  const callsWithDuration = activeCalls.map((call) => ({
    ...call,
    liveDuration: durations[call.id] ?? call.duration,
  }))

  const onlineAgentCount = agents.filter(
    (a) => a.status === 'On Call' || a.status === 'Available'
  ).length

  const monitoredCallInfo = activeCallId
    ? callsWithDuration.find((c) => c.id === activeCallId)
    : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Call Supervision</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage active calls in real-time
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-blue-500/20 p-2.5">
              <Phone className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCalls.length}</p>
              <p className="text-xs text-muted-foreground">Active Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-green-500/20 p-2.5">
              <Users className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineAgentCount}</p>
              <p className="text-xs text-muted-foreground">Agents Online</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-purple-500/20 p-2.5">
              <Headphones className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{activeCallId ? 1 : 0}</p>
              <p className="text-xs text-muted-foreground">Being Monitored</p>
            </div>
            {!wsConnected && (
              <Badge variant="outline" className="ml-auto border-yellow-500/30 text-yellow-400 text-[10px]">
                <WifiOff className="h-3 w-3 mr-1" />
                WS Offline
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Monitoring Panel */}
      {activeCallId && (
        <MonitoringPanel
          callId={activeCallId}
          callInfo={monitoredCallInfo}
          mode={mode}
          isConnected={monitorConnected}
          onSetMode={handleSetMode}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Active Calls Grid */}
      {activeCalls.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">No active calls</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Active calls will appear here in real-time
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Active Calls
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({activeCalls.length})
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {callsWithDuration.map((call) => (
              <ActiveCallCard
                key={call.id}
                call={call}
                isMonitored={activeCallId === call.id}
                onListen={() => handleMonitor(call.id, 'listen_in')}
                onWhisper={() => handleMonitor(call.id, 'whisper')}
                onTakeover={() => handleMonitor(call.id, 'takeover')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
