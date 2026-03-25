import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
export type CampaignType = 'outbound' | 'inbound' | 'follow-up' | 'renewal'

export interface CampaignWizardData {
  // Step 1: Basic Info
  name: string
  type: CampaignType
  description: string
  startDate: string
  endDate: string
  // Step 2: Audience
  audienceSegments: string[]
  targetLeads: number
  excludeExisting: boolean
  // Step 3: Agent & Script
  agentId: string
  scriptId: string
  customGreeting: string
  maxAttempts: number
  // Step 4: Schedule & Limits
  callHoursStart: string
  callHoursEnd: string
  callDays: string[]
  maxCallsPerHour: number
  maxCallsPerDay: number
  timezone: string
  // Step 5: Review (read-only)
}

// Campaign data type kept for backward compat with store consumers
export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  description: string
  startDate: string
  endDate: string
  totalLeads: number
  contacted: number
  converted: number
  agentName: string
  createdAt: string
}

interface CampaignStore {
  // Client-side wizard UI state only — campaign data is fetched via useCampaigns() hook
  wizardStep: number
  wizardData: Partial<CampaignWizardData>
  isWizardOpen: boolean
  openWizard: () => void
  closeWizard: () => void
  setWizardStep: (step: number) => void
  updateWizardData: (data: Partial<CampaignWizardData>) => void
  resetWizard: () => void
}

const INITIAL_WIZARD_DATA: Partial<CampaignWizardData> = {
  name: '',
  type: 'outbound',
  description: '',
  startDate: '',
  endDate: '',
  audienceSegments: [],
  targetLeads: 100,
  excludeExisting: true,
  agentId: '',
  scriptId: '',
  customGreeting: '',
  maxAttempts: 3,
  callHoursStart: '09:00',
  callHoursEnd: '17:00',
  callDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  maxCallsPerHour: 50,
  maxCallsPerDay: 200,
  timezone: 'America/New_York',
}

export const useCampaignStore = create<CampaignStore>()(
  devtools(
    persist(
      (set) => ({
        wizardStep: 1,
        wizardData: INITIAL_WIZARD_DATA,
        isWizardOpen: false,
        openWizard: () => set({ isWizardOpen: true, wizardStep: 1, wizardData: INITIAL_WIZARD_DATA }),
        closeWizard: () => set({ isWizardOpen: false }),
        setWizardStep: (step) => set({ wizardStep: step }),
        updateWizardData: (data) =>
          set((state) => ({ wizardData: { ...state.wizardData, ...data } })),
        resetWizard: () => set({ wizardStep: 1, wizardData: INITIAL_WIZARD_DATA }),
      }),
      { name: 'campaign-wizard-draft', partialize: (state) => ({ wizardData: state.wizardData, wizardStep: state.wizardStep }) }
    ),
    { name: 'campaign-store' }
  )
)
