import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type AgentStatus = 'active' | 'inactive' | 'training'
export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export interface AgentTool {
  id: string
  name: string
  enabled: boolean
  description: string
}

export interface VoiceAgent {
  id: string
  name: string
  status: AgentStatus
  persona: string
  voice: VoiceOption
  knowledgeBase: string[]
  tools: AgentTool[]
  vadThreshold: number
  maxCallDuration: number
  language: string
  greeting: string
  systemPrompt: string
  callsToday: number
  conversionRate: number
  avgCallDuration: string
  createdAt: string
  updatedAt: string
}

interface AgentStore {
  agents: VoiceAgent[]
  selectedAgent: VoiceAgent | null
  isConfigDrawerOpen: boolean
  isLoading: boolean
  setAgents: (agents: VoiceAgent[]) => void
  selectAgent: (agent: VoiceAgent | null) => void
  openConfigDrawer: (agent: VoiceAgent) => void
  closeConfigDrawer: () => void
  updateAgent: (id: string, updates: Partial<VoiceAgent>) => void
  setLoading: (loading: boolean) => void
}

const DEFAULT_AGENTS: VoiceAgent[] = [
  {
    id: '1',
    name: 'Sarah AI',
    status: 'active',
    persona: 'Friendly and professional insurance advisor',
    voice: 'nova',
    knowledgeBase: ['auto-insurance-guide.pdf', 'claims-process.pdf'],
    tools: [
      { id: 'quote', name: 'Quote Generator', enabled: true, description: 'Generate insurance quotes' },
      { id: 'calendar', name: 'Calendar Booking', enabled: true, description: 'Schedule appointments' },
      { id: 'crm', name: 'CRM Lookup', enabled: false, description: 'Look up customer records' },
    ],
    vadThreshold: 0.6,
    maxCallDuration: 20,
    language: 'en-US',
    greeting: 'Hi, I\'m Sarah! How can I help you with your insurance needs today?',
    systemPrompt: 'You are a helpful insurance advisor...',
    callsToday: 47,
    conversionRate: 34,
    avgCallDuration: '4:23',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-03-10T00:00:00Z',
  },
  {
    id: '2',
    name: 'Mike AI',
    status: 'active',
    persona: 'Direct and efficient insurance specialist',
    voice: 'onyx',
    knowledgeBase: ['home-insurance-faq.pdf'],
    tools: [
      { id: 'quote', name: 'Quote Generator', enabled: true, description: 'Generate insurance quotes' },
      { id: 'calendar', name: 'Calendar Booking', enabled: false, description: 'Schedule appointments' },
    ],
    vadThreshold: 0.5,
    maxCallDuration: 15,
    language: 'en-US',
    greeting: 'Hello, this is Mike. Let\'s find you the best insurance plan.',
    systemPrompt: 'You are an insurance specialist focused on efficiency...',
    callsToday: 31,
    conversionRate: 28,
    avgCallDuration: '3:45',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-12T00:00:00Z',
  },
  {
    id: '3',
    name: 'Alex AI',
    status: 'training',
    persona: 'Empathetic claims assistant',
    voice: 'echo',
    knowledgeBase: [],
    tools: [],
    vadThreshold: 0.7,
    maxCallDuration: 30,
    language: 'en-US',
    greeting: 'Hi there, I\'m Alex. I\'m here to help with your claim.',
    systemPrompt: 'You are an empathetic claims assistant...',
    callsToday: 0,
    conversionRate: 0,
    avgCallDuration: '0:00',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: '4',
    name: 'Lisa AI',
    status: 'inactive',
    persona: 'Senior policy renewal specialist',
    voice: 'shimmer',
    knowledgeBase: ['renewal-guide.pdf'],
    tools: [
      { id: 'quote', name: 'Quote Generator', enabled: true, description: 'Generate insurance quotes' },
    ],
    vadThreshold: 0.6,
    maxCallDuration: 20,
    language: 'en-US',
    greeting: 'Hello, I\'m Lisa. I\'ll help you review and renew your policy.',
    systemPrompt: 'You are a renewal specialist...',
    callsToday: 0,
    conversionRate: 42,
    avgCallDuration: '5:10',
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
]

export const useAgentStore = create<AgentStore>()(
  devtools(
    (set) => ({
      agents: DEFAULT_AGENTS,
      selectedAgent: null,
      isConfigDrawerOpen: false,
      isLoading: false,
      setAgents: (agents) => set({ agents }),
      selectAgent: (agent) => set({ selectedAgent: agent }),
      openConfigDrawer: (agent) => set({ selectedAgent: agent, isConfigDrawerOpen: true }),
      closeConfigDrawer: () => set({ isConfigDrawerOpen: false }),
      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
          selectedAgent:
            state.selectedAgent?.id === id
              ? { ...state.selectedAgent, ...updates }
              : state.selectedAgent,
        })),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    { name: 'agent-store' }
  )
)
