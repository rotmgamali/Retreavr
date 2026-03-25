import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DashboardKPIs, AgentPerformance } from '@/lib/api-types'

export type { DashboardKPIs, AgentPerformance }

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: () => api.get<DashboardKPIs>('/analytics/dashboard'),
    staleTime: 60_000,
  })
}

export function useAgentPerformance() {
  return useQuery({
    queryKey: ['analytics', 'agents'],
    queryFn: () => api.get<AgentPerformance[]>('/analytics/agents'),
    staleTime: 60_000,
  })
}

export function useConversionFunnel() {
  return useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () =>
      api.get<{ stage: string; count: number }[]>('/analytics/conversion-funnel'),
    staleTime: 60_000,
  })
}

export function useCallVolume(period: 'hourly' | 'daily' | 'weekly' = 'daily') {
  return useQuery({
    queryKey: ['analytics', 'call-volume', period],
    queryFn: () =>
      api.get<{ timestamp: string; count: number }[]>(
        `/analytics/call-volume?period=${period}`
      ),
    staleTime: 60_000,
  })
}
