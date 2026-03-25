import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Stage = 'new' | 'contacted' | 'qualified' | 'quoted' | 'bound' | 'lost'

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  insuranceType: string
  estimatedPremium: number
  source: string
  assignedAgent: string
  lastContact?: string
  notes?: string
  stage: Stage
}

// Simulated data — will be replaced by api.get('/leads') when backend is ready
const SEED_LEADS: Lead[] = [
  { id: '1', name: 'James Wilson', email: 'james@acme.co', phone: '(555) 123-4567', company: 'Acme Corp', insuranceType: 'Commercial General Liability', estimatedPremium: 4200, source: 'Inbound Call', assignedAgent: 'Sarah AI', lastContact: '2 hours ago', stage: 'new' },
  { id: '2', name: 'Maria Garcia', email: 'maria@garcia.net', phone: '(555) 234-5678', insuranceType: 'Home Insurance', estimatedPremium: 1800, source: 'Website', assignedAgent: 'Sarah AI', lastContact: '30 min ago', stage: 'new' },
  { id: '3', name: 'Robert Chen', email: 'rchen@tech.io', phone: '(555) 345-6789', company: 'TechStart Inc', insuranceType: 'Cyber Liability', estimatedPremium: 6500, source: 'Referral', assignedAgent: 'Mike AI', lastContact: '1 day ago', stage: 'contacted' },
  { id: '4', name: 'David Kim', email: 'dkim@enterprise.com', phone: '(555) 567-8901', company: 'Enterprise LLC', insuranceType: "Workers' Comp", estimatedPremium: 8900, source: 'Inbound Call', assignedAgent: 'Alex AI', lastContact: '3 hours ago', stage: 'qualified' },
  { id: '5', name: 'Michael Davis', email: 'm.davis@corp.co', phone: '(555) 789-0123', company: 'Davis & Sons', insuranceType: 'Professional Liability', estimatedPremium: 5400, source: 'Referral', assignedAgent: 'Mike AI', lastContact: '1 day ago', stage: 'quoted' },
  { id: '6', name: 'Patricia Moore', email: 'p.moore@home.com', phone: '(555) 901-2345', insuranceType: 'Home Insurance', estimatedPremium: 2400, source: 'Inbound Call', assignedAgent: 'Sarah AI', lastContact: '2 days ago', stage: 'bound' },
]

let localLeads = [...SEED_LEADS]

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return localLeads
    },
    initialData: localLeads,
    staleTime: 30_000,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<Lead, 'id'>) => {
      await new Promise((r) => setTimeout(r, 300))
      const lead: Lead = { ...data, id: Date.now().toString() }
      localLeads = [lead, ...localLeads]
      return lead
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      await new Promise((r) => setTimeout(r, 200))
      localLeads = localLeads.map((l) => (l.id === id ? { ...l, ...updates } : l))
      return localLeads.find((l) => l.id === id)!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await new Promise((r) => setTimeout(r, 200))
      localLeads = localLeads.filter((l) => l.id !== id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}
