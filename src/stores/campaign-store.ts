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
  campaigns: Campaign[]
  wizardStep: number
  wizardData: Partial<CampaignWizardData>
  isWizardOpen: boolean
  openWizard: () => void
  closeWizard: () => void
  setWizardStep: (step: number) => void
  updateWizardData: (data: Partial<CampaignWizardData>) => void
  resetWizard: () => void
  saveDraft: () => void
  addCampaign: (campaign: Campaign) => void
  updateCampaign: (id: string, updates: Partial<Campaign>) => void
}

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Q1 Auto Insurance Push',
    type: 'outbound',
    status: 'active',
    description: 'Target existing home insurance customers for auto cross-sell',
    startDate: '2024-01-15',
    endDate: '2024-03-31',
    totalLeads: 1500,
    contacted: 847,
    converted: 213,
    agentName: 'Sarah AI',
    createdAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '2',
    name: 'Home Insurance Renewal',
    type: 'renewal',
    status: 'scheduled',
    description: 'Proactive renewal outreach for policies expiring in 60 days',
    startDate: '2024-04-01',
    endDate: '2024-04-30',
    totalLeads: 320,
    contacted: 0,
    converted: 0,
    agentName: 'Lisa AI',
    createdAt: '2024-03-20T00:00:00Z',
  },
  {
    id: '3',
    name: 'Claims Follow-Up',
    type: 'follow-up',
    status: 'paused',
    description: 'Follow up on open claims older than 14 days',
    startDate: '2024-02-01',
    endDate: '2024-04-01',
    totalLeads: 89,
    contacted: 56,
    converted: 0,
    agentName: 'Alex AI',
    createdAt: '2024-01-28T00:00:00Z',
  },
]

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
      (set, get) => ({
        campaigns: DEFAULT_CAMPAIGNS,
        wizardStep: 1,
        wizardData: INITIAL_WIZARD_DATA,
        isWizardOpen: false,
        openWizard: () => set({ isWizardOpen: true, wizardStep: 1, wizardData: INITIAL_WIZARD_DATA }),
        closeWizard: () => set({ isWizardOpen: false }),
        setWizardStep: (step) => set({ wizardStep: step }),
        updateWizardData: (data) =>
          set((state) => ({ wizardData: { ...state.wizardData, ...data } })),
        resetWizard: () => set({ wizardStep: 1, wizardData: INITIAL_WIZARD_DATA }),
        saveDraft: () => {
          const { wizardData } = get()
          const draft: Campaign = {
            id: Date.now().toString(),
            name: wizardData.name || 'Untitled Draft',
            type: wizardData.type || 'outbound',
            status: 'draft',
            description: wizardData.description || '',
            startDate: wizardData.startDate || '',
            endDate: wizardData.endDate || '',
            totalLeads: wizardData.targetLeads || 0,
            contacted: 0,
            converted: 0,
            agentName: '',
            createdAt: new Date().toISOString(),
          }
          set((state) => ({ campaigns: [...state.campaigns, draft] }))
        },
        addCampaign: (campaign) =>
          set((state) => ({ campaigns: [...state.campaigns, campaign] })),
        updateCampaign: (id, updates) =>
          set((state) => ({
            campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
          })),
      }),
      { name: 'campaign-wizard-draft', partialize: (state) => ({ wizardData: state.wizardData, wizardStep: state.wizardStep }) }
    ),
    { name: 'campaign-store' }
  )
)
