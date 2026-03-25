import { useQuery } from '@tanstack/react-query'

export interface ConversionDataPoint {
  week: string
  calls: number
  qualified: number
  quoted: number
  bound: number
}

export interface AgentPerformance {
  name: string
  calls: number
  conversion: number
  avgDuration: number
  satisfaction: number
}

export interface DashboardKPIs {
  totalCalls: number
  conversionRate: number
  activeLeads: number
  revenue: number
  callsChange: number
  conversionChange: number
  leadsChange: number
  revenueChange: number
}

const MOCK_KPIS: DashboardKPIs = {
  totalCalls: 3842,
  conversionRate: 28.3,
  activeLeads: 1247,
  revenue: 142000,
  callsChange: 12.4,
  conversionChange: 2.1,
  leadsChange: 8.7,
  revenueChange: -3.2,
}

const MOCK_AGENTS: AgentPerformance[] = [
  { name: 'Sarah AI', calls: 342, conversion: 32, avgDuration: 4.2, satisfaction: 94 },
  { name: 'Mike AI', calls: 287, conversion: 28, avgDuration: 6.1, satisfaction: 89 },
  { name: 'Alex AI', calls: 198, conversion: 24, avgDuration: 5.4, satisfaction: 91 },
  { name: 'Jordan AI', calls: 256, conversion: 30, avgDuration: 3.8, satisfaction: 92 },
  { name: 'Lisa AI', calls: 167, conversion: 41, avgDuration: 4.8, satisfaction: 96 },
]

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return MOCK_KPIS
    },
    initialData: MOCK_KPIS,
    staleTime: 60_000,
  })
}

export function useAgentPerformance() {
  return useQuery({
    queryKey: ['analytics', 'agents'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return MOCK_AGENTS
    },
    initialData: MOCK_AGENTS,
    staleTime: 60_000,
  })
}
