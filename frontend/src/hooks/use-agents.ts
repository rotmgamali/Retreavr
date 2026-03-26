import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PaginatedResponse } from '@/lib/api-client'
import type { VoiceAgent as ApiVoiceAgent } from '@/lib/api-types'

// Re-export the API type for consumers
export type { ApiVoiceAgent as VoiceAgentApi }

export function useAgents(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))
      const qs = searchParams.toString()
      return api.get<PaginatedResponse<ApiVoiceAgent>>(
        `/voice-agents/${qs ? `?${qs}` : ''}`
      )
    },
    staleTime: 30_000,
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => api.get<ApiVoiceAgent>(`/voice-agents/${id}`),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      persona: string
      system_prompt: string
      voice?: string
      status?: string
      vad_config?: Record<string, unknown>
    }) => api.post<ApiVoiceAgent>('/voice-agents/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ApiVoiceAgent> }) =>
      api.patch<ApiVoiceAgent>(`/voice-agents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/voice-agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useLinkKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, documentId }: { agentId: string; documentId: string }) =>
      api.post(`/voice-agents/${agentId}/knowledge/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUnlinkKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, documentId }: { agentId: string; documentId: string }) =>
      api.delete(`/voice-agents/${agentId}/knowledge/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })
}
