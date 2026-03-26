"use client"

import { useRef, useState, useCallback, useEffect } from 'react'

export type MonitorMode = 'listen_in' | 'whisper' | 'takeover'

function buildMonitorWsUrl(callId: string, token: string | null): string {
  if (typeof window === 'undefined') return ''
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL
  let base: string
  if (wsUrl) {
    base = wsUrl
  } else {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'
    const converted = apiBase
      .replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'))
      .replace(/\/api\/v1$/, '')
    if (converted.startsWith('/')) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      base = `${proto}://${window.location.host}${converted}`
    } else {
      base = converted
    }
  }
  const url = `${base}/ws/calls/${callId}/monitor`
  return token ? `${url}?token=${encodeURIComponent(token)}` : url
}

export function useCallMonitor() {
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [mode, setModeState] = useState<MonitorMode | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setActiveCallId(null)
    setModeState(null)
    setIsConnected(false)
  }, [])

  const monitor = useCallback((callId: string, initialMode: MonitorMode = 'listen_in') => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    const url = buildMonitorWsUrl(callId, token)
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      return
    }
    wsRef.current = ws
    setActiveCallId(callId)

    ws.onopen = () => {
      setIsConnected(true)
      setModeState(initialMode)
      if (initialMode !== 'listen_in') {
        ws.send(JSON.stringify({ type: 'set_mode', mode: initialMode }))
      }
    }
    ws.onclose = () => {
      setIsConnected(false)
      setModeState(null)
      setActiveCallId(null)
    }
    ws.onerror = () => ws.close()
  }, [])

  const setMode = useCallback((callId: string, newMode: MonitorMode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && activeCallId === callId) {
      wsRef.current.send(JSON.stringify({ type: 'set_mode', mode: newMode }))
      setModeState(newMode)
    } else {
      monitor(callId, newMode)
    }
  }, [activeCallId, monitor])

  useEffect(() => () => { wsRef.current?.close() }, [])

  return { activeCallId, mode, isConnected, monitor, disconnect, setMode }
}
