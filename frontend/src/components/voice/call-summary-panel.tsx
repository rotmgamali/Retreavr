'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Tag,
  ListChecks,
  Smile,
  ArrowUpRight,
  Save,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CallSummaryData } from '@/hooks/use-voice-call'

interface CallSummaryPanelProps {
  summary: CallSummaryData
  onSaveNotes?: (notes: string) => void
  onClose?: () => void
  onUpdateLeadStatus?: (status: string) => void
  className?: string
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getSentimentLabel(score: number | null): { label: string; color: string; emoji: string } {
  if (score === null) return { label: 'Unknown', color: 'text-muted-foreground', emoji: '' }
  if (score >= 0.7) return { label: 'Positive', color: 'text-green-400', emoji: '' }
  if (score >= 0.4) return { label: 'Neutral', color: 'text-yellow-400', emoji: '' }
  return { label: 'Negative', color: 'text-red-400', emoji: '' }
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function CallSummaryPanel({
  summary,
  onSaveNotes,
  onClose,
  onUpdateLeadStatus,
  className,
}: CallSummaryPanelProps) {
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const sentiment = getSentimentLabel(summary.sentimentScore)

  const handleSave = () => {
    onSaveNotes?.(notes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Call Summary
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duration and sentiment row */}
          <motion.div variants={item} className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono">{formatDuration(summary.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Smile className={cn('h-3.5 w-3.5', sentiment.color)} />
              <span className={sentiment.color}>{sentiment.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{summary.transcript.length} messages</span>
            </div>
          </motion.div>

          {/* AI Summary */}
          {summary.summary && (
            <motion.div variants={item} className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Summary
              </h3>
              <p className="text-sm leading-relaxed bg-white/5 rounded-lg p-3 border border-white/5">
                {summary.summary}
              </p>
            </motion.div>
          )}

          {/* Key Topics */}
          {summary.keyTopics.length > 0 && (
            <motion.div variants={item} className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Key Topics
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {summary.keyTopics.map((topic, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* Action Items */}
          {summary.actionItems.length > 0 && (
            <motion.div variants={item} className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" />
                Action Items
              </h3>
              <ul className="space-y-1">
                {summary.actionItems.map((actionItem, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                    <span>{actionItem}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Lead Status Suggestion */}
          {summary.leadStatusSuggestion && onUpdateLeadStatus && (
            <motion.div variants={item}>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Suggested Status Update</p>
                    <p className="text-sm font-medium text-blue-300 capitalize">
                      {summary.leadStatusSuggestion}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                  onClick={() => onUpdateLeadStatus(summary.leadStatusSuggestion!)}
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          )}

          {/* Notes */}
          <motion.div variants={item} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this call..."
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-muted-foreground"
            />
            {onSaveNotes && (
              <Button
                onClick={handleSave}
                disabled={!notes.trim()}
                size="sm"
                className="h-8 text-xs gap-1.5"
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Notes
                  </>
                )}
              </Button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
