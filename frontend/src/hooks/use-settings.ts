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
  security: Record<string, boolean>
  notifications: Record<string, boolean>
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

// ─── DNC List ──────────────────────────────────────────────────────────────

export function useDncList() {
  return useQuery({
    queryKey: ['settings', 'dnc'],
    queryFn: () => api.get<{ total: number; numbers: string[] }>('/settings/dnc'),
    staleTime: 30_000,
  })
}

export function useUploadDnc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<{ uploaded: number; total_dnc: number; new_added: number }>('/settings/dnc/upload', formData)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'dnc'] }),
  })
}

export function useClearDnc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/settings/dnc'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'dnc'] }),
  })
}

// ─── Audit Logs ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export function useAuditLogs(params?: { limit?: number; offset?: number; action?: string; resource_type?: string } | undefined) {
  return useQuery({
    queryKey: ['settings', 'audit-logs', params],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (params?.limit) sp.set('limit', String(params.limit))
      if (params?.offset) sp.set('offset', String(params.offset))
      if (params?.action) sp.set('action', params.action)
      if (params?.resource_type) sp.set('resource_type', params.resource_type)
      const qs = sp.toString()
      return api.get<{ items: AuditLogEntry[]; total: number }>(`/settings/audit-logs${qs ? `?${qs}` : ''}`)
    },
    enabled: params !== undefined,
    staleTime: 15_000,
  })
}

// ─── Notification Rules ────────────────────────────────────────────────────

export interface NotificationRule {
  id: string
  name: string
  trigger_event: string
  conditions: Record<string, unknown> | null
  actions: Record<string, unknown> | null
  is_active: boolean
}

export function useNotificationRules() {
  return useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () => api.get<NotificationRule[]>('/settings/notifications'),
    staleTime: 30_000,
  })
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; trigger_event: string; conditions?: Record<string, unknown>; actions?: Record<string, unknown> }) =>
      api.post<NotificationRule>('/settings/notifications', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] }),
  })
}

export function useUpdateNotificationRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NotificationRule> }) =>
      api.patch<NotificationRule>(`/settings/notifications/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] }),
  })
}

// ─── API Keys ──────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface ApiKeyCreated extends ApiKeyRow {
  full_key: string
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: () => api.get<ApiKeyRow[]>('/settings/api-keys'),
    staleTime: 30_000,
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<ApiKeyCreated>('/settings/api-keys', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] }),
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/settings/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] }),
  })
}
