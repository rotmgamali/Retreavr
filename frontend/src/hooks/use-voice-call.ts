'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptEntry } from '@/components/voice/live-transcript'
import {
  RealtimeClient,
  type RealtimeSessionConfig,
  type RealtimeToolDefinition,
  type RealtimeVoice,
} from '@/lib/voice-engine/realtime-client'

// ── Types ────────────────────────────────────────────────────────────────────

export type CallState = 'idle' | 'connecting' | 'connected' | 'on-hold' | 'ending' | 'ended'

export interface CallSummaryData {
  sessionId: string
  callId: string
  duration: number
  transcript: TranscriptEntry[]
  summary: string | null
  keyTopics: string[]
  actionItems: string[]
  sentimentScore: number | null
  leadStatusSuggestion: string | null
}

export interface UseVoiceCallReturn {
  callState: CallState
  transcript: TranscriptEntry[]
  duration: number
  audioLevel: number
  isMuted: boolean
  isHeld: boolean
  isSpeakerMuted: boolean
  isRecording: boolean
  error: string | null
  sessionId: string | null
  callId: string | null
  callSummary: CallSummaryData | null
  startCall: (phoneNumber: string | null, agentId: string, opts?: {
    leadId?: string
    direction?: 'inbound' | 'outbound'
    callType?: string
  }) => Promise<void>
  acceptCall: (sessionId: string) => Promise<void>
  endCall: () => Promise<void>
  toggleMute: () => void
  toggleHold: () => void
  toggleSpeaker: () => void
  toggleRecording: () => void
  transferToHuman: (department?: string) => void
  resetCall: () => void
}

// ── Audio helpers ────────────────────────────────────────────────────────────

function float32ToBase64Pcm16(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const bytes = new Uint8Array(pcm16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const pcm16 = new Int16Array(bytes.buffer)
  const float32 = new Float32Array(pcm16.length)
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 0x8000
  }
  return float32
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceCall(): UseVoiceCallReturn {
  const [callState, setCallState] = useState<CallState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isHeld, setIsHeld] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [callId, setCallId] = useState<string | null>(null)
  const [callSummary, setCallSummary] = useState<CallSummaryData | null>(null)

  const clientRef = useRef<RealtimeClient | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioLevelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const partialTranscriptRef = useRef<string>('')
  const transcriptIdRef = useRef(0)
  const isMutedRef = useRef(false)
  const isHeldRef = useRef(false)
  const isSpeakerMutedRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { isHeldRef.current = isHeld }, [isHeld])
  useEffect(() => { isSpeakerMutedRef.current = isSpeakerMuted }, [isSpeakerMuted])

  // ── Transcript helpers ──────────────────────────────────────────────────

  const updatePartialTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === role && last?.partial) {
        return [...prev.slice(0, -1), { ...last, text }]
      }
      const id = `t-${++transcriptIdRef.current}`
      return [...prev, { id, role, text, timestamp: new Date().toISOString(), partial: true }]
    })
  }, [])

  const finalizeTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === role && last?.partial) {
        return [...prev.slice(0, -1), { ...last, text, partial: false }]
      }
      const id = `t-${++transcriptIdRef.current}`
      return [...prev, { id, role, text, timestamp: new Date().toISOString(), partial: false }]
    })
  }, [])

  // ── Audio playback ──────────────────────────────────────────────────────

  const playAudioChunk = useCallback((float32: Float32Array, ctx: AudioContext) => {
    const buffer = ctx.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32 as unknown as Float32Array<ArrayBuffer>, 0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  }, [])

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current)
      audioLevelTimerRef.current = null
    }
    processorRef.current?.disconnect()
    sourceNodeRef.current?.disconnect()
    analyserRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioContextRef.current?.close().catch(() => {})
    clientRef.current = null
    audioContextRef.current = null
    mediaStreamRef.current = null
    sourceNodeRef.current = null
    processorRef.current = null
    analyserRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
      cleanup()
    }
  }, [cleanup])

  // ── Start Call ──────────────────────────────────────────────────────────

  const startCall = useCallback(async (
    phoneNumber: string | null,
    agentId: string,
    opts?: {
      leadId?: string
      direction?: 'inbound' | 'outbound'
      callType?: string
    }
  ) => {
    setError(null)
    setCallState('connecting')
    setTranscript([])
    setDuration(0)
    setAudioLevel(0)
    setCallSummary(null)
    partialTranscriptRef.current = ''
    transcriptIdRef.current = 0

    try {
      // 1. Create server-side session
      const sessionRes = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          lead_id: opts?.leadId,
          direction: opts?.direction ?? 'outbound',
          call_type: opts?.callType,
          phone_to: phoneNumber,
        }),
      })

      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({ error: 'Failed to create session' }))
        throw new Error(err.error ?? 'Failed to create session')
      }

      const sessionData = await sessionRes.json()
      setSessionId(sessionData.session_id)
      setCallId(sessionData.call_id)

      // 2. Get ephemeral token
      const tokenRes = await fetch('/api/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: sessionData.voice }),
      })

      if (!tokenRes.ok) throw new Error('Failed to get Realtime API token')

      const tokenData = await tokenRes.json()
      const ephemeralKey = tokenData.token
      if (!ephemeralKey) throw new Error('No ephemeral token returned')

      // 3. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      // 4. Set up AudioContext
      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = source

      // Analyser for audio level visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // ScriptProcessor for capturing mic audio
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      source.connect(processor)
      processor.connect(audioContext.destination)

      // 5. Connect to OpenAI Realtime
      const config: RealtimeSessionConfig = {
        voice: sessionData.voice as RealtimeVoice,
        instructions: sessionData.instructions,
        tools: sessionData.tools as RealtimeToolDefinition[],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: sessionData.vad_config ?? {
          type: 'server_vad',
          silence_duration_ms: 500,
          threshold: 0.5,
          prefix_padding_ms: 300,
        },
        temperature: 0.7,
        max_response_output_tokens: 4096,
      }

      const client = new RealtimeClient({
        apiKey: ephemeralKey,
        config,
        callbacks: {
          onOpen: () => {
            setCallState('connected')
            startedAtRef.current = Date.now()

            // Duration timer
            durationTimerRef.current = setInterval(() => {
              if (startedAtRef.current) {
                setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000))
              }
            }, 1000)

            // Audio level monitor
            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            audioLevelTimerRef.current = setInterval(() => {
              analyser.getByteFrequencyData(dataArray)
              let sum = 0
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
              const avg = sum / dataArray.length / 255
              setAudioLevel(avg)
            }, 50)
          },
          onClose: () => {
            setCallState('ended')
          },
          onError: (err) => {
            setError(err.message)
          },
          onAudioDelta: (base64Audio) => {
            if (isSpeakerMutedRef.current) return
            const float32 = base64Pcm16ToFloat32(base64Audio)
            playAudioChunk(float32, audioContext)
          },
          onTranscriptDelta: (delta) => {
            partialTranscriptRef.current += delta
            updatePartialTranscript('assistant', partialTranscriptRef.current)
          },
          onTranscriptDone: (text) => {
            partialTranscriptRef.current = ''
            finalizeTranscript('assistant', text)
          },
          onInputTranscript: (text) => {
            finalizeTranscript('user', text)
          },
          onFunctionCall: async (name, args, fnCallId) => {
            const res = await fetch('/api/voice/session', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionData.session_id,
                tool_call: { name, arguments: args, call_id: fnCallId },
              }),
            })
            if (res.ok) {
              const data = await res.json()
              return data.result ?? JSON.stringify({ error: 'No result' })
            }
            return JSON.stringify({ error: 'Tool execution failed' })
          },
        },
      })

      clientRef.current = client
      client.connect()

      // Wire up mic -> WebSocket
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || isHeldRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        const base64 = float32ToBase64Pcm16(inputData)
        client.appendAudio(base64)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start call'
      setError(msg)
      setCallState('idle')
      cleanup()
    }
  }, [cleanup, playAudioChunk, updatePartialTranscript, finalizeTranscript])

  // ── Accept incoming call ────────────────────────────────────────────────

  const acceptCall = useCallback(async (incomingSessionId: string) => {
    // For incoming calls, the session already exists on the server.
    // We just need to connect our audio.
    // Re-use startCall logic with the existing session.
    setSessionId(incomingSessionId)
    // In a real implementation, you'd fetch the session details and connect.
    // For now, this is a placeholder that mirrors the outbound flow.
    setCallState('connecting')
  }, [])

  // ── End Call ────────────────────────────────────────────────────────────

  const endCall = useCallback(async () => {
    setCallState('ending')
    clientRef.current?.disconnect()

    const currentSessionId = sessionId
    const currentCallId = callId
    const currentDuration = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0

    // End session on server and capture AI-generated summary
    let serverSummary: { summary?: string; key_points?: string[]; next_actions?: string[]; sentiment_score?: number } | null = null
    if (currentSessionId) {
      try {
        const res = await fetch(`/api/voice/session/${currentSessionId}`, { method: 'DELETE' })
        if (res.ok) {
          const data = await res.json()
          serverSummary = data.summary ?? null
        }
      } catch {
        // Best effort
      }
    }

    cleanup()
    setCallState('ended')
    startedAtRef.current = null

    setTranscript((currentTranscript) => {
      // Extract topics from transcript as fallback
      const allText = currentTranscript.map(t => t.text).join(' ').toLowerCase()
      const topicKeywords = [
        { keyword: 'quote', topic: 'Insurance Quote' },
        { keyword: 'claim', topic: 'Claims' },
        { keyword: 'policy', topic: 'Policy Details' },
        { keyword: 'renewal', topic: 'Policy Renewal' },
        { keyword: 'coverage', topic: 'Coverage Options' },
        { keyword: 'premium', topic: 'Premium Discussion' },
        { keyword: 'cancel', topic: 'Cancellation' },
        { keyword: 'payment', topic: 'Billing/Payment' },
      ]
      const extractedTopics = topicKeywords
        .filter(t => allText.includes(t.keyword))
        .map(t => t.topic)

      const summaryData: CallSummaryData = {
        sessionId: currentSessionId ?? '',
        callId: currentCallId ?? '',
        duration: currentDuration,
        transcript: currentTranscript,
        summary: serverSummary?.summary ?? `Call lasted ${Math.floor(currentDuration / 60)}m ${currentDuration % 60}s.`,
        keyTopics: serverSummary?.key_points ?? (extractedTopics.length > 0 ? extractedTopics : ['General Inquiry']),
        actionItems: serverSummary?.next_actions ?? [],
        sentimentScore: serverSummary?.sentiment_score ?? null,
        leadStatusSuggestion: null,
      }

      setCallSummary(summaryData)
      return currentTranscript
    })
  }, [sessionId, callId, cleanup])

  // ── Controls ────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setIsMuted(v => !v)
  }, [])

  const toggleHold = useCallback(() => {
    setIsHeld(v => {
      const newVal = !v
      if (newVal) {
        setCallState('on-hold')
        clientRef.current?.clearAudio()
      } else {
        setCallState('connected')
      }
      return newVal
    })
  }, [])

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerMuted(v => !v)
  }, [])

  const toggleRecording = useCallback(() => {
    setIsRecording(v => !v)
  }, [])

  const transferToHuman = useCallback((department?: string) => {
    clientRef.current?.sendText(
      `The customer has requested to speak with a human agent. Please initiate the transfer${department ? ` to the ${department} department` : ''}.`
    )
  }, [])

  const resetCall = useCallback(() => {
    setCallState('idle')
    setTranscript([])
    setDuration(0)
    setAudioLevel(0)
    setError(null)
    setSessionId(null)
    setCallId(null)
    setCallSummary(null)
    setIsMuted(false)
    setIsHeld(false)
    setIsSpeakerMuted(false)
    setIsRecording(false)
    startedAtRef.current = null
    partialTranscriptRef.current = ''
    transcriptIdRef.current = 0
  }, [])

  return {
    callState,
    transcript,
    duration,
    audioLevel,
    isMuted,
    isHeld,
    isSpeakerMuted,
    isRecording,
    error,
    sessionId,
    callId,
    callSummary,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleHold,
    toggleSpeaker,
    toggleRecording,
    transferToHuman,
    resetCall,
  }
}
