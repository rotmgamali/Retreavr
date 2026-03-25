import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'agent' | 'viewer'
  status: 'active' | 'invited' | 'suspended'
  joinedAt: string
}

export interface Integration {
  id: string
  name: string
  category: 'crm' | 'telephony' | 'analytics' | 'billing' | 'calendar'
  connected: boolean
  lastSync: string | null
  icon: string
}

export interface SettingsStore {
  // Integrations
  integrations: Integration[]
  // Team
  teamMembers: TeamMember[]
  // Billing
  billingPlan: 'starter' | 'growth' | 'enterprise'
  billingEmail: string
  // Notifications
  emailNotifications: boolean
  smsNotifications: boolean
  slackWebhook: string
  notifyOnConversion: boolean
  notifyOnMissedCall: boolean
  dailyDigest: boolean
  // Compliance
  callRecording: boolean
  dataRetentionDays: number
  gdprMode: boolean
  hipaaMode: boolean
  // Branding
  companyName: string
  primaryColor: string
  logoUrl: string
  // Actions
  updateIntegration: (id: string, updates: Partial<Integration>) => void
  updateSettings: (updates: Partial<Omit<SettingsStore, 'integrations' | 'teamMembers' | 'updateIntegration' | 'updateSettings' | 'addTeamMember' | 'updateTeamMember'>>) => void
  addTeamMember: (member: TeamMember) => void
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        integrations: [
          { id: 'salesforce', name: 'Salesforce CRM', category: 'crm', connected: true, lastSync: '2024-03-25T10:00:00Z', icon: '☁️' },
          { id: 'hubspot', name: 'HubSpot', category: 'crm', connected: false, lastSync: null, icon: '🟠' },
          { id: 'twilio', name: 'Twilio', category: 'telephony', connected: true, lastSync: '2024-03-25T10:00:00Z', icon: '📞' },
          { id: 'stripe', name: 'Stripe', category: 'billing', connected: true, lastSync: '2024-03-24T08:00:00Z', icon: '💳' },
          { id: 'google-calendar', name: 'Google Calendar', category: 'calendar', connected: false, lastSync: null, icon: '📅' },
          { id: 'mixpanel', name: 'Mixpanel', category: 'analytics', connected: false, lastSync: null, icon: '📊' },
        ],
        teamMembers: [
          { id: '1', name: 'Alice Johnson', email: 'alice@retrevr.com', role: 'admin', status: 'active', joinedAt: '2023-11-01' },
          { id: '2', name: 'Bob Smith', email: 'bob@retrevr.com', role: 'manager', status: 'active', joinedAt: '2024-01-15' },
          { id: '3', name: 'Carol White', email: 'carol@retrevr.com', role: 'agent', status: 'active', joinedAt: '2024-02-10' },
          { id: '4', name: 'Dave Brown', email: 'dave@retrevr.com', role: 'viewer', status: 'invited', joinedAt: '2024-03-20' },
        ],
        billingPlan: 'growth',
        billingEmail: 'billing@retrevr.com',
        emailNotifications: true,
        smsNotifications: false,
        slackWebhook: '',
        notifyOnConversion: true,
        notifyOnMissedCall: true,
        dailyDigest: true,
        callRecording: true,
        dataRetentionDays: 90,
        gdprMode: false,
        hipaaMode: false,
        companyName: 'Retrevr Insurance',
        primaryColor: '#3b82f6',
        logoUrl: '',
        updateIntegration: (id, updates) =>
          set((state) => ({
            integrations: state.integrations.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          })),
        updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
        addTeamMember: (member) =>
          set((state) => ({ teamMembers: [...state.teamMembers, member] })),
        updateTeamMember: (id, updates) =>
          set((state) => ({
            teamMembers: state.teamMembers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          })),
      }),
      { name: 'settings-store' }
    ),
    { name: 'settings-store' }
  )
)
