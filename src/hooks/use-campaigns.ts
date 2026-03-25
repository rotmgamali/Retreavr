import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCampaignStore, type Campaign } from '@/stores'

export function useCampaigns() {
  const { campaigns } = useCampaignStore()
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return campaigns
    },
    initialData: campaigns,
    staleTime: 30_000,
  })
}

export function useCreateCampaign() {
  const { addCampaign } = useCampaignStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<Campaign, 'id' | 'createdAt'>) => {
      await new Promise((r) => setTimeout(r, 500))
      const campaign: Campaign = {
        ...data,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      addCampaign(campaign)
      return campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
