import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore, type Integration, type TeamMember } from '@/stores'

export function useUpdateIntegration() {
  const { updateIntegration } = useSettingsStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Integration> }) => {
      await new Promise((r) => setTimeout(r, 400))
      updateIntegration(id, updates)
      return { id, ...updates }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useAddTeamMember() {
  const { addTeamMember } = useSettingsStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (member: TeamMember) => {
      await new Promise((r) => setTimeout(r, 300))
      addTeamMember(member)
      return member
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'team'] }),
  })
}

export function useUpdateTeamMember() {
  const { updateTeamMember } = useSettingsStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TeamMember> }) => {
      await new Promise((r) => setTimeout(r, 300))
      updateTeamMember(id, updates)
      return { id, ...updates }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'team'] }),
  })
}
