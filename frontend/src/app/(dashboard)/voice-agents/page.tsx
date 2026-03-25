'use client'

import { useState } from 'react'
import { SkeletonToContent } from '@/components/animations'
import { VoiceAgentsSkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { Bot, Plus, Phone, TrendingUp, Clock, Loader2 } from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VoiceAgentConfigDrawer, type VoiceAgent } from '@/components/forms/voice-agent-config-drawer'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StaggeredGrid, StaggeredItem, MotionCard, StatusPulse } from '@/components/animations'
import { useAgents, useCreateAgent, useUpdateAgent } from '@/hooks/use-agents'
import type { VoiceAgentApi } from '@/hooks/use-agents'

// ── Default tools ──────────────────────────────────────────────────────────────
const DEFAULT_TOOLS: VoiceAgent['tools'] = [
  { id: 't1', name: 'Quote Generator', enabled: false, description: 'Generate real-time insurance quotes' },
  { id: 't2', name: 'Calendar Booking', enabled: false, description: 'Schedule follow-up appointments' },
  { id: 't3', name: 'CRM Lookup', enabled: false, description: 'Pull customer history from CRM' },
]

// ── Type mappers ───────────────────────────────────────────────────────────────
function apiToUiAgent(agent: VoiceAgentApi): VoiceAgent {
  const vad = (agent.vad_config ?? {}) as Record<string, unknown>
  return {
    id: agent.id,
    name: agent.name,
    status: (agent.status === 'draft' ? 'inactive' : agent.status) as VoiceAgent['status'],
    persona: agent.persona ?? '',
    voice: (agent.voice ?? 'alloy') as VoiceAgent['voice'],
    language: (vad.language as string) ?? 'en-US',
    greeting: (vad.greeting as string) ?? '',
    systemPrompt: agent.system_prompt ?? '',
    knowledgeBase: (vad.knowledge_base as string[]) ?? [],
    tools: (vad.tools as VoiceAgent['tools']) ?? DEFAULT_TOOLS,
    vadThreshold: (vad.threshold as number) ?? 0.5,
    maxCallDuration: (vad.max_call_duration as number) ?? 30,
    callsToday: 0,
    conversionRate: 0,
    avgCallDuration: '—',
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
  }
}

const EMPTY_AGENT: VoiceAgent = {
  id: '', name: 'New Agent', status: 'inactive', persona: '',
  voice: 'alloy', language: 'en-US', greeting: '', systemPrompt: '',
  knowledgeBase: [], tools: DEFAULT_TOOLS,
  vadThreshold: 0.5, maxCallDuration: 30,
  callsToday: 0, conversionRate: 0, avgCallDuration: '—',
  createdAt: '', updatedAt: '',
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<VoiceAgent['status'], 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  training: 'warning',
  inactive: 'secondary',
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function VoiceAgentsPage() {
  const loading = usePageLoading(700)
  const { data, isLoading: agentsLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()

  const agents: VoiceAgent[] = (data?.items ?? []).map(apiToUiAgent)

  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isNewAgent, setIsNewAgent] = useState(false)

  const openDrawer = (agent: VoiceAgent, isNew = false) => {
    setSelectedAgent(agent)
    setIsNewAgent(isNew)
    setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); setSelectedAgent(null) }

  const handleSave = async (data: Partial<VoiceAgent>) => {
    const merged = selectedAgent ? { ...selectedAgent, ...data } : data
    const mappedStatus: 'active' | 'inactive' | 'draft' | undefined =
      merged.status === 'training' ? 'draft' : merged.status === 'active' ? 'active' : merged.status === 'inactive' ? 'inactive' : undefined
    const apiPayload = {
      name: merged.name ?? 'New Agent',
      persona: merged.persona ?? '',
      system_prompt: merged.systemPrompt ?? '',
      voice: merged.voice,
      status: mappedStatus,
      vad_config: {
        threshold: merged.vadThreshold,
        max_call_duration: merged.maxCallDuration,
        language: merged.language,
        greeting: merged.greeting,
        tools: merged.tools,
        knowledge_base: merged.knowledgeBase,
      },
    }

    if (isNewAgent) {
      await createAgent.mutateAsync({
        name: apiPayload.name,
        persona: apiPayload.persona,
        system_prompt: apiPayload.system_prompt,
        voice: apiPayload.voice,
        status: apiPayload.status,
        vad_config: apiPayload.vad_config,
      })
    } else if (selectedAgent?.id) {
      await updateAgent.mutateAsync({ id: selectedAgent.id, updates: apiPayload })
    }
    closeDrawer()
  }

  const handleNewAgent = () => {
    openDrawer(EMPTY_AGENT, true)
  }

  const isSaving = createAgent.isPending || updateAgent.isPending

  return (
    <SkeletonToContent loading={loading || agentsLoading} skeleton={<VoiceAgentsSkeleton />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Agents</h1>
          <p className="text-muted-foreground mt-1">Manage and configure your AI voice agents</p>
        </div>
        <Button
          onClick={handleNewAgent}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
        >
          {createAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Agent
        </Button>
      </div>

      {/* Stats summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{agents.filter(a => a.status === 'active').length} active</span>
        <span className="text-white/20">·</span>
        <span>{agents.filter(a => a.status === 'training').length} training</span>
        <span className="text-white/20">·</span>
        <span>{agents.filter(a => a.status === 'inactive').length} inactive</span>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">No voice agents yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Click &quot;New Agent&quot; to create your first AI voice agent</p>
        </div>
      ) : (
        <StaggeredGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <StaggeredItem key={agent.id}>
            <MotionCard
              className="glass-card cursor-pointer h-full"
              onClick={() => openDrawer(agent)}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="relative rounded-lg bg-blue-500/20 p-2 shrink-0">
                  <Bot className="h-6 w-6 text-blue-400" />
                  <StatusPulse
                    status={agent.status === 'active' ? 'active' : agent.status === 'training' ? 'paused' : 'idle'}
                    size="sm"
                    className="absolute -bottom-0.5 -right-0.5 border-2 border-[#0f172a] rounded-full"
                  />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                  <Badge variant={STATUS_BADGE[agent.status]} className="mt-1 capitalize">{agent.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.persona && (
                  <p className="text-xs text-muted-foreground truncate">{agent.persona}</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white/5 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-blue-400 mb-0.5">
                      <Phone className="h-3 w-3" />
                    </div>
                    <p className="text-sm font-semibold">{agent.callsToday}</p>
                    <p className="text-[10px] text-muted-foreground">Today</p>
                  </div>
                  <div className="rounded-md bg-white/5 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-green-400 mb-0.5">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                    <p className="text-sm font-semibold">{agent.conversionRate}%</p>
                    <p className="text-[10px] text-muted-foreground">CVR</p>
                  </div>
                  <div className="rounded-md bg-white/5 px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 text-purple-400 mb-0.5">
                      <Clock className="h-3 w-3" />
                    </div>
                    <p className="text-sm font-semibold truncate">{agent.avgCallDuration}</p>
                    <p className="text-[10px] text-muted-foreground">Avg</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Voice: <span className="text-foreground/70 capitalize">{agent.voice}</span>
                  <span className="mx-1.5 text-white/20">{'\u00B7'}</span>
                  {agent.knowledgeBase.length} doc{agent.knowledgeBase.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </MotionCard>
            </StaggeredItem>
          ))}
        </StaggeredGrid>
      )}

      {/* Config drawer */}
      {selectedAgent && (
        <VoiceAgentConfigDrawer
          agent={selectedAgent}
          isOpen={drawerOpen}
          onClose={closeDrawer}
          onSave={handleSave}
        />
      )}
    </div>
    </SkeletonToContent>
  )
}
