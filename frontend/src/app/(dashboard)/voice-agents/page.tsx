'use client'

import { useState } from 'react'
import { Bot, Plus, Phone, TrendingUp, Clock } from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VoiceAgentConfigDrawer, type VoiceAgent } from '@/components/forms/voice-agent-config-drawer'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StaggeredGrid, StaggeredItem, MotionCard, StatusPulse } from '@/components/animations'

// ── Seed data ──────────────────────────────────────────────────────────────────
const SEED_AGENTS: VoiceAgent[] = [
  {
    id: '1', name: 'Sarah AI', status: 'active', persona: 'Friendly insurance advisor',
    voice: 'nova', language: 'en-US',
    greeting: "Hi, I'm Sarah! How can I help you with your insurance today?",
    systemPrompt: 'You are Sarah, a friendly and knowledgeable insurance advisor. Always be empathetic and clear.',
    knowledgeBase: ['insurance_products_2024.pdf', 'claims_faq.docx'],
    tools: [
      { id: 't1', name: 'Quote Generator', enabled: true, description: 'Generate real-time insurance quotes' },
      { id: 't2', name: 'Calendar Booking', enabled: true, description: 'Schedule follow-up appointments' },
      { id: 't3', name: 'CRM Lookup', enabled: false, description: 'Pull customer history from CRM' },
    ],
    vadThreshold: 0.5, maxCallDuration: 30,
    callsToday: 47, conversionRate: 32, avgCallDuration: '4m 12s',
    createdAt: '2024-01-10', updatedAt: '2024-03-20',
  },
  {
    id: '2', name: 'Mike AI', status: 'active', persona: 'Claims specialist',
    voice: 'echo', language: 'en-US',
    greeting: "Hello, I'm Mike. I specialize in claims support. How can I assist you?",
    systemPrompt: 'You are Mike, an expert in processing insurance claims. Be thorough and reassuring.',
    knowledgeBase: ['claims_process.pdf'],
    tools: [
      { id: 't1', name: 'Quote Generator', enabled: false, description: 'Generate real-time insurance quotes' },
      { id: 't2', name: 'Calendar Booking', enabled: true, description: 'Schedule follow-up appointments' },
      { id: 't3', name: 'CRM Lookup', enabled: true, description: 'Pull customer history from CRM' },
    ],
    vadThreshold: 0.4, maxCallDuration: 45,
    callsToday: 31, conversionRate: 28, avgCallDuration: '6m 45s',
    createdAt: '2024-01-15', updatedAt: '2024-03-18',
  },
  {
    id: '3', name: 'Alex AI', status: 'training', persona: 'Life insurance specialist',
    voice: 'alloy', language: 'en-US',
    greeting: "Hi there! I'm Alex. I can help you find the right life insurance plan.",
    systemPrompt: 'You are Alex, specializing in life insurance products. Be consultative and patient.',
    knowledgeBase: [],
    tools: [
      { id: 't1', name: 'Quote Generator', enabled: true, description: 'Generate real-time insurance quotes' },
      { id: 't2', name: 'Calendar Booking', enabled: false, description: 'Schedule follow-up appointments' },
      { id: 't3', name: 'CRM Lookup', enabled: false, description: 'Pull customer history from CRM' },
    ],
    vadThreshold: 0.6, maxCallDuration: 20,
    callsToday: 0, conversionRate: 0, avgCallDuration: '—',
    createdAt: '2024-03-01', updatedAt: '2024-03-22',
  },
  {
    id: '4', name: 'Lisa AI', status: 'inactive', persona: 'Auto insurance expert',
    voice: 'shimmer', language: 'es-ES',
    greeting: "Hola! Soy Lisa, su experta en seguros de auto. ¿En qué le puedo ayudar?",
    systemPrompt: 'You are Lisa, an auto insurance specialist fluent in Spanish. Be professional and thorough.',
    knowledgeBase: ['auto_products_es.pdf', 'dmv_requirements.txt'],
    tools: [
      { id: 't1', name: 'Quote Generator', enabled: true, description: 'Generate real-time insurance quotes' },
      { id: 't2', name: 'Calendar Booking', enabled: true, description: 'Schedule follow-up appointments' },
      { id: 't3', name: 'CRM Lookup', enabled: true, description: 'Pull customer history from CRM' },
    ],
    vadThreshold: 0.55, maxCallDuration: 25,
    callsToday: 12, conversionRate: 41, avgCallDuration: '3m 58s',
    createdAt: '2024-02-05', updatedAt: '2024-03-15',
  },
]

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<VoiceAgent['status'], 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  training: 'warning',
  inactive: 'secondary',
}



// ── Page ───────────────────────────────────────────────────────────────────────
export default function VoiceAgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>(SEED_AGENTS)
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = (agent: VoiceAgent) => { setSelectedAgent(agent); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setSelectedAgent(null) }

  const handleSave = (data: Partial<VoiceAgent>) => {
    if (!selectedAgent) return
    setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, ...data } : a))
  }

  const handleNewAgent = () => {
    const newAgent: VoiceAgent = {
      id: String(Date.now()), name: 'New Agent', status: 'inactive', persona: '',
      voice: 'alloy', language: 'en-US', greeting: '', systemPrompt: '',
      knowledgeBase: [], tools: [
        { id: 't1', name: 'Quote Generator', enabled: false, description: 'Generate real-time insurance quotes' },
        { id: 't2', name: 'Calendar Booking', enabled: false, description: 'Schedule follow-up appointments' },
        { id: 't3', name: 'CRM Lookup', enabled: false, description: 'Pull customer history from CRM' },
      ],
      vadThreshold: 0.5, maxCallDuration: 30,
      callsToday: 0, conversionRate: 0, avgCallDuration: '—',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setAgents(prev => [...prev, newAgent])
    openDrawer(newAgent)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Agents</h1>
          <p className="text-muted-foreground mt-1">Manage and configure your AI voice agents</p>
        </div>
        <Button onClick={handleNewAgent} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
          <Plus className="h-4 w-4" />
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
  )
}
