import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PaginatedResponse } from '@/lib/api-client'
import type { Lead as ApiLead } from '@/lib/api-types'

export type { ApiLead as LeadApi }

// Keep the Stage type for backward compat with page components
export type Stage = ApiLead['status']

export function useLeads(params?: { limit?: number; offset?: number; status?: string }) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))
      if (params?.status) searchParams.set('status', params.status)
      const qs = searchParams.toString()
      return api.get<PaginatedResponse<ApiLead>>(`/leads/${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => api.get<ApiLead>(`/leads/${id}`),
    enabled: !!id,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      first_name: string
      last_name: string
      email: string
      phone: string
      insurance_type: string
      status?: Stage
      metadata?: Record<string, unknown>
    }) => api.post<ApiLead>('/leads/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ApiLead> }) =>
      api.patch<ApiLead>(`/leads/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
