import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PaginatedResponse } from '@/lib/api-client'
import type { KnowledgeDocument } from '@/lib/api-types'

export function useDocuments(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['knowledge', 'documents', params],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (params?.limit) sp.set('limit', String(params.limit))
      if (params?.offset) sp.set('offset', String(params.offset))
      const qs = sp.toString()
      return api.get<PaginatedResponse<KnowledgeDocument>>(`/knowledge/documents${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ title, file }: { title: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      return api.upload<KnowledgeDocument>('/knowledge/documents', formData)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useRetrieveKnowledge() {
  return useMutation({
    mutationFn: (data: { query: string; top_k?: number }) =>
      api.post<{ results: { chunk_text: string; score: number; document_title: string }[] }>('/knowledge/retrieve', data),
  })
}
