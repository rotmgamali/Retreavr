'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Minimize2, Maximize2, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CallControls } from './call-controls'
import { CallTimer } from './call-timer'
import { LiveTranscript } from './live-transcript'
import { CallSummaryPanel } from './call-summary-panel'
import { useVoiceCall, type CallState } from '@/hooks/use-voice-call'

// ── Waveform Visualization ──────────────────────────────────────────────────

function AudioWaveform({ level, active }: { level: number; active: boolean }) {
  const bars = 24
  return (
    <div className="flex items-center justify-center gap-[2px] h-10 px-4">
      {Array.from({ length: bars }).map((_, i) => {
        const distance = Math.abs(i - bars / 2) / (bars / 2)
        const baseHeight = active ? Math.max(0.1, (1 - distance * 0.6) * level * 3) : 0.05
        const height = Math.min(1, baseHeight)
        return (
          <motion.div
            key={i}
            className={cn(
              'w-[3px] rounded-full',
              active ? 'bg-blue-400/70' : 'bg-slate-600/40'
            )}
            animate={{
              height: `${Math.max(4, height * 40)}px`,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              mass: 0.5,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Status label ────────────────────────────────────────────────────────────

function getStatusDisplay(state: CallState): { label: string; color: string } {
  switch (state) {
    case 'idle': return { label: 'Ready to Call', color: 'text-muted-foreground' }
    case 'connecting': return { label: 'Connecting...', color: 'text-yellow-400' }
    case 'connected': return { label: 'Call Active', color: 'text-green-400' }
    case 'on-hold': return { label: 'On Hold', color: 'text-purple-400' }
    case 'ending': return { label: 'Ending Call...', color: 'text-yellow-400' }
    case 'ended': return { label: 'Call Ended', color: 'text-muted-foreground' }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface VoiceCallWidgetProps {
  /** Default agent ID to use for calls. */
  defaultAgentId?: string
  /** Whether the widget is visible. */
  visible?: boolean
  className?: string
}

export function VoiceCallWidget({
  defaultAgentId,
  visible = true,
  className,
}: VoiceCallWidgetProps) {
  const voiceCall = useVoiceCall()
  const [minimized, setMinimized] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)

  const {
    callState,
    transcript,
    audioLevel,
    isMuted,
    isHeld,
    isSpeakerMuted,
    isRecording,
    error,
    callSummary,
    startCall,
    endCall,
    toggleMute,
    toggleHold,
    toggleSpeaker,
    toggleRecording,
    transferToHuman,
    resetCall,
  } = voiceCall

  const isActive = callState === 'connected' || callState === 'on-hold'
  const statusDisplay = getStatusDisplay(callState)

  // Track startedAt for the CallTimer
  useEffect(() => {
    if (callState === 'connected' && !startedAt) {
      setStartedAt(new Date().toISOString())
    }
    if (callState === 'idle') {
      setStartedAt(null)
    }
  }, [callState, startedAt])

  // Show panel when call ends with summary
  useEffect(() => {
    if (callState === 'ended' && callSummary) {
      setShowPanel(true)
    }
  }, [callState, callSummary])

  if (!visible) return null

  // ── Idle bubble ───────────────────────────────────────────────────────

  if (callState === 'idle' && !showPanel) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPanel(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full',
          'bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/25',
          'flex items-center justify-center',
          'hover:shadow-blue-500/40 transition-shadow',
          className
        )}
      >
        <Phone className="h-6 w-6 text-white" />
      </motion.button>
    )
  }

  // ── Minimized pill ────────────────────────────────────────────────────

  if (minimized && isActive) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full',
          'bg-[#0f172a]/95 border border-white/10 shadow-2xl backdrop-blur-xl px-4 py-2.5 cursor-pointer',
          className
        )}
        onClick={() => setMinimized(false)}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <CallTimer startedAt={startedAt} active={isActive} />
        <AudioWaveform level={audioLevel} active={callState === 'connected'} />
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
      </motion.div>
    )
  }

  // ── Post-call summary panel ───────────────────────────────────────────

  if (callState === 'ended' && callSummary && showPanel) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className={cn('fixed bottom-6 right-6 z-50 w-[400px]', className)}
      >
        <CallSummaryPanel
          summary={callSummary}
          onClose={() => {
            setShowPanel(false)
            resetCall()
          }}
          onSaveNotes={() => {
            // In production, save to API
          }}
        />
      </motion.div>
    )
  }

  // ── Expanded panel ────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-[400px] rounded-2xl',
          'bg-[#0f172a]/95 border border-white/10 shadow-2xl backdrop-blur-xl',
          'flex flex-col overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-400" />
            <span className={cn('text-sm font-medium', statusDisplay.color)}>
              {statusDisplay.label}
            </span>
            {isActive && (
              <span className="relative flex h-2 w-2 ml-1">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isActive && (
              <CallTimer
                startedAt={startedAt}
                active={isActive}
                className="text-xs tabular-nums text-muted-foreground mr-2"
              />
            )}
            {isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setMinimized(true)}
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
            )}
            {(callState === 'idle' || callState === 'ended') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowPanel(false)
                  if (callState === 'ended') resetCall()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Waveform visualization */}
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-b border-white/5 bg-white/[0.02]"
          >
            <AudioWaveform level={audioLevel} active={callState === 'connected'} />
          </motion.div>
        )}

        {/* Transcript area */}
        <div className="h-[240px]">
          <LiveTranscript entries={transcript} />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 bg-red-500/10 text-red-400 text-xs border-t border-white/10"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-white/10">
          {callState === 'idle' || callState === 'ended' ? (
            <Button
              onClick={() => {
                if (defaultAgentId) {
                  startCall(null, defaultAgentId)
                }
              }}
              disabled={!defaultAgentId}
              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl h-10"
            >
              <Phone className="h-4 w-4 mr-2" />
              {callState === 'ended' ? 'Call Again' : 'Start Call'}
            </Button>
          ) : callState === 'connecting' ? (
            <Button disabled className="w-full h-10 rounded-xl">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <CallControls
              isMuted={isMuted}
              isHeld={isHeld}
              isSpeakerMuted={isSpeakerMuted}
              isRecording={isRecording}
              onToggleMute={toggleMute}
              onToggleHold={toggleHold}
              onToggleSpeaker={toggleSpeaker}
              onToggleRecording={toggleRecording}
              onTransfer={() => transferToHuman()}
              onEndCall={endCall}
              disabled={callState === 'ending'}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
