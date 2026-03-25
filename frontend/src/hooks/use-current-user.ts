import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api-client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.getMe(),
    staleTime: 300_000,
    retry: 1,
  })
}
