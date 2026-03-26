import { useQuery } from '@tanstack/react-query'
import { api, type PaginatedResponse } from '@/lib/api-client'
import type { Call, CallTranscript, CallSummary } from '@/lib/api-types'

export type { Call as CallApi }

export interface CallDetail extends Call {
  transcript?: CallTranscript
  summary?: CallSummary
}

export function useCallHistory(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['call-history', params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))
      const qs = searchParams.toString()
      return api.get<PaginatedResponse<Call>>(`/calls/${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  })
}

export function useQueuedCalls() {
  return useQuery({
    queryKey: ['calls', 'queued'],
    queryFn: () => api.get<PaginatedResponse<Call>>('/calls/?status=ringing,queued'),
    staleTime: 5_000,
    refetchInterval: 10_000,
  })
}

export function useCallRecord(id: string) {
  return useQuery({
    queryKey: ['call-history', id],
    queryFn: async (): Promise<CallDetail> => {
      const call = await api.get<Call>(`/calls/${id}`)
      // Fetch transcript and summary in parallel
      const [transcript, summary] = await Promise.allSettled([
        api.get<CallTranscript>(`/calls/${id}/transcript`),
        api.get<CallSummary>(`/calls/${id}/summary`),
      ])
      return {
        ...call,
        transcript: transcript.status === 'fulfilled' ? transcript.value : undefined,
        summary: summary.status === 'fulfilled' ? summary.value : undefined,
      }
    },
    enabled: !!id,
  })
}
