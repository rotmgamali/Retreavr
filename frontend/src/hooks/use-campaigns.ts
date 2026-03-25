import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PaginatedResponse } from '@/lib/api-client'
import type { Campaign as ApiCampaign } from '@/lib/api-types'

export type { ApiCampaign as CampaignApi }

export function useCampaigns(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))
      const qs = searchParams.toString()
      return api.get<PaginatedResponse<ApiCampaign>>(`/campaigns/${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => api.get<ApiCampaign>(`/campaigns/${id}`),
    enabled: !!id,
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      type: ApiCampaign['type']
      status?: ApiCampaign['status']
      config?: Record<string, unknown>
    }) => api.post<ApiCampaign>('/campaigns/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ApiCampaign> }) =>
      api.patch<ApiCampaign>(`/campaigns/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
