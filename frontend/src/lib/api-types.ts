// Shared types matching backend schemas

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  subscription_tier: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VoiceAgent {
  id: string
  organization_id: string
  name: string
  persona: string
  system_prompt: string
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  status: 'active' | 'inactive' | 'draft' | 'training'
  vad_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  insurance_type: string
  status: 'new' | 'contacted' | 'qualified' | 'quoted' | 'bound' | 'lost'
  propensity_score: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface LeadInteraction {
  id: string
  lead_id: string
  interaction_type: string
  notes: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Call {
  id: string
  organization_id: string
  agent_id: string
  lead_id: string | null
  direction: 'inbound' | 'outbound'
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'canceled'
  duration: number | null
  phone_from: string
  phone_to: string
  twilio_sid: string | null
  sentiment_score: number | null
  created_at: string
  updated_at: string
}

export interface CallTranscript {
  id: string
  call_id: string
  transcript: string
  language: string
  created_at: string
}

export interface CallSummary {
  id: string
  call_id: string
  summary: string
  key_points: string[]
  next_actions: string[]
  created_at: string
}

export interface Campaign {
  id: string
  organization_id: string
  name: string
  type: 'outbound_call' | 'email' | 'sms' | 'multi_channel'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KnowledgeDocument {
  id: string
  organization_id: string
  title: string
  file_type: string
  status: 'processing' | 'ready' | 'failed'
  total_chunks: number
  created_at: string
  updated_at: string
}

// Dashboard / Analytics types
export interface DashboardKPIs {
  total_calls: number
  conversion_rate: number
  avg_call_duration: number
  revenue: number
  active_leads: number
  // Day-over-day % change (e.g. 12.5 means +12.5%)
  calls_change: number
  conversion_change: number
  leads_change: number
  revenue_change: number
  // 7-day trend arrays (raw values, same units as the metric)
  calls_trend: number[]
  conversion_trend: number[]
  leads_trend: number[]
  revenue_trend: number[]
}

export interface HeatmapCell {
  hour: number
  day: number
  value: number
}

export interface LiveAgent {
  id: string
  name: string
  status: 'On Call' | 'Available' | 'Paused' | 'Offline'
  callsToday: number
  secondsOnCall: number
}

export interface ConversionWeeklyRow {
  week: string
  calls: number
  qualified: number
  quoted: number
  bound: number
}

export interface LeadSource {
  name: string
  value: number
}

export interface ABTestVariant {
  name: string
  convRate: number
  calls: number
}

export interface ABTest {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'completed' | 'paused'
  variantA: ABTestVariant
  variantB: ABTestVariant
  confidence: number
}

export interface CostRow {
  month: string
  apiCost: number
  telephony: number
  infra: number
  revenue: number
}

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  total_calls: number
  avg_duration: number
  conversion_rate: number
  sentiment_avg: number
}

// Admin panel types
export interface TenantOverview {
  id: string
  name: string
  slug: string
  subscription_tier: string
  total_users: number
  total_calls: number
  total_leads: number
  is_active: boolean
  created_at: string
}

export interface PlatformStats {
  total_tenants: number
  total_calls: number
  total_users: number
  mrr: number
  active_tenants: number
}
