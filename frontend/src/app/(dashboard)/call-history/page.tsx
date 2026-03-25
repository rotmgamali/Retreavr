'use client'

import { useState } from 'react'
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Play, Pause,
  ChevronRight, Search, Filter, Star, Download, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ────────────────────────────────────────────────────────────────────

interface CallRecord {
  id: string
  callerName: string
  callerPhone: string
  direction: 'inbound' | 'outbound' | 'missed'
  agent: string
  duration: number // seconds
  date: string
  time: string
  outcome: 'converted' | 'follow-up' | 'no-action' | 'transferred' | 'voicemail'
  aiScore: number // 0-100
  sentiment: 'positive' | 'neutral' | 'negative'
  transcript?: string
  summary?: string
  sentimentTimeline: { time: number; value: number }[] // -1 to 1
}

// ── Mock data ────────────────────────────────────────────────────────────────

function generateSentimentTimeline(): { time: number; value: number }[] {
  const points: { time: number; value: number }[] = []
  let v = 0
  for (let t = 0; t <= 100; t += 5) {
    v = Math.max(-1, Math.min(1, v + (Math.random() - 0.48) * 0.4))
    points.push({ time: t, value: v })
  }
  return points
}

const CALL_RECORDS: CallRecord[] = [
  {
    id: 'h1', callerName: 'James Wilson', callerPhone: '(555) 123-4567',
    direction: 'inbound', agent: 'Sarah AI', duration: 312, date: 'Mar 25, 2026', time: '2:45 PM',
    outcome: 'converted', aiScore: 92, sentiment: 'positive',
    summary: 'Customer inquired about auto insurance bundle. Quoted $2,100/yr. Customer accepted and began binding process. High intent, smooth conversation.',
    transcript: 'Agent: Hi, I\'m Sarah! How can I help you with your insurance today?\nCaller: Hi Sarah, I\'m looking to bundle my auto and home insurance...\nAgent: Great choice! Bundling can save you up to 15%. Let me pull up some options...',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h2', callerName: 'Maria Garcia', callerPhone: '(555) 234-5678',
    direction: 'outbound', agent: 'Mike AI', duration: 187, date: 'Mar 25, 2026', time: '1:30 PM',
    outcome: 'follow-up', aiScore: 78, sentiment: 'neutral',
    summary: 'Follow-up call for claims status. Customer\'s claim is in review. Scheduled callback for next week. Customer satisfied with update.',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h3', callerName: 'Robert Chen', callerPhone: '(555) 345-6789',
    direction: 'missed', agent: 'Alex AI', duration: 0, date: 'Mar 25, 2026', time: '12:15 PM',
    outcome: 'voicemail', aiScore: 0, sentiment: 'neutral',
    summary: 'Missed inbound call. Voicemail left requesting callback about cyber liability coverage.',
    sentimentTimeline: [],
  },
  {
    id: 'h4', callerName: 'Emily Brown', callerPhone: '(555) 456-7890',
    direction: 'inbound', agent: 'Sarah AI', duration: 523, date: 'Mar 25, 2026', time: '11:00 AM',
    outcome: 'transferred', aiScore: 65, sentiment: 'negative',
    summary: 'Customer called about policy cancellation. Frustrated with premium increase. Escalated to human agent for retention.',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h5', callerName: 'David Kim', callerPhone: '(555) 567-8901',
    direction: 'outbound', agent: 'Jordan AI', duration: 245, date: 'Mar 25, 2026', time: '10:30 AM',
    outcome: 'converted', aiScore: 88, sentiment: 'positive',
    summary: 'Outbound campaign call for renewal. Customer renewed workers\' comp policy with upgraded coverage.',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h6', callerName: 'Patricia Moore', callerPhone: '(555) 678-9012',
    direction: 'inbound', agent: 'Mike AI', duration: 156, date: 'Mar 24, 2026', time: '4:20 PM',
    outcome: 'no-action', aiScore: 72, sentiment: 'neutral',
    summary: 'General inquiry about coverage options. Customer browsing, no immediate intent. Added to nurture list.',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h7', callerName: 'Thomas Anderson', callerPhone: '(555) 789-0123',
    direction: 'outbound', agent: 'Sarah AI', duration: 398, date: 'Mar 24, 2026', time: '2:00 PM',
    outcome: 'converted', aiScore: 95, sentiment: 'positive',
    summary: 'Closed commercial package deal. Customer signed $15K annual premium. Excellent rapport building.',
    sentimentTimeline: generateSentimentTimeline(),
  },
  {
    id: 'h8', callerName: 'Lisa Wang', callerPhone: '(555) 890-1234',
    direction: 'inbound', agent: 'Alex AI', duration: 89, date: 'Mar 24, 2026', time: '11:45 AM',
    outcome: 'follow-up', aiScore: 70, sentiment: 'neutral',
    summary: 'Customer requested quote for auto insurance. Agent collected details. Quote will be emailed.',
    sentimentTimeline: generateSentimentTimeline(),
  },
]

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

// ── Sentiment timeline chart ─────────────────────────────────────────────────

function SentimentChart({ data }: { data: { time: number; value: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-slate-600 text-center py-4">No data</p>

  const width = 300
  const height = 60
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height / 2 - (d.value * height) / 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
      {/* Zero line */}
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="4" />
      {/* Area fill */}
      <polygon
        points={`0,${height / 2} ${points} ${width},${height / 2}`}
        fill="url(#sentGradient)"
        opacity={0.3}
      />
      {/* Line */}
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      <defs>
        <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  )
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CallHistoryPage() {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  const filteredCalls = searchQuery
    ? CALL_RECORDS.filter(c =>
        c.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CALL_RECORDS

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground mt-1">Review past calls with AI-powered insights</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Search bar */}
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
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Call list */}
        <div className="lg:col-span-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredCalls.map(call => {
            const DirIcon = DIRECTION_ICON[call.direction]
            const outcome = OUTCOME_BADGE[call.outcome]
            const isSelected = selectedCall?.id === call.id

            return (
              <div
                key={call.id}
                onClick={() => setSelectedCall(call)}
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
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {selectedCall ? (
            <Card className="glass-card sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedCall.callerName}</CardTitle>
                    <p className="text-sm text-slate-400 mt-0.5">{selectedCall.callerPhone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={OUTCOME_BADGE[selectedCall.outcome].variant}>
                      {OUTCOME_BADGE[selectedCall.outcome].label}
                    </Badge>
                    <ScoreRing score={selectedCall.aiScore} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Meta row */}
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    {(() => { const I = DIRECTION_ICON[selectedCall.direction]; return <I className={`h-3.5 w-3.5 ${DIRECTION_COLOR[selectedCall.direction]}`} /> })()}
                    <span className="capitalize">{selectedCall.direction}</span>
                  </span>
                  <span>{selectedCall.date} at {selectedCall.time}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(selectedCall.duration)}
                  </span>
                  <span>Agent: {selectedCall.agent}</span>
                  <span className={`flex items-center gap-1 ${SENTIMENT_COLOR[selectedCall.sentiment]}`}>
                    {(() => { const I = SENTIMENT_ICON[selectedCall.sentiment]; return <I className="h-3.5 w-3.5" /> })()}
                    <span className="capitalize">{selectedCall.sentiment}</span>
                  </span>
                </div>

                {/* Audio player */}
                {selectedCall.duration > 0 && (
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
                        {/* Waveform scrubber */}
                        <div className="flex items-end gap-[1px] h-8 mb-1">
                          {Array.from({ length: 60 }, (_, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-full bg-blue-400/30 hover:bg-blue-400/60 transition-colors cursor-pointer"
                              style={{ height: `${Math.max(4, Math.random() * 32)}px` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>0:00</span>
                          <span>{formatDuration(selectedCall.duration)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sentiment timeline */}
                {selectedCall.sentimentTimeline.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2">Sentiment Timeline</h4>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <SentimentChart data={selectedCall.sentimentTimeline} />
                      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                        <span>Start</span>
                        <span className="text-green-400/50">Positive</span>
                        <span className="text-slate-500">Neutral</span>
                        <span className="text-red-400/50">Negative</span>
                        <span>End</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {selectedCall.summary && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-amber-400" />
                      AI Summary
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedCall.summary}</p>
                  </div>
                )}

                {/* Transcript preview */}
                {selectedCall.transcript && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2">Transcript Preview</h4>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                      {selectedCall.transcript}
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 text-xs">
                      View Full Transcript
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
    </div>
  )
}
