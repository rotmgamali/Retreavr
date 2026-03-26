import { useState, useCallback, useRef, useEffect } from 'react'

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

export function useRealtimeVoice(agentId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [audioInputLevel, setAudioInputLevel] = useState(0)

  const socketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      // audioContextRef.current.close()
    }
    setIsConnected(false)
    setIsRecording(false)
  }, [])

  const start = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/voice/stream/${agentId}?token=${token}`
      
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        setIsRecording(true)
      }

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'transcript') {
          setTranscript(prev => [...prev, {
            role: data.role,
            text: data.text,
            timestamp: new Date()
          }])
        } else if (data.type === 'audio') {
          // Playback logic for server audio chunks
        }
      }

      socket.onerror = () => setError('WebSocket connection error')
      socket.onclose = () => stop()

      // Set up Audio capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass!({ sampleRate: 24000 })
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (socket.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)
          
          // Simple visualizer level
          let sum = 0
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i]
          }
          setAudioInputLevel(Math.sqrt(sum / inputData.length))

          // Convert to 16-bit PCM and send
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
          }
          socket.send(pcmData.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice stream')
      stop()
    }
  }, [agentId, stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return {
    start,
    stop,
    isConnected,
    isRecording,
    transcript,
    error,
    audioInputLevel
  }
}
