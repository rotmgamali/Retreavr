"use client"

import { useEffect, useRef, useState, useCallback } from 'react'

export interface LiveAgent {
  id: string
  name: string
  status: 'On Call' | 'Available' | 'Paused' | 'Offline'
  callsToday: number
  secondsOnCall: number
}

export interface DashboardActivityEvent {
  id: string
  event: string
  agent: string
  status: 'success' | 'info' | 'warning' | 'error'
  timestamp: Date
}

export interface KPIUpdate {
  total_calls?: number
  conversion_rate?: number
  active_leads?: number
  revenue?: number
}

type WsMessage =
  | { type: 'call.started'; data: { agent_id: string; agent_name: string; call_id: string } }
  | { type: 'call.ended'; data: { agent_id: string; agent_name: string; call_id: string; outcome?: string } }
  | { type: 'kpi.update'; data: KPIUpdate }
  | { type: 'agent.status_changed'; data: LiveAgent }

function buildWsUrl(orgId: string): string {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL
  if (wsUrl) return `${wsUrl}/ws/dashboard/${orgId}`

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'
  // Convert http(s) → ws(s), strip /api/v1 suffix
  const base = apiBase.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws')).replace(/\/api\/v1$/, '')
  // If it's a relative path, use window.location origin
  if (base.startsWith('/') && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}${base}/ws/dashboard/${orgId}`
  }
  return `${base}/ws/dashboard/${orgId}`
}

export function useDashboardEvents(orgId: string | null | undefined) {
  const [agents, setAgents] = useState<LiveAgent[]>([])
  const [activities, setActivities] = useState<DashboardActivityEvent[]>([])
  const [kpiUpdate, setKpiUpdate] = useState<KPIUpdate | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted = useRef(false)

  const connect = useCallback(() => {
    if (!orgId || unmounted.current) return

    let ws: WebSocket
    try {
      ws = new WebSocket(buildWsUrl(orgId))
    } catch {
      return
    }

    wsRef.current = ws

    ws.onopen = () => {
      if (!unmounted.current) setIsConnected(true)
    }

    ws.onclose = () => {
      if (unmounted.current) return
      setIsConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (e: MessageEvent) => {
      if (unmounted.current) return
      let msg: WsMessage
      try {
        msg = JSON.parse(e.data as string) as WsMessage
      } catch {
        return
      }

      switch (msg.type) {
        case 'call.started': {
          const { agent_id, agent_name, call_id } = msg.data
          setActivities((prev) => [
            {
              id: `started-${call_id}`,
              event: 'Call started',
              agent: agent_name,
              status: 'info',
              timestamp: new Date(),
            },
            ...prev.slice(0, 19),
          ])
          setAgents((prev) =>
            prev.map((a) =>
              a.id === agent_id ? { ...a, status: 'On Call', secondsOnCall: 0 } : a
            )
          )
          break
        }

        case 'call.ended': {
          const { agent_id, agent_name, call_id, outcome } = msg.data
          const eventLabel =
            outcome === 'bound'
              ? 'Policy bound'
              : outcome === 'qualified'
              ? 'Lead qualified'
              : outcome === 'quoted'
              ? 'Quote sent'
              : 'Call ended'
          setActivities((prev) => [
            {
              id: `ended-${call_id}`,
              event: eventLabel,
              agent: agent_name,
              status: outcome === 'bound' || outcome === 'qualified' ? 'success' : 'info',
              timestamp: new Date(),
            },
            ...prev.slice(0, 19),
          ])
          setAgents((prev) =>
            prev.map((a) =>
              a.id === agent_id
                ? { ...a, status: 'Available', secondsOnCall: 0, callsToday: a.callsToday + 1 }
                : a
            )
          )
          break
        }

        case 'kpi.update': {
          setKpiUpdate(msg.data)
          break
        }

        case 'agent.status_changed': {
          const agent = msg.data
          setAgents((prev) => {
            const idx = prev.findIndex((a) => a.id === agent.id)
            if (idx === -1) return [...prev, agent]
            return prev.map((a) => (a.id === agent.id ? { ...a, ...agent } : a))
          })
          break
        }
      }
    }
  }, [orgId])

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { agents, activities, kpiUpdate, isConnected, setAgents }
}
