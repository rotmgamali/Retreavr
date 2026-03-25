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
  // Client-side UI state only — agent data is fetched via useAgents() hook
  selectedAgent: VoiceAgent | null
  isConfigDrawerOpen: boolean
  selectAgent: (agent: VoiceAgent | null) => void
  openConfigDrawer: (agent: VoiceAgent) => void
  closeConfigDrawer: () => void
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    (set) => ({
      selectedAgent: null,
      isConfigDrawerOpen: false,
      selectAgent: (agent) => set({ selectedAgent: agent }),
      openConfigDrawer: (agent) => set({ selectedAgent: agent, isConfigDrawerOpen: true }),
      closeConfigDrawer: () => set({ isConfigDrawerOpen: false }),
    }),
    { name: 'agent-store' }
  )
)
