import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAgentStore, type VoiceAgent } from '@/stores'

// In a real app these would hit an API — for now they use the Zustand store as source of truth
export function useAgents() {
  const { agents, setLoading } = useAgentStore()
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      setLoading(true)
      // Simulate API call
      await new Promise((r) => setTimeout(r, 400))
      setLoading(false)
      return agents
    },
    initialData: agents,
    staleTime: 30_000,
  })
}

export function useAgent(id: string) {
  const { agents } = useAgentStore()
  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const agent = agents.find((a) => a.id === id)
      if (!agent) throw new Error(`Agent ${id} not found`)
      return agent
    },
    enabled: !!id,
  })
}

export function useUpdateAgent() {
  const { updateAgent } = useAgentStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<VoiceAgent> }) => {
      await new Promise((r) => setTimeout(r, 300))
      updateAgent(id, updates)
      return { id, ...updates }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
