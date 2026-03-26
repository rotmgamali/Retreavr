'use client'

import { useState } from 'react'
import { SkeletonToContent } from '@/components/animations'
import { CampaignsSkeleton } from '@/components/ui/page-skeletons'
import { usePageLoading } from '@/hooks/use-page-loading'
import { Plus, TrendingUp, Users, Phone, BarChart2, Play, Square, Pause } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CampaignWizard, type CampaignFormData } from '@/components/forms/campaign-wizard'
import { useCampaigns, useCreateCampaign, useStartCampaign, useStopCampaign } from '@/hooks/use-campaigns'
import type { CampaignApi } from '@/hooks/use-campaigns'
import { ErrorBoundary } from '@/components/error-boundary'

// ─── Types & mappers ──────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  type: 'outbound' | 'inbound' | 'follow-up' | 'renewal'
  status: 'active' | 'draft' | 'completed' | 'paused'
  startDate: string
  endDate: string
  totalLeads: number
  contacted: number
  converted: number
}

function apiToUiCampaign(c: CampaignApi): Campaign {
  const cfg = (c.config ?? {}) as Record<string, unknown>
  return {
    id: c.id,
    name: c.name,
    type: (cfg.wizard_type as Campaign['type']) ?? 'outbound',
    status: (c.status === 'cancelled' ? 'completed' : c.status) as Campaign['status'],
    startDate: (cfg.start_date as string) ?? '',
    endDate: (cfg.end_date as string) ?? '',
    totalLeads: (cfg.target_leads as number) ?? 0,
    contacted: (cfg.contacted as number) ?? 0,
    converted: (cfg.converted as number) ?? 0,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Campaign['type'], string> = {
  outbound: 'Outbound',
  inbound: 'Inbound',
  'follow-up': 'Follow-up',
  renewal: 'Renewal',
}

const TYPE_BADGE: Record<Campaign['type'], 'info' | 'default' | 'warning' | 'success'> = {
  outbound: 'info',
  inbound: 'default',
  'follow-up': 'warning',
  renewal: 'success',
}

const STATUS_BADGE: Record<Campaign['status'], 'success' | 'warning' | 'secondary' | 'info'> = {
  active: 'success',
  paused: 'warning',
  draft: 'secondary',
  completed: 'info',
}

function conversionRate(campaign: Campaign): string {
  if (campaign.contacted === 0) return '—'
  return `${((campaign.converted / campaign.contacted) * 100).toFixed(1)}%`
}

function fmt(date: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Campaign Analytics Dialog ────────────────────────────────────────────────

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-white">{value.toLocaleString()} <span className="text-slate-500">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CampaignAnalyticsDialog({
  campaign,
  onClose,
}: {
  campaign: Campaign | null
  onClose: () => void
}) {
  if (!campaign) return null

  const convRate = campaign.contacted > 0
    ? ((campaign.converted / campaign.contacted) * 100).toFixed(1)
    : '0'
  const reachRate = campaign.totalLeads > 0
    ? ((campaign.contacted / campaign.totalLeads) * 100).toFixed(1)
    : '0'


  return (
    <Dialog open={!!campaign} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-[#0f172a] border-white/10">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={TYPE_BADGE[campaign.type]}>{TYPE_LABELS[campaign.type]}</Badge>
                <Badge variant={STATUS_BADGE[campaign.status]} className="capitalize">{campaign.status}</Badge>
              </div>
            </div>
            <BarChart2 className="w-6 h-6 text-slate-500 shrink-0" />
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Leads', value: campaign.totalLeads.toLocaleString(), color: 'text-blue-400' },
              { label: 'Reach Rate', value: `${reachRate}%`, color: 'text-cyan-400' },
              { label: 'Conv. Rate', value: `${convRate}%`, color: 'text-green-400' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Funnel bars */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300">Funnel Progress</h4>
            <StatBar label="Leads Contacted" value={campaign.contacted} max={campaign.totalLeads} color="bg-cyan-500" />
            <StatBar label="Leads Converted" value={campaign.converted} max={campaign.contacted} color="bg-green-500" />
            <StatBar label="Not Contacted" value={campaign.totalLeads - campaign.contacted} max={campaign.totalLeads} color="bg-slate-500" />
          </div>

          {/* Dates */}
          {(campaign.startDate || campaign.endDate) && (
            <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-white/10 pt-3">
              <span>Start: <span className="text-slate-300">{fmt(campaign.startDate)}</span></span>
              {campaign.endDate && <span>End: <span className="text-slate-300">{fmt(campaign.endDate)}</span></span>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const loading = usePageLoading(700)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [analyticsCampaign, setAnalyticsCampaign] = useState<Campaign | null>(null)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000) }

  const { data: campaignsData } = useCampaigns()
  const createCampaign = useCreateCampaign()
  const startCampaign = useStartCampaign()
  const stopCampaign = useStopCampaign()

  const campaigns: Campaign[] = (campaignsData?.items ?? []).map(apiToUiCampaign)

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0)
  const totalContacted = campaigns.reduce((s, c) => s + c.contacted, 0)
  const totalConverted = campaigns.reduce((s, c) => s + c.converted, 0)
  const overallRate =
    totalContacted > 0 ? `${((totalConverted / totalContacted) * 100).toFixed(1)}%` : '0%'

  const handleLaunch = async (data: CampaignFormData) => {
    await createCampaign.mutateAsync({
      name: data.name,
      type: 'outbound_call',
      status: 'active',
      config: {
        wizard_type: data.type,
        start_date: data.startDate,
        end_date: data.endDate,
        target_leads: data.targetLeads,
        audience_segments: data.audienceSegments,
        exclude_existing: data.excludeExisting,
        agent_id: data.agentId,
        custom_greeting: data.customGreeting,
        max_attempts: data.maxAttempts,
        call_hours_start: data.callHoursStart,
        call_hours_end: data.callHoursEnd,
        call_days: data.callDays,
        max_calls_per_hour: data.maxCallsPerHour,
        max_calls_per_day: data.maxCallsPerDay,
        timezone: data.timezone,
        contacted: 0,
        converted: 0,
      },
    })
    setWizardOpen(false)
  }

  const handleSaveDraft = async (data: Partial<CampaignFormData>) => {
    if (!data.name) return
    await createCampaign.mutateAsync({
      name: data.name,
      type: 'outbound_call',
      status: 'draft',
      config: {
        wizard_type: data.type ?? 'outbound',
        start_date: data.startDate ?? '',
        end_date: data.endDate ?? '',
        target_leads: data.targetLeads ?? 0,
        contacted: 0,
        converted: 0,
      },
    })
    setWizardOpen(false)
  }

  return (
    <SkeletonToContent loading={loading} skeleton={<CampaignsSkeleton />}>
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Build and manage outbound voice campaigns</p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={Users}
          label="Total Leads"
          value={totalLeads.toLocaleString()}
          sub={`${campaigns.length} campaigns`}
          color="bg-blue-500/20"
        />
        <SummaryCard
          icon={Phone}
          label="Contacted"
          value={totalContacted.toLocaleString()}
          sub={`${totalLeads > 0 ? ((totalContacted / totalLeads) * 100).toFixed(0) : 0}% reach rate`}
          color="bg-cyan-500/20"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Converted"
          value={totalConverted.toLocaleString()}
          sub={`${overallRate} conversion rate`}
          color="bg-green-500/20"
        />
      </div>

      {/* Campaigns Table */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">All Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Campaign', 'Type', 'Status', 'Dates', 'Leads', 'Contacted', 'Converted', 'Conv. Rate', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaigns.map(campaign => (
                  <tr key={campaign.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => setAnalyticsCampaign(campaign)}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                        {campaign.name}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={TYPE_BADGE[campaign.type]}>{TYPE_LABELS[campaign.type]}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={STATUS_BADGE[campaign.status]} className="capitalize">
                        {campaign.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {fmt(campaign.startDate)}
                      {campaign.endDate && (
                        <span className="text-slate-600"> → {fmt(campaign.endDate)}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-300 tabular-nums">
                      {campaign.totalLeads.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-slate-300 tabular-nums">
                      {campaign.contacted.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-slate-300 tabular-nums">
                      {campaign.converted.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          campaign.contacted > 0 ? 'text-green-400 font-semibold' : 'text-slate-500'
                        }
                      >
                        {conversionRate(campaign)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          disabled={campaign.status === 'active' || startCampaign.isPending}
                          onClick={() => {
                            startCampaign.mutate(campaign.id, {
                              onSuccess: () => showToast(`Campaign "${campaign.name}" started`),
                              onError: () => showToast(`Failed to start "${campaign.name}"`),
                            })
                          }}
                          title="Start campaign"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                          disabled={campaign.status !== 'active'}
                          onClick={() => {
                            stopCampaign.mutate(campaign.id, {
                              onSuccess: () => showToast(`Campaign "${campaign.name}" paused`),
                              onError: () => showToast(`Failed to pause "${campaign.name}"`),
                            })
                          }}
                          title="Pause campaign"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          disabled={campaign.status !== 'active' && campaign.status !== 'paused'}
                          onClick={() => {
                            stopCampaign.mutate(campaign.id, {
                              onSuccess: () => showToast(`Campaign "${campaign.name}" stopped`),
                              onError: () => showToast(`Failed to stop "${campaign.name}"`),
                            })
                          }}
                          title="Stop campaign"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </Button>
                        {campaign.status === 'active' && (
                          <Badge variant="success" className="ml-1 text-[10px] animate-pulse">Running</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {campaigns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Phone className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No campaigns yet</p>
                <p className="text-slate-600 text-sm mt-1">Click New Campaign to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 shadow-lg backdrop-blur-sm">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-auto text-green-400/60 hover:text-green-400">x</button>
        </div>
      )}

      {/* Analytics Dialog */}
      <CampaignAnalyticsDialog
        campaign={analyticsCampaign}
        onClose={() => setAnalyticsCampaign(null)}
      />

      {/* Wizard Modal */}
      <CampaignWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onLaunch={handleLaunch}
        onSaveDraft={handleSaveDraft}
      />
    </div>
    </ErrorBoundary>
    </SkeletonToContent>
  )
}
