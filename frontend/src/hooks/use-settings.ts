import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Organization } from '@/lib/api-types'

export function useOrganization() {
  return useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => api.get<Organization>('/organizations/me'),
    staleTime: 60_000,
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Organization>) =>
      api.patch<Organization>('/organizations/me', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export interface IntegrationRow {
  id: string
  name: string
  provider: string
  config: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: () => api.get<IntegrationRow[]>('/settings/integrations'),
    staleTime: 60_000,
  })
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.patch(`/settings/integrations/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['settings', 'team'],
    queryFn: () =>
      api.get<{ id: string; email: string; first_name: string; last_name: string; role: string }[]>(
        '/organizations/me/users'
      ),
    staleTime: 30_000,
  })
}

export function useAddTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; first_name: string; last_name: string; role: string }) =>
      api.post('/organizations/me/users', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'team'] }),
  })
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.patch(`/organizations/me/users/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'team'] }),
  })
}

export interface AdminSettingsData {
  feature_flags: Record<string, boolean>
  max_tenants_limit: number
  support_email: string
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<AdminSettingsData>('/admin/settings'),
    staleTime: 60_000,
  })
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AdminSettingsData>) =>
      api.patch<AdminSettingsData>('/admin/settings', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })
}
