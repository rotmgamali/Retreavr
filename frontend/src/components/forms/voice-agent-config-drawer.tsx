'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Upload, Trash2, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────
type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
type AgentStatus = 'active' | 'inactive' | 'training'
interface AgentTool { id: string; name: string; enabled: boolean; description: string }
export interface VoiceAgent {
  id: string; name: string; status: AgentStatus; persona: string; voice: VoiceOption
  knowledgeBase: string[]; tools: AgentTool[]; vadThreshold: number; maxCallDuration: number
  language: string; greeting: string; systemPrompt: string
  callsToday: number; conversionRate: number; avgCallDuration: string
  createdAt: string; updatedAt: string
}

export interface VoiceAgentConfigDrawerProps {
  agent: VoiceAgent
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<VoiceAgent>) => void
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  persona: z.string(),
  status: z.enum(['active', 'inactive', 'training']),
  greeting: z.string().min(1, 'Greeting is required'),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  language: z.string(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  knowledgeBase: z.array(z.string()),
  tools: z.array(z.object({ id: z.string(), name: z.string(), enabled: z.boolean(), description: z.string() })),
  vadThreshold: z.number().min(0).max(1),
  maxCallDuration: z.number().min(1).max(120),
})

type FormValues = z.infer<typeof schema>

// ── Voice options metadata ─────────────────────────────────────────────────────
const VOICE_OPTIONS: { id: VoiceOption; label: string; desc: string }[] = [
  { id: 'alloy',   label: 'Alloy',   desc: 'Neutral & balanced' },
  { id: 'echo',    label: 'Echo',    desc: 'Warm & resonant' },
  { id: 'fable',   label: 'Fable',   desc: 'Expressive & dynamic' },
  { id: 'onyx',    label: 'Onyx',    desc: 'Deep & authoritative' },
  { id: 'nova',    label: 'Nova',    desc: 'Bright & friendly' },
  { id: 'shimmer', label: 'Shimmer', desc: 'Soft & soothing' },
]

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Spanish (ES)' },
  { value: 'fr-FR', label: 'French (FR)' },
  { value: 'de-DE', label: 'German (DE)' },
]

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function VoiceAgentConfigDrawer({ agent, isOpen, onClose, onSave }: VoiceAgentConfigDrawerProps) {
  const { control, register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: agent.name,
      persona: agent.persona,
      status: agent.status,
      greeting: agent.greeting,
      systemPrompt: agent.systemPrompt,
      language: agent.language,
      voice: agent.voice,
      knowledgeBase: agent.knowledgeBase,
      tools: agent.tools,
      vadThreshold: agent.vadThreshold,
      maxCallDuration: agent.maxCallDuration,
    },
  })

  React.useEffect(() => {
    reset({
      name: agent.name,
      persona: agent.persona,
      status: agent.status,
      greeting: agent.greeting,
      systemPrompt: agent.systemPrompt,
      language: agent.language,
      voice: agent.voice,
      knowledgeBase: agent.knowledgeBase,
      tools: agent.tools,
      vadThreshold: agent.vadThreshold,
      maxCallDuration: agent.maxCallDuration,
    })
  }, [agent.id, reset])

  const knowledgeBase = watch('knowledgeBase')
  const tools = watch('tools')
  const selectedVoice = watch('voice')
  const vadThreshold = watch('vadThreshold')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setValue('knowledgeBase', [...knowledgeBase, ...files.map(f => f.name)])
    e.target.value = ''
  }

  const removeFile = (idx: number) => setValue('knowledgeBase', knowledgeBase.filter((_, i) => i !== idx))

  const toggleTool = (idx: number) => {
    const updated = tools.map((t, i) => i === idx ? { ...t, enabled: !t.enabled } : t)
    setValue('tools', updated)
  }

  const onSubmit = (data: FormValues) => { onSave(data); onClose() }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="fixed right-0 top-0 h-full w-full max-w-2xl translate-x-0 translate-y-0 left-auto rounded-none rounded-l-xl border-white/10 bg-[#0f172a] p-0 flex flex-col gap-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <DialogTitle className="text-lg font-semibold">Configure Agent</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Tabs */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <Tabs defaultValue="persona" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-6 mt-4 shrink-0 w-auto justify-start gap-1 h-auto flex-wrap bg-white/5">
              {['persona', 'voice', 'knowledge', 'tools', 'advanced'].map(tab => (
                <TabsTrigger key={tab} value={tab} className="capitalize text-xs px-3 py-1.5">
                  {tab === 'knowledge' ? 'Knowledge Base' : tab}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* ── Persona ── */}
              <TabsContent value="persona" className="mt-0 space-y-4">
                <Field label="Agent Name" error={errors.name?.message}>
                  <Input {...register('name')} placeholder="e.g. Sarah AI" />
                </Field>
                <Field label="Persona" error={errors.persona?.message}>
                  <Input {...register('persona')} placeholder="e.g. Friendly insurance advisor" />
                </Field>
                <Field label="Status">
                  <Controller name="status" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </Field>
                <Field label="Language">
                  <Controller name="language" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </Field>
                <Field label="Greeting" error={errors.greeting?.message}>
                  <Textarea {...register('greeting')} rows={3} placeholder="Opening greeting script..." />
                </Field>
                <Field label="System Prompt" error={errors.systemPrompt?.message}>
                  <Textarea {...register('systemPrompt')} rows={6} placeholder="Detailed instructions for agent behavior..." />
                </Field>
              </TabsContent>

              {/* ── Voice ── */}
              <TabsContent value="voice" className="mt-0 space-y-3">
                <p className="text-sm text-muted-foreground mb-3">Select a voice for your agent</p>
                <div className="grid grid-cols-2 gap-3">
                  {VOICE_OPTIONS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setValue('voice', v.id)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        selectedVoice === v.id
                          ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_#3b82f6]'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{v.label}</span>
                        <span className={cn('h-3 w-3 rounded-full border-2', selectedVoice === v.id ? 'border-blue-500 bg-blue-500' : 'border-white/30')} />
                      </div>
                      <span className="text-xs text-muted-foreground">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* ── Knowledge Base ── */}
              <TabsContent value="knowledge" className="mt-0 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{knowledgeBase.length} file(s) uploaded</p>
                  <label className="cursor-pointer">
                    <input type="file" multiple accept=".pdf,.docx,.txt" className="sr-only" onChange={handleFileUpload} />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Plus className="h-3 w-3 mr-1" /><Upload className="h-3 w-3 mr-1" />Upload</span>
                    </Button>
                  </label>
                </div>
                {knowledgeBase.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
                    No files uploaded yet. Upload .pdf, .docx, or .txt files.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {knowledgeBase.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                        <span className="text-sm truncate max-w-[80%]">{file}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => removeFile(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Tools ── */}
              <TabsContent value="tools" className="mt-0 space-y-3">
                {tools.map((tool, idx) => (
                  <div key={tool.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                    <Switch checked={tool.enabled} onCheckedChange={() => toggleTool(idx)} />
                  </div>
                ))}
                {tools.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No tools configured.</p>
                )}
              </TabsContent>

              {/* ── Advanced ── */}
              <TabsContent value="advanced" className="mt-0 space-y-6">
                <Field label={`VAD Threshold — ${vadThreshold.toFixed(2)}`}>
                  <div className="pt-2 pb-1">
                    <Controller name="vadThreshold" control={control} render={({ field }) => (
                      <Slider value={field.value} min={0} max={1} step={0.01} onValueChange={field.onChange} />
                    )} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0 (sensitive)</span><span>1 (conservative)</span>
                    </div>
                  </div>
                </Field>
                <Field label="Max Call Duration (minutes)" error={errors.maxCallDuration?.message}>
                  <Input type="number" {...register('maxCallDuration', { valueAsNumber: true })} min={1} max={120} className="w-32" />
                </Field>

                {/* Save/Cancel in Advanced tab for quick access */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Save Changes</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-white/10 shrink-0">
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Save Changes</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
