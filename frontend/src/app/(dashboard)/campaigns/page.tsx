'use client'

import { useState } from 'react'
import { Plus, TrendingUp, Users, Phone, BarChart2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CampaignWizard, type CampaignFormData } from '@/components/forms/campaign-wizard'

// ─── Mock Data ────────────────────────────────────────────────────────────────

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

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Q2 Auto Renewal Blitz',
    type: 'renewal',
    status: 'active',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    totalLeads: 1240,
    contacted: 847,
    converted: 163,
  },
  {
    id: '2',
    name: 'Home Insurance Cold Outreach',
    type: 'outbound',
    status: 'paused',
    startDate: '2026-03-10',
    endDate: '2026-03-31',
    totalLeads: 600,
    contacted: 388,
    converted: 42,
  },
  {
    id: '3',
    name: 'Claims Follow-up May',
    type: 'follow-up',
    status: 'draft',
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    totalLeads: 320,
    contacted: 0,
    converted: 0,
  },
]

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

  // Simulated daily data for a mini sparkline-style breakdown
  const dailyBreakdown = [
    { day: 'Mon', calls: Math.round(campaign.contacted * 0.18), converted: Math.round(campaign.converted * 0.15) },
    { day: 'Tue', calls: Math.round(campaign.contacted * 0.22), converted: Math.round(campaign.converted * 0.20) },
    { day: 'Wed', calls: Math.round(campaign.contacted * 0.20), converted: Math.round(campaign.converted * 0.25) },
    { day: 'Thu', calls: Math.round(campaign.contacted * 0.16), converted: Math.round(campaign.converted * 0.18) },
    { day: 'Fri', calls: Math.round(campaign.contacted * 0.14), converted: Math.round(campaign.converted * 0.12) },
    { day: 'Sat', calls: Math.round(campaign.contacted * 0.06), converted: Math.round(campaign.converted * 0.06) },
    { day: 'Sun', calls: Math.round(campaign.contacted * 0.04), converted: Math.round(campaign.converted * 0.04) },
  ]
  const maxCalls = Math.max(...dailyBreakdown.map(d => d.calls), 1)

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

          {/* Daily breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Daily Activity (this week)</h4>
            <div className="flex items-end gap-2 h-28">
              {dailyBreakdown.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '88px', justifyContent: 'flex-end' }}>
                    <div
                      className="w-full rounded-sm bg-blue-500/60 hover:bg-blue-500 transition-colors"
                      style={{ height: `${Math.max(4, (d.calls / maxCalls) * 72)}px` }}
                      title={`${d.calls} calls`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.day}</span>
                </div>
              ))}
            </div>
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
  const [wizardOpen, setWizardOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS)
  const [analyticsCampaign, setAnalyticsCampaign] = useState<Campaign | null>(null)

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0)
  const totalContacted = campaigns.reduce((s, c) => s + c.contacted, 0)
  const totalConverted = campaigns.reduce((s, c) => s + c.converted, 0)
  const overallRate =
    totalContacted > 0 ? `${((totalConverted / totalContacted) * 100).toFixed(1)}%` : '0%'

  const handleLaunch = (data: CampaignFormData) => {
    const newCampaign: Campaign = {
      id: String(Date.now()),
      name: data.name,
      type: data.type,
      status: 'active',
      startDate: data.startDate,
      endDate: data.endDate,
      totalLeads: data.targetLeads,
      contacted: 0,
      converted: 0,
    }
    setCampaigns(prev => [newCampaign, ...prev])
    setWizardOpen(false)
  }

  const handleSaveDraft = (data: Partial<CampaignFormData>) => {
    if (!data.name) return
    const draft: Campaign = {
      id: String(Date.now()),
      name: data.name,
      type: data.type ?? 'outbound',
      status: 'draft',
      startDate: data.startDate ?? '',
      endDate: data.endDate ?? '',
      totalLeads: data.targetLeads ?? 0,
      contacted: 0,
      converted: 0,
    }
    setCampaigns(prev => [draft, ...prev])
    setWizardOpen(false)
  }

  return (
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
                  {['Campaign', 'Type', 'Status', 'Dates', 'Leads', 'Contacted', 'Converted', 'Conv. Rate'].map(h => (
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
  )
}
