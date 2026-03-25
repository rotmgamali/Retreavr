'use client'

import { useState, useMemo, useCallback } from 'react'
import { SkeletonToContent } from '@/components/animations'
import { CallHistorySkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { useCallHistory, useCallRecord } from '@/hooks/use-call-history'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Call } from '@/lib/api-types'
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Play, Pause,
  ChevronRight, Search, Filter, Star, Download, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────────

interface CallRecord {
  id: string
  callerName: string
  callerPhone: string
  direction: 'inbound' | 'outbound' | 'missed'
  agent: string
  agentId: string
  duration: number // seconds
  date: string
  time: string
  outcome: 'converted' | 'follow-up' | 'no-action' | 'transferred' | 'voicemail'
  aiScore: number // 0-100
  sentiment: 'positive' | 'neutral' | 'negative'
  status: string
}

// ── API mapper ──────────────────────────────────────────────────────────────

function mapCallStatus(
  status: Call['status'],
  direction: Call['direction'],
  duration: number | null,
): { direction: CallRecord['direction']; outcome: CallRecord['outcome'] } {
  if (status === 'no-answer' || status === 'busy' || status === 'canceled') {
    return { direction: 'missed', outcome: 'voicemail' }
  }
  if (status === 'failed') {
    return { direction: 'missed', outcome: 'no-action' }
  }

  const dir = direction === 'inbound' ? 'inbound' : 'outbound'

  if (duration && duration > 180) return { direction: dir, outcome: 'converted' }
  if (duration && duration > 60) return { direction: dir, outcome: 'follow-up' }
  if (!duration || duration === 0) return { direction: 'missed', outcome: 'voicemail' }
  return { direction: dir, outcome: 'no-action' }
}

function sentimentFromScore(score: number | null): CallRecord['sentiment'] {
  if (score == null) return 'neutral'
  if (score >= 60) return 'positive'
  if (score <= 40) return 'negative'
  return 'neutral'
}

function apiToUiCall(call: Call): CallRecord {
  const dt = new Date(call.created_at)
  const { direction, outcome } = mapCallStatus(call.status, call.direction, call.duration)
  return {
    id: call.id,
    callerName: call.phone_from || call.phone_to || 'Unknown',
    callerPhone: call.direction === 'inbound' ? (call.phone_from || '—') : (call.phone_to || '—'),
    direction,
    agent: call.agent_id ? `Agent ${call.agent_id.slice(0, 6)}` : '—',
    agentId: call.agent_id,
    duration: call.duration ?? 0,
    date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    outcome,
    aiScore: call.sentiment_score ?? 0,
    sentiment: sentimentFromScore(call.sentiment_score),
    status: call.status,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  if (sec === 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DIRECTION_ICON = {
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  missed: PhoneMissed,
}

const DIRECTION_COLOR = {
  inbound: 'text-green-400',
  outbound: 'text-blue-400',
  missed: 'text-red-400',
}

const OUTCOME_BADGE: Record<CallRecord['outcome'], { variant: 'success' | 'warning' | 'secondary' | 'info' | 'destructive'; label: string }> = {
  converted: { variant: 'success', label: 'Converted' },
  'follow-up': { variant: 'warning', label: 'Follow-up' },
  'no-action': { variant: 'secondary', label: 'No Action' },
  transferred: { variant: 'info', label: 'Transferred' },
  voicemail: { variant: 'destructive', label: 'Voicemail' },
}

const SENTIMENT_ICON = {
  positive: TrendingUp,
  neutral: Minus,
  negative: TrendingDown,
}

const SENTIMENT_COLOR = {
  positive: 'text-green-400',
  neutral: 'text-slate-400',
  negative: 'text-red-400',
}

// ── AI Score ring ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  if (score === 0) return <span className="text-xs text-slate-600">N/A</span>
  const color = score >= 85 ? 'text-green-400' : score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  const strokeColor = score >= 85 ? '#22c55e' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 18
  const dash = (score / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle cx="24" cy="24" r="18" fill="none" stroke={strokeColor} strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
      </svg>
      <span className={`absolute text-xs font-bold ${color}`}>{score}</span>
    </div>
  )
}

// ── Call Detail Panel ────────────────────────────────────────────────────────

function CallDetailPanel({ callId, call }: { callId: string; call: CallRecord }) {
  const { data: detail, isLoading, isError, refetch } = useCallRecord(callId)
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <Card className="glass-card sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{call.callerName}</CardTitle>
            <p className="text-sm text-slate-400 mt-0.5">{call.callerPhone}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={OUTCOME_BADGE[call.outcome].variant}>
              {OUTCOME_BADGE[call.outcome].label}
            </Badge>
            <ScoreRing score={call.aiScore} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Meta row */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            {(() => { const I = DIRECTION_ICON[call.direction]; return <I className={`h-3.5 w-3.5 ${DIRECTION_COLOR[call.direction]}`} /> })()}
            <span className="capitalize">{call.direction}</span>
          </span>
          <span>{call.date} at {call.time}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(call.duration)}
          </span>
          <span>Agent: {call.agent}</span>
          <span className={`flex items-center gap-1 ${SENTIMENT_COLOR[call.sentiment]}`}>
            {(() => { const I = SENTIMENT_ICON[call.sentiment]; return <I className="h-3.5 w-3.5" /> })()}
            <span className="capitalize">{call.sentiment}</span>
          </span>
        </div>

        {/* Audio player placeholder */}
        {call.duration > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-colors"
              >
                {isPlaying
                  ? <Pause className="h-4 w-4 text-blue-400" />
                  : <Play className="h-4 w-4 text-blue-400 ml-0.5" />
                }
              </button>
              <div className="flex-1">
                <div className="flex items-end gap-[1px] h-8 mb-1">
                  {Array.from({ length: 60 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-blue-400/30 hover:bg-blue-400/60 transition-colors cursor-pointer"
                      style={{ height: `${Math.max(4, Math.abs(Math.sin(i * 0.5)) * 32)}px` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>0:00</span>
                  <span>{formatDuration(call.duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary from API */}
        {isLoading ? (
          <LoadingState variant="skeleton-list" count={2} />
        ) : isError ? (
          <ErrorState title="Failed to load call details" onRetry={() => refetch()} />
        ) : (
          <>
            {detail?.summary && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-amber-400" />
                  AI Summary
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">{detail.summary.summary}</p>
                {detail.summary.key_points?.length > 0 && (
                  <div className="mt-2">
                    <h5 className="text-xs font-semibold text-slate-500 mb-1">Key Points</h5>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                      {detail.summary.key_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.summary.next_actions?.length > 0 && (
                  <div className="mt-2">
                    <h5 className="text-xs font-semibold text-slate-500 mb-1">Next Actions</h5>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                      {detail.summary.next_actions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Transcript */}
            {detail?.transcript && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Transcript</h4>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                  {detail.transcript.transcript}
                </div>
              </div>
            )}

            {!detail?.summary && !detail?.transcript && (
              <EmptyState icon={Phone} title="No details available" description="Transcript and summary will appear once call processing is complete." />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CallHistoryPage() {
  const loading = usePageLoading(700)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [limit] = useState(50)

  const {
    data: callsData,
    isLoading: callsLoading,
    isError: callsError,
    refetch,
  } = useCallHistory({ limit })

  const calls: CallRecord[] = useMemo(
    () => (callsData?.items ?? []).map(apiToUiCall),
    [callsData],
  )

  const selectedCall = useMemo(
    () => calls.find((c) => c.id === selectedCallId) ?? null,
    [calls, selectedCallId],
  )

  const filteredCalls = useMemo(() => {
    let result = calls
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.callerName.toLowerCase().includes(q) ||
          c.callerPhone.toLowerCase().includes(q) ||
          c.agent.toLowerCase().includes(q),
      )
    }
    if (directionFilter !== 'all') {
      result = result.filter((c) => c.direction === directionFilter)
    }
    return result
  }, [calls, searchQuery, directionFilter])

  const handleSelectCall = useCallback((call: CallRecord) => {
    setSelectedCallId(call.id)
  }, [])

  return (
    <SkeletonToContent loading={loading} skeleton={<CallHistorySkeleton />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground mt-1">
            Review past calls with AI-powered insights
            {callsData ? ` (${callsData.total} total)` : ''}
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search calls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Calls</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {callsLoading ? (
        <LoadingState variant="skeleton-list" count={8} />
      ) : callsError ? (
        <ErrorState title="Failed to load call history" onRetry={() => refetch()} />
      ) : filteredCalls.length === 0 && !searchQuery && directionFilter === 'all' ? (
        <EmptyState
          icon={Phone}
          title="No calls yet"
          description="Call history will appear here once calls are made."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Call list */}
          <div className="lg:col-span-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredCalls.length === 0 ? (
              <EmptyState icon={Search} title="No results" description="Try adjusting your search or filters." />
            ) : (
              filteredCalls.map(call => {
                const DirIcon = DIRECTION_ICON[call.direction]
                const outcome = OUTCOME_BADGE[call.outcome]
                const isSelected = selectedCallId === call.id

                return (
                  <div
                    key={call.id}
                    onClick={() => handleSelectCall(call)}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <DirIcon className={`h-4 w-4 ${DIRECTION_COLOR[call.direction]}`} />
                        <p className="text-sm font-medium">{call.callerName}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-slate-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span>{call.date}</span>
                      <span className="text-white/10">|</span>
                      <span>{call.time}</span>
                      <span className="text-white/10">|</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duration)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={outcome.variant} className="text-[10px]">{outcome.label}</Badge>
                        <span className="text-xs text-slate-500">{call.agent}</span>
                      </div>
                      <ScoreRing score={call.aiScore} />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-3">
            {selectedCall && selectedCallId ? (
              <CallDetailPanel callId={selectedCallId} call={selectedCall} />
            ) : (
              <Card className="glass-card">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <Phone className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium">Select a call to view details</p>
                  <p className="text-slate-600 text-sm mt-1">Click on any call record to see AI insights, sentiment analysis, and transcript</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
    </SkeletonToContent>
  )
}
