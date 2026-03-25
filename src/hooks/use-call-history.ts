import { useQuery } from '@tanstack/react-query'

export interface CallRecord {
  id: string
  callerName: string
  callerPhone: string
  direction: 'inbound' | 'outbound' | 'missed'
  agent: string
  duration: number
  date: string
  time: string
  outcome: 'converted' | 'follow-up' | 'no-action' | 'transferred' | 'voicemail'
  aiScore: number
  sentiment: 'positive' | 'neutral' | 'negative'
  transcript?: string
  summary?: string
  sentimentTimeline: { time: number; value: number }[]
}

function generateSentimentTimeline(): { time: number; value: number }[] {
  const points: { time: number; value: number }[] = []
  let v = 0
  for (let t = 0; t <= 100; t += 5) {
    v = Math.max(-1, Math.min(1, v + (Math.random() - 0.48) * 0.4))
    points.push({ time: t, value: v })
  }
  return points
}

const MOCK_CALLS: CallRecord[] = [
  { id: 'h1', callerName: 'James Wilson', callerPhone: '(555) 123-4567', direction: 'inbound', agent: 'Sarah AI', duration: 312, date: 'Mar 25, 2026', time: '2:45 PM', outcome: 'converted', aiScore: 92, sentiment: 'positive', summary: 'Customer inquired about auto insurance bundle. Quoted $2,100/yr. Customer accepted.', sentimentTimeline: generateSentimentTimeline() },
  { id: 'h2', callerName: 'Maria Garcia', callerPhone: '(555) 234-5678', direction: 'outbound', agent: 'Mike AI', duration: 187, date: 'Mar 25, 2026', time: '1:30 PM', outcome: 'follow-up', aiScore: 78, sentiment: 'neutral', summary: 'Follow-up call for claims status. Scheduled callback for next week.', sentimentTimeline: generateSentimentTimeline() },
  { id: 'h3', callerName: 'Robert Chen', callerPhone: '(555) 345-6789', direction: 'missed', agent: 'Alex AI', duration: 0, date: 'Mar 25, 2026', time: '12:15 PM', outcome: 'voicemail', aiScore: 0, sentiment: 'neutral', summary: 'Missed inbound call. Voicemail left requesting callback.', sentimentTimeline: [] },
  { id: 'h4', callerName: 'Emily Brown', callerPhone: '(555) 456-7890', direction: 'inbound', agent: 'Sarah AI', duration: 523, date: 'Mar 25, 2026', time: '11:00 AM', outcome: 'transferred', aiScore: 65, sentiment: 'negative', summary: 'Customer called about policy cancellation. Escalated to human agent.', sentimentTimeline: generateSentimentTimeline() },
  { id: 'h5', callerName: 'David Kim', callerPhone: '(555) 567-8901', direction: 'outbound', agent: 'Jordan AI', duration: 245, date: 'Mar 25, 2026', time: '10:30 AM', outcome: 'converted', aiScore: 88, sentiment: 'positive', summary: 'Renewal call. Customer renewed with upgraded coverage.', sentimentTimeline: generateSentimentTimeline() },
]

export function useCallHistory() {
  return useQuery({
    queryKey: ['call-history'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 400))
      return MOCK_CALLS
    },
    initialData: MOCK_CALLS,
    staleTime: 30_000,
  })
}

export function useCallRecord(id: string) {
  return useQuery({
    queryKey: ['call-history', id],
    queryFn: async () => {
      const record = MOCK_CALLS.find((c) => c.id === id)
      if (!record) throw new Error(`Call ${id} not found`)
      return record
    },
    enabled: !!id,
  })
}
