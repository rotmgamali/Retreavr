import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Types kept for backward compat with consumers that import from stores/index
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
  // Client-side UI state only — team/integration data is fetched via hooks
  // Notifications (local UI state until API is wired)
  emailNotifications: boolean
  smsNotifications: boolean
  slackWebhook: string
  notifyOnConversion: boolean
  notifyOnMissedCall: boolean
  dailyDigest: boolean
  // Compliance (local UI state)
  callRecording: boolean
  dataRetentionDays: number
  gdprMode: boolean
  hipaaMode: boolean
  // Branding (local UI state)
  companyName: string
  primaryColor: string
  logoUrl: string
  // Billing (local UI state)
  billingPlan: 'starter' | 'growth' | 'enterprise'
  billingEmail: string
  // Actions
  updateSettings: (updates: Partial<Omit<SettingsStore, 'updateSettings'>>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
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
        billingPlan: 'growth',
        billingEmail: 'billing@retrevr.com',
        updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
      }),
      { name: 'settings-store' }
    ),
    { name: 'settings-store' }
  )
)
