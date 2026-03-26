'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Check, ChevronRight } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampaignFormData {
  name: string
  type: 'outbound' | 'inbound' | 'follow-up' | 'renewal'
  description: string
  startDate: string
  endDate: string
  audienceSegments: string[]
  targetLeads: number
  excludeExisting: boolean
  agentId: string
  customGreeting: string
  maxAttempts: number
  callHoursStart: string
  callHoursEnd: string
  callDays: string[]
  maxCallsPerHour: number
  maxCallsPerDay: number
  timezone: string
}

export interface CampaignWizardProps {
  isOpen: boolean
  onClose: () => void
  onLaunch: (data: CampaignFormData) => void
  onSaveDraft: (data: Partial<CampaignFormData>) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Audience' },
  { id: 3, label: 'Agent & Script' },
  { id: 4, label: 'Schedule' },
  { id: 5, label: 'Review' },
]

const AUDIENCE_SEGMENTS = [
  'Auto Insurance Prospects',
  'Home Insurance Leads',
  'Renewal Eligible',
  'Claims Customers',
  'Cold Leads',
]

interface AgentOption {
  id: string
  name: string
  voice: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const DEFAULT_DATA: CampaignFormData = {
  name: '',
  type: 'outbound',
  description: '',
  startDate: '',
  endDate: '',
  audienceSegments: [],
  targetLeads: 500,
  excludeExisting: false,
  agentId: '',
  customGreeting: '',
  maxAttempts: 3,
  callHoursStart: '09:00',
  callHoursEnd: '17:00',
  callDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  maxCallsPerHour: 20,
  maxCallsPerDay: 150,
  timezone: 'America/New_York',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-blue-400 ml-1">*</span>}
    </label>
  )
}

function FieldWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-1.5', className)}>{children}</div>
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-400 shrink-0 mr-4">{label}</span>
      <span className="text-sm text-slate-200 text-right">{value || '—'}</span>
    </div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepBasicInfo({ data, set }: { data: CampaignFormData; set: (k: keyof CampaignFormData, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <FieldWrap>
        <Label required>Campaign Name</Label>
        <Input
          placeholder="e.g. Q2 Auto Renewal Blitz"
          value={data.name}
          onChange={e => set('name', e.target.value)}
        />
      </FieldWrap>

      <FieldWrap>
        <Label required>Campaign Type</Label>
        <select
          value={data.type}
          onChange={e => set('type', e.target.value)}
          className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
          <option value="follow-up">Follow-up</option>
          <option value="renewal">Renewal</option>
        </select>
      </FieldWrap>

      <FieldWrap>
        <Label>Description</Label>
        <textarea
          rows={3}
          placeholder="Brief description of the campaign goal..."
          value={data.description}
          onChange={e => set('description', e.target.value)}
          className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </FieldWrap>

      <div className="grid grid-cols-2 gap-4">
        <FieldWrap>
          <Label>Start Date</Label>
          <Input type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)} />
        </FieldWrap>
        <FieldWrap>
          <Label>End Date</Label>
          <Input type="date" value={data.endDate} onChange={e => set('endDate', e.target.value)} />
        </FieldWrap>
      </div>
    </div>
  )
}

function StepAudience({ data, set }: { data: CampaignFormData; set: (k: keyof CampaignFormData, v: unknown) => void }) {
  const toggle = (seg: string) => {
    const next = data.audienceSegments.includes(seg)
      ? data.audienceSegments.filter(s => s !== seg)
      : [...data.audienceSegments, seg]
    set('audienceSegments', next)
  }

  return (
    <div className="space-y-4">
      <FieldWrap>
        <Label required>Target Segments</Label>
        <div className="space-y-2">
          {AUDIENCE_SEGMENTS.map(seg => (
            <label key={seg} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => toggle(seg)}
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
                  data.audienceSegments.includes(seg)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-white/20 hover:border-blue-400'
                )}
              >
                {data.audienceSegments.includes(seg) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors" onClick={() => toggle(seg)}>
                {seg}
              </span>
            </label>
          ))}
        </div>
      </FieldWrap>

      <FieldWrap>
        <Label>Target Lead Count</Label>
        <Input
          type="number"
          min={1}
          value={data.targetLeads}
          onChange={e => set('targetLeads', Number(e.target.value))}
        />
      </FieldWrap>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => set('excludeExisting', !data.excludeExisting)}
          className={cn(
            'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
            data.excludeExisting ? 'bg-blue-500' : 'bg-white/10'
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              data.excludeExisting ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </div>
        <span className="text-sm text-slate-300">Exclude existing customers</span>
      </label>
    </div>
  )
}

function StepAgentScript({ data, set, agents }: { data: CampaignFormData; set: (k: keyof CampaignFormData, v: unknown) => void; agents: AgentOption[] }) {
  return (
    <div className="space-y-4">
      <FieldWrap>
        <Label required>Select Agent</Label>
        {agents.length === 0 && (
          <p className="text-sm text-muted-foreground">No voice agents found. Create one first.</p>
        )}
        <div className="space-y-2">
          {agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => set('agentId', agent.id)}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all',
                data.agentId === agent.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                  data.agentId === agent.id ? 'border-blue-500' : 'border-white/30'
                )}
              >
                {data.agentId === agent.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{agent.name}</p>
                <p className="text-xs text-slate-400">{agent.voice}</p>
              </div>
            </div>
          ))}
        </div>
      </FieldWrap>

      <FieldWrap>
        <Label>Custom Greeting Override <span className="text-slate-500 font-normal">(optional)</span></Label>
        <textarea
          rows={3}
          placeholder="Hi, this is {agent_name} calling from Retrevr Insurance..."
          value={data.customGreeting}
          onChange={e => set('customGreeting', e.target.value)}
          className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </FieldWrap>

      <FieldWrap>
        <Label>Max Call Attempts</Label>
        <select
          value={data.maxAttempts}
          onChange={e => set('maxAttempts', Number(e.target.value))}
          className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {[1, 2, 3, 4, 5].map(n => (
            <option key={n} value={n}>{n} attempt{n > 1 ? 's' : ''}</option>
          ))}
        </select>
      </FieldWrap>
    </div>
  )
}

function StepSchedule({ data, set }: { data: CampaignFormData; set: (k: keyof CampaignFormData, v: unknown) => void }) {
  const toggleDay = (day: string) => {
    const next = data.callDays.includes(day)
      ? data.callDays.filter(d => d !== day)
      : [...data.callDays, day]
    set('callDays', next)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FieldWrap>
          <Label>Calls Start</Label>
          <Input type="time" value={data.callHoursStart} onChange={e => set('callHoursStart', e.target.value)} />
        </FieldWrap>
        <FieldWrap>
          <Label>Calls End</Label>
          <Input type="time" value={data.callHoursEnd} onChange={e => set('callHoursEnd', e.target.value)} />
        </FieldWrap>
      </div>

      <FieldWrap>
        <Label>Active Days</Label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                data.callDays.includes(day)
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </FieldWrap>

      <div className="grid grid-cols-2 gap-4">
        <FieldWrap>
          <Label>Max Calls / Hour</Label>
          <Input
            type="number"
            min={1}
            value={data.maxCallsPerHour}
            onChange={e => set('maxCallsPerHour', Number(e.target.value))}
          />
        </FieldWrap>
        <FieldWrap>
          <Label>Max Calls / Day</Label>
          <Input
            type="number"
            min={1}
            value={data.maxCallsPerDay}
            onChange={e => set('maxCallsPerDay', Number(e.target.value))}
          />
        </FieldWrap>
      </div>

      <FieldWrap>
        <Label>Timezone</Label>
        <select
          value={data.timezone}
          onChange={e => set('timezone', e.target.value)}
          className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</option>
          ))}
        </select>
      </FieldWrap>
    </div>
  )
}

function StepReview({ data, agents }: { data: CampaignFormData; agents: AgentOption[] }) {
  const agent = agents.find(a => a.id === data.agentId)
  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-0">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Basic Info</p>
        <ReviewRow label="Name" value={data.name} />
        <ReviewRow label="Type" value={<span className="capitalize">{data.type}</span>} />
        <ReviewRow label="Description" value={data.description} />
        <ReviewRow label="Dates" value={data.startDate && data.endDate ? `${data.startDate} → ${data.endDate}` : null} />
      </div>

      <div className="glass-card p-4 space-y-0">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Audience</p>
        <ReviewRow label="Segments" value={data.audienceSegments.join(', ')} />
        <ReviewRow label="Target Leads" value={data.targetLeads.toLocaleString()} />
        <ReviewRow label="Exclude Existing" value={data.excludeExisting ? 'Yes' : 'No'} />
      </div>

      <div className="glass-card p-4 space-y-0">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Agent & Script</p>
        <ReviewRow label="Agent" value={agent?.name} />
        <ReviewRow label="Max Attempts" value={`${data.maxAttempts}`} />
        <ReviewRow label="Custom Greeting" value={data.customGreeting || 'Default'} />
      </div>

      <div className="glass-card p-4 space-y-0">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Schedule</p>
        <ReviewRow label="Call Hours" value={`${data.callHoursStart} – ${data.callHoursEnd}`} />
        <ReviewRow label="Active Days" value={data.callDays.join(', ')} />
        <ReviewRow label="Limits" value={`${data.maxCallsPerHour}/hr · ${data.maxCallsPerDay}/day`} />
        <ReviewRow label="Timezone" value={data.timezone} />
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function CampaignWizard({ isOpen, onClose, onLaunch, onSaveDraft }: CampaignWizardProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<CampaignFormData>(DEFAULT_DATA)

  const { data: agentsResp } = useQuery<{ items: AgentOption[]; total: number }>({
    queryKey: ['voice-agents-for-campaign'],
    queryFn: () => api.get<{ items: AgentOption[]; total: number }>('/voice-agents/?limit=50'),
    staleTime: 30_000,
    enabled: isOpen,
  })
  const agents: AgentOption[] = (agentsResp?.items ?? []).map(a => ({
    id: a.id,
    name: a.name,
    voice: a.voice,
  }))

  const set = (key: keyof CampaignFormData, value: unknown) => {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const canProceed = () => {
    if (step === 1) return data.name.trim().length > 0
    if (step === 2) return data.audienceSegments.length > 0
    if (step === 3) return data.agentId !== ''
    return true
  }

  const handleClose = () => {
    setStep(1)
    setData(DEFAULT_DATA)
    onClose()
  }

  const stepProps = { data, set }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-[#0f172a] border-white/10">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <DialogTitle className="text-lg font-semibold text-white">New Campaign</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => s.id < step && setStep(s.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 group',
                    s.id < step ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      s.id === step
                        ? 'bg-blue-500 text-white ring-2 ring-blue-500/30'
                        : s.id < step
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/5 text-slate-500'
                    )}
                  >
                    {s.id < step ? <Check className="w-4 h-4" /> : s.id}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium hidden sm:block',
                      s.id === step ? 'text-blue-400' : s.id < step ? 'text-slate-400' : 'text-slate-600'
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2 transition-colors', step > s.id ? 'bg-blue-500/40' : 'bg-white/10')} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-5 overflow-y-auto max-h-[52vh]">
          {step === 1 && <StepBasicInfo {...stepProps} />}
          {step === 2 && <StepAudience {...stepProps} />}
          {step === 3 && <StepAgentScript {...stepProps} agents={agents} />}
          {step === 4 && <StepSchedule {...stepProps} />}
          {step === 5 && <StepReview data={data} agents={agents} />}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                Previous
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSaveDraft(data)}
              className="border-white/10 text-slate-400 hover:text-white"
            >
              Save Draft
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Step {step} of {STEPS.length}</span>
            {step < 5 ? (
              <Button
                size="sm"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onLaunch(data)}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold px-5"
              >
                Launch Campaign
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
