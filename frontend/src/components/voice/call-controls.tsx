'use client'

import { useState } from 'react'
import {
  Mic,
  MicOff,
  PhoneOff,
  Pause,
  Play,
  UserRound,
  Volume2,
  VolumeX,
  Circle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface CallControlsProps {
  isMuted: boolean
  isHeld: boolean
  isSpeakerMuted: boolean
  isRecording?: boolean
  onToggleMute: () => void
  onToggleHold: () => void
  onToggleSpeaker: () => void
  onToggleRecording?: () => void
  onTransfer: () => void
  onEndCall: () => void
  disabled?: boolean
}

function ControlButton({
  label,
  icon: Icon,
  active,
  variant,
  recording,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ElementType
  active?: boolean
  variant?: 'destructive'
  recording?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'ghost'}
            size="icon"
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'h-10 w-10 rounded-full transition-all duration-200 relative',
              active && variant !== 'destructive' && 'bg-white/15 text-white ring-1 ring-white/20',
              variant === 'destructive' && 'bg-red-600 hover:bg-red-500 text-white',
              recording && 'ring-2 ring-red-500'
            )}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={`${active}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                <Icon className="h-4 w-4" />
              </motion.span>
            </AnimatePresence>
            {recording && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </Button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function CallControls({
  isMuted,
  isHeld,
  isSpeakerMuted,
  isRecording = false,
  onToggleMute,
  onToggleHold,
  onToggleSpeaker,
  onToggleRecording,
  onTransfer,
  onEndCall,
  disabled,
}: CallControlsProps) {
  const [showVolume, setShowVolume] = useState(false)
  const [volume, setVolume] = useState(80)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <ControlButton
          label={isMuted ? 'Unmute' : 'Mute'}
          icon={isMuted ? MicOff : Mic}
          active={isMuted}
          onClick={onToggleMute}
          disabled={disabled}
        />
        <ControlButton
          label={isHeld ? 'Resume' : 'Hold'}
          icon={isHeld ? Play : Pause}
          active={isHeld}
          onClick={onToggleHold}
          disabled={disabled}
        />
        <div className="relative">
          <ControlButton
            label={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
            icon={isSpeakerMuted ? VolumeX : Volume2}
            active={isSpeakerMuted || showVolume}
            onClick={() => {
              if (showVolume) {
                setShowVolume(false)
              } else {
                onToggleSpeaker()
              }
            }}
            disabled={disabled}
          />
          {/* Long press to show volume slider */}
          <button
            className="absolute inset-0 z-10 opacity-0"
            onContextMenu={(e) => {
              e.preventDefault()
              setShowVolume(!showVolume)
            }}
            disabled={disabled}
            aria-hidden
          />
          <AnimatePresence>
            {showVolume && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-[#1e293b] border border-white/10 shadow-xl w-32"
              >
                <Slider
                  value={volume}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={setVolume}
                />
                <p className="text-[10px] text-center text-muted-foreground mt-1">{volume}%</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {onToggleRecording && (
          <ControlButton
            label={isRecording ? 'Stop Recording' : 'Record'}
            icon={Circle}
            active={isRecording}
            recording={isRecording}
            onClick={onToggleRecording}
            disabled={disabled}
          />
        )}
        <ControlButton
          label="Transfer to Human"
          icon={UserRound}
          onClick={onTransfer}
          disabled={disabled}
        />
        <ControlButton
          label="End Call"
          icon={PhoneOff}
          variant="destructive"
          onClick={onEndCall}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
