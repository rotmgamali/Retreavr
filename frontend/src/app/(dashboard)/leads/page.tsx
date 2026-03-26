'use client'

import { useState } from 'react'
import { SkeletonToContent } from '@/components/animations'
import { LeadsSkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useLeadInteractions, useCreateInteraction } from '@/hooks/use-leads'
import type { LeadApi } from '@/hooks/use-leads'
import { useAgents } from '@/hooks/use-agents'
import { GripVertical, Phone, Mail, Calendar, MoreHorizontal, Plus, Search, Filter, DollarSign, User, Clock, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'

// ── Types ────────────────────────────────────────────────────────────────────

interface Lead {
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

type Stage = 'new' | 'contacted' | 'qualified' | 'quoted' | 'bound' | 'lost'

// ── API mapper ───────────────────────────────────────────────────────────────

function apiToUiLead(lead: LeadApi): Lead {
  const meta = (lead.metadata ?? {}) as Record<string, unknown>
  return {
    id: lead.id,
    name: `${lead.first_name} ${lead.last_name}`.trim(),
    email: lead.email,
    phone: lead.phone,
    company: meta.company as string | undefined,
    insuranceType: lead.insurance_type,
    estimatedPremium: (meta.estimated_premium as number) ?? 0,
    source: (meta.source as string) ?? 'Unknown',
    assignedAgent: (meta.assigned_agent as string) ?? '—',
    lastContact: meta.last_contact as string | undefined,
    notes: meta.notes as string | undefined,
    stage: lead.status as Stage,
  }
}

// ── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { key: Stage; label: string; color: string; dotColor: string }[] = [
  { key: 'new', label: 'New Lead', color: 'bg-blue-500/20 text-blue-400', dotColor: 'bg-blue-400' },
  { key: 'contacted', label: 'Contacted', color: 'bg-cyan-500/20 text-cyan-400', dotColor: 'bg-cyan-400' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-500/20 text-purple-400', dotColor: 'bg-purple-400' },
  { key: 'quoted', label: 'Quoted', color: 'bg-amber-500/20 text-amber-400', dotColor: 'bg-amber-400' },
  { key: 'bound', label: 'Bound', color: 'bg-green-500/20 text-green-400', dotColor: 'bg-green-400' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500/20 text-red-400', dotColor: 'bg-red-400' },
]

// ── Constants ─────────────────────────────────────────────────────────────────

const INSURANCE_TYPES = [
  'Auto Insurance', 'Home Insurance', 'Life Insurance', 'Health Insurance',
  'Commercial General Liability', 'Cyber Liability', "Workers' Comp",
  'Professional Liability', 'D&O Insurance', 'Commercial Package',
]

// ── Add Lead Dialog ───────────────────────────────────────────────────────────

function AddLeadDialog({
  open,
  onClose,
  onAdd,
  agentsList,
}: {
  open: boolean
  onClose: () => void
  onAdd: (lead: Lead) => void
  agentsList: string[]
}) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '',
    insuranceType: 'Auto Insurance', estimatedPremium: '',
    assignedAgent: agentsList[0] ?? '', source: 'Website', notes: '', stage: 'new' as Stage,
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = () => {
    if (!form.name || !form.phone) return
    onAdd({
      id: String(Date.now()),
      name: form.name, email: form.email, phone: form.phone,
      company: form.company || undefined,
      insuranceType: form.insuranceType,
      estimatedPremium: Number(form.estimatedPremium) || 0,
      assignedAgent: form.assignedAgent, source: form.source,
      notes: form.notes || undefined, lastContact: 'just now',
      stage: form.stage,
    })
    setForm({ name: '', email: '', phone: '', company: '', insuranceType: 'Auto Insurance', estimatedPremium: '', assignedAgent: agentsList[0] ?? '', source: 'Website', notes: '', stage: 'new' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0f172a] border-white/10">
        <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Full Name *</label>
              <Input placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone *</label>
              <Input placeholder="(555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email</label>
              <Input placeholder="jane@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Company</label>
              <Input placeholder="Acme Corp" value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Insurance Type</label>
            <Select value={form.insuranceType} onValueChange={v => set('insuranceType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Est. Premium ($)</label>
              <Input type="number" placeholder="2500" value={form.estimatedPremium} onChange={e => set('estimatedPremium', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Source</label>
              <Select value={form.source} onValueChange={v => set('source', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Website', 'Inbound Call', 'Campaign', 'Referral', 'Walk-in'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Assigned Agent</label>
              <Select value={form.assignedAgent} onValueChange={v => set('assignedAgent', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agentsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Starting Stage</label>
              <Select value={form.stage} onValueChange={v => set('stage', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Notes</label>
            <Textarea placeholder="Any relevant context…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white">Add Lead</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Lead Detail Dialog ────────────────────────────────────────────────────────

const INTERACTION_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  note: MessageSquare,
  meeting: Calendar,
  sms: MessageSquare,
}

function InteractionTimeline({ leadId }: { leadId: string }) {
  const { data: interactionsData, isLoading } = useLeadInteractions(leadId)
  const createInteraction = useCreateInteraction()
  const [showForm, setShowForm] = useState(false)
  const [interactionType, setInteractionType] = useState('note')
  const [interactionNotes, setInteractionNotes] = useState('')

  const interactions = interactionsData?.items ?? []

  const handleSubmit = async () => {
    if (!interactionNotes.trim()) return
    try {
      await createInteraction.mutateAsync({ leadId, data: { interaction_type: interactionType, notes: interactionNotes } })
      setInteractionNotes('')
      setInteractionType('note')
      setShowForm(false)
      toast.success('Interaction logged')
    } catch {
      toast.error('Failed to log interaction')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-slate-500">Activity</label>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Log Interaction'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 mb-3 space-y-2">
          <Select value={interactionType} onValueChange={setInteractionType}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['call', 'email', 'note', 'meeting', 'sms'].map(t => (
                <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Notes..." value={interactionNotes} onChange={e => setInteractionNotes(e.target.value)} rows={2} className="text-xs" />
          <Button size="sm" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-500 text-white" onClick={handleSubmit} disabled={createInteraction.isPending}>
            Submit
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-500 py-2">Loading activity...</p>
      ) : interactions.length === 0 ? (
        <p className="text-xs text-slate-600 italic py-2">No interactions yet</p>
      ) : (
        <div className="space-y-0 max-h-[180px] overflow-y-auto">
          {interactions.map((interaction, idx) => {
            const Icon = INTERACTION_ICONS[interaction.interaction_type] ?? MessageSquare
            return (
              <div key={interaction.id} className="flex gap-3 relative">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3 w-3 text-slate-400" />
                  </div>
                  {idx < interactions.length - 1 && <div className="w-px flex-1 bg-white/10 my-0.5" />}
                </div>
                <div className="pb-3 min-w-0">
                  <p className="text-xs text-slate-300">{interaction.notes}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    <span className="capitalize">{interaction.interaction_type}</span> &middot; {new Date(interaction.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LeadDetailDialog({
  lead,
  onClose,
  onUpdate,
  onDelete,
  agentsList,
}: {
  lead: Lead | null
  onClose: () => void
  onUpdate: (lead: Lead) => void
  onDelete: (id: string) => void
  agentsList: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Lead | null>(null)

  if (!lead) return null

  const col = COLUMNS.find(c => c.key === lead.stage)
  const setField = (k: keyof Lead, v: string | number) =>
    setForm(p => p ? { ...p, [k]: v } : null)

  const handleEdit = () => { setForm({ ...lead }); setEditing(true) }
  const handleSave = () => { if (form) { onUpdate(form); setEditing(false) } }
  const handleCancel = () => setEditing(false)

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-[#0f172a] border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{lead.name}</DialogTitle>
              {lead.company && <p className="text-sm text-slate-400 mt-0.5">{lead.company}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dotColor}`} />
              <span className="text-sm text-slate-400">{col?.label}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Badge */}
          <Badge variant="info">{lead.insuranceType}</Badge>

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500 shrink-0" />
              {editing ? (
                <Input value={form?.phone} onChange={e => setField('phone', e.target.value)} className="h-7 text-sm" />
              ) : <span>{lead.phone}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              {editing ? (
                <Input value={form?.email} onChange={e => setField('email', e.target.value)} className="h-7 text-sm" />
              ) : <span className="text-slate-300">{lead.email || '—'}</span>}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
              {editing ? (
                <Input type="number" value={form?.estimatedPremium} onChange={e => setField('estimatedPremium', Number(e.target.value))} className="h-7 text-sm" />
              ) : <span className="text-green-400 font-semibold">${lead.estimatedPremium.toLocaleString()}</span>}
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Last contact {lead.lastContact}</span>
            </div>
          </div>

          {/* Agent & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Agent</label>
              {editing ? (
                <Select value={form?.assignedAgent} onValueChange={v => setField('assignedAgent', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{agentsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-500" />
                  <span>{lead.assignedAgent}</span>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Stage</label>
              {editing ? (
                <Select value={form?.stage} onValueChange={v => setField('stage', v as Stage)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-slate-300">{col?.label}</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Notes</label>
            {editing ? (
              <Textarea value={form?.notes ?? ''} onChange={e => setField('notes', e.target.value)} rows={3} className="text-sm" />
            ) : (
              <p className="text-sm text-slate-300 rounded-lg bg-white/5 border border-white/10 p-3 min-h-[60px]">
                {lead.notes || <span className="text-slate-600 italic">No notes</span>}
              </p>
            )}
          </div>

          {/* Activity / Interaction History */}
          <InteractionTimeline leadId={lead.id} />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <Button size="sm" variant="destructive" className="text-xs" onClick={() => { onDelete(lead.id); onClose() }}>
              Delete Lead
            </Button>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={handleSave}>Save</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleEdit}>Edit</Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onDragStart, onClick }: { lead: Lead; onDragStart: (e: React.DragEvent, lead: Lead) => void; onClick: (lead: Lead) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="group rounded-lg border border-white/10 bg-white/[0.03] p-3 cursor-grab active:cursor-grabbing hover:border-white/20 hover:bg-white/[0.06] transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <p className="text-sm font-medium truncate">{lead.name}</p>
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white p-0.5">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {lead.company && (
        <p className="text-xs text-slate-500 mb-2 truncate">{lead.company}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="info" className="text-[10px] px-1.5 py-0">{lead.insuranceType}</Badge>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-green-400 font-semibold">
          ${lead.estimatedPremium.toLocaleString()}
        </span>
        <span className="text-slate-500">{lead.assignedAgent}</span>
      </div>

      {lead.lastContact && (
        <p className="text-[10px] text-slate-600 mt-1.5">{lead.lastContact}</p>
      )}

      <div className="flex gap-1.5 mt-2 pt-2 border-t border-white/5">
        <button className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-white/5">
          <Phone className="h-3 w-3" />
        </button>
        <button className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-white/5">
          <Mail className="h-3 w-3" />
        </button>
        <button className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-white/5">
          <Calendar className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LeadPipelinePage() {
  const loading = usePageLoading(700)
  const { data: leadsData } = useLeads()
  const { data: agentsData } = useAgents({ limit: 50 })
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()

  const agentsList = (agentsData?.items ?? []).map(a => a.name)

  const leads: Lead[] = (leadsData?.items ?? []).map(apiToUiLead)

  const [dragOverColumn, setDragOverColumn] = useState<Stage | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterInsuranceType, setFilterInsuranceType] = useState<string>('all')
  const [filterStage, setFilterStage] = useState<string>('all')

  const filteredLeads = leads.filter(l => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !l.name.toLowerCase().includes(q) &&
        !l.insuranceType.toLowerCase().includes(q) &&
        !l.assignedAgent.toLowerCase().includes(q)
      ) return false
    }
    if (filterInsuranceType !== 'all' && !l.insuranceType.toLowerCase().includes(filterInsuranceType.toLowerCase())) return false
    if (filterStage !== 'all' && l.stage !== filterStage) return false
    return true
  })

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, stage: Stage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(stage)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, stage: Stage) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    setDragOverColumn(null)
    updateLead.mutate({ id: leadId, updates: { status: stage } })
  }

  const handleAddLead = async (lead: Lead) => {
    const parts = lead.name.trim().split(' ')
    const first_name = parts[0] ?? ''
    const last_name = parts.slice(1).join(' ') || first_name
    await createLead.mutateAsync({
      first_name,
      last_name,
      email: lead.email,
      phone: lead.phone,
      insurance_type: lead.insuranceType,
      status: lead.stage,
      metadata: {
        company: lead.company,
        estimated_premium: lead.estimatedPremium,
        source: lead.source,
        assigned_agent: lead.assignedAgent,
        notes: lead.notes,
      },
    })
  }

  const handleUpdateLead = async (updated: Lead) => {
    setSelectedLead(updated)
    const parts = updated.name.trim().split(' ')
    const first_name = parts[0] ?? ''
    const last_name = parts.slice(1).join(' ') || first_name
    await updateLead.mutateAsync({
      id: updated.id,
      updates: {
        first_name,
        last_name,
        email: updated.email,
        phone: updated.phone,
        insurance_type: updated.insuranceType,
        status: updated.stage,
        metadata: {
          company: updated.company,
          estimated_premium: updated.estimatedPremium,
          source: updated.source,
          assigned_agent: updated.assignedAgent,
          notes: updated.notes,
        },
      },
    })
  }

  const handleDeleteLead = async (id: string) => {
    await deleteLead.mutateAsync(id)
  }

  // Stats
  const totalPipeline = leads.reduce((s, l) => s + l.estimatedPremium, 0)
  const boundPremium = leads.filter(l => l.stage === 'bound').reduce((s, l) => s + l.estimatedPremium, 0)

  return (
    <SkeletonToContent loading={loading} skeleton={<LeadsSkeleton />}>
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            ${totalPipeline.toLocaleString()} total pipeline &middot; ${boundPremium.toLocaleString()} bound
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-3.5 w-3.5" />
              Filter
              {(filterInsuranceType !== 'all' || filterStage !== 'all') && (
                <span className="ml-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">!</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Insurance Type</label>
              <Select value={filterInsuranceType} onValueChange={setFilterInsuranceType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {['auto', 'home', 'life', 'health', 'commercial', 'renters', 'umbrella'].map(t => (
                    <SelectItem key={t} value={t} className="capitalize text-xs">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Stage</label>
              <Select value={filterStage} onValueChange={setFilterStage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {COLUMNS.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterInsuranceType !== 'all' || filterStage !== 'all') && (
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => { setFilterInsuranceType('all'); setFilterStage('all') }}>
                Clear Filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const columnLeads = filteredLeads.filter(l => l.stage === col.key)
          const columnValue = columnLeads.reduce((s, l) => s + l.estimatedPremium, 0)
          const isDragOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              className="min-w-[260px] w-[260px] shrink-0"
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="text-xs text-muted-foreground bg-white/10 rounded-full px-2 py-0.5">
                    {columnLeads.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  ${columnValue.toLocaleString()}
                </span>
              </div>

              {/* Cards container */}
              <div
                className={`space-y-2 min-h-[400px] rounded-lg border p-2 transition-colors ${
                  isDragOver
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                {columnLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} onClick={setSelectedLead} />
                ))}
                {columnLeads.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-8">
                    Drop leads here
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dialogs */}
      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddLead} agentsList={agentsList} />
      <LeadDetailDialog
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={handleUpdateLead}
        onDelete={handleDeleteLead}
        agentsList={agentsList}
      />
    </div>
    </ErrorBoundary>
    </SkeletonToContent>
  )
}
