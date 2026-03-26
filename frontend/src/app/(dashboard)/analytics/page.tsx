'use client'

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, DollarSign, Users, Phone, Target, BarChart2 } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  useAgentPerformance,
  useConversionWeekly,
  useLeadSources,
  useABTests,
  useCostAnalytics,
  useDashboardKPIs,
} from '@/hooks/use-analytics'

// ── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="text-white font-medium">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const PIE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b']

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, change, positive }: {
  icon: React.ElementType; label: string; value: string; change: string; positive: boolean
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
          <div className={`flex items-center gap-1 text-xs ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change}
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function fmtChange(n: number | undefined): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: kpis } = useDashboardKPIs()
  const { data: agentData, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useAgentPerformance()
  const { data: conversionData, isLoading: convLoading, isError: convError, refetch: refetchConv } = useConversionWeekly()
  const { data: sourceData, isLoading: sourcesLoading } = useLeadSources()
  const { data: abTests, isLoading: abLoading } = useABTests()
  const { data: costData, isLoading: costLoading } = useCostAnalytics()

  // Map AgentPerformance API shape to chart-friendly shape
  const agentChartData = agentData?.map(a => ({
    name: a.agent_name,
    calls: a.total_calls,
    conversion: Math.round(a.conversion_rate),
    avgDuration: Number((a.avg_duration / 60).toFixed(1)),
    satisfaction: Math.round((a.sentiment_avg ?? 0) * 100),
  })) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Conversion analytics, agent performance, and A/B test results</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Phone}
          label="Total Calls (30d)"
          value={kpis?.total_calls != null ? kpis.total_calls.toLocaleString() : '—'}
          change={fmtChange(kpis?.calls_change)}
          positive={(kpis?.calls_change ?? 0) >= 0}
        />
        <KPICard
          icon={Target}
          label="Conversion Rate"
          value={kpis?.conversion_rate != null ? `${kpis.conversion_rate.toFixed(1)}%` : '—'}
          change={fmtChange(kpis?.conversion_change)}
          positive={(kpis?.conversion_change ?? 0) >= 0}
        />
        <KPICard
          icon={Users}
          label="Active Leads"
          value={kpis?.active_leads != null ? kpis.active_leads.toLocaleString() : '—'}
          change={fmtChange(kpis?.leads_change)}
          positive={(kpis?.leads_change ?? 0) >= 0}
        />
        <KPICard
          icon={DollarSign}
          label="Revenue (30d)"
          value={kpis?.revenue != null ? `$${Math.round(kpis.revenue / 1000)}K` : '—'}
          change={fmtChange(kpis?.revenue_change)}
          positive={(kpis?.revenue_change ?? 0) >= 0}
        />
      </div>

      <Tabs defaultValue="conversion">
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          {['conversion', 'agents', 'ab-tests', 'costs'].map(tab => (
            <TabsTrigger key={tab} value={tab} className="px-4 py-2 capitalize">
              {tab === 'ab-tests' ? 'A/B Tests' : tab === 'costs' ? 'Cost Analytics' : tab === 'agents' ? 'Agent Performance' : 'Conversion'}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Conversion Analytics */}
        <TabsContent value="conversion" className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {convLoading ? (
                  <LoadingState variant="skeleton-cards" count={1} className="h-72" />
                ) : convError ? (
                  <ErrorState title="Failed to load conversion data" onRetry={() => refetchConv()} />
                ) : !conversionData?.length ? (
                  <EmptyState icon={BarChart2} title="No conversion data yet" description="Data will appear once calls are recorded." />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={conversionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="calls" name="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="qualified" name="Qualified" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="quoted" name="Quoted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="bound" name="Bound" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <LoadingState variant="skeleton-list" count={5} />
                ) : !sourceData?.length ? (
                  <EmptyState icon={BarChart2} title="No source data" description="Lead source data will appear here." />
                ) : (
                  <>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                            {sourceData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {sourceData.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-slate-400">{s.name}</span>
                          </div>
                          <span className="font-medium">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agent Performance */}
        <TabsContent value="agents" className="mt-6 space-y-4">
          {agentsLoading ? (
            <LoadingState variant="skeleton-cards" count={2} />
          ) : agentsError ? (
            <ErrorState title="Failed to load agent data" onRetry={() => refetchAgents()} />
          ) : !agentChartData.length ? (
            <EmptyState icon={Users} title="No agent data" description="Agent performance data will appear once agents are active." />
          ) : (
            <>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Agent Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="calls" name="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="conversion" name="Conv %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="satisfaction" name="CSAT" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Performance Details</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {['Agent', 'Total Calls', 'Conv. Rate', 'Avg Duration', 'CSAT Score'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {agentChartData.map(agent => (
                          <tr key={agent.name} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-3 font-medium">{agent.name}</td>
                            <td className="px-5 py-3 text-slate-300 tabular-nums">{agent.calls}</td>
                            <td className="px-5 py-3">
                              <span className={agent.conversion >= 30 ? 'text-green-400' : 'text-amber-400'}>
                                {agent.conversion}%
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-300">{agent.avgDuration}m</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${agent.satisfaction}%` }} />
                                </div>
                                <span className="text-slate-300 text-xs">{agent.satisfaction}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* A/B Tests */}
        <TabsContent value="ab-tests" className="mt-6 space-y-4">
          {abLoading ? (
            <LoadingState variant="skeleton-cards" count={3} />
          ) : !abTests?.length ? (
            <EmptyState icon={BarChart2} title="No A/B tests" description="Create A/B tests to compare agent configurations." />
          ) : (
            abTests.map(test => {
              const winner = test.variantA.convRate > test.variantB.convRate ? 'A' : 'B'
              const lift = Math.abs(test.variantA.convRate - test.variantB.convRate).toFixed(1)
              return (
                <Card key={test.id} className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{test.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={test.status === 'running' ? 'success' : 'secondary'} className="capitalize text-[10px]">
                          {test.status}
                        </Badge>
                        <span className="text-xs text-slate-500">{test.confidence}% confidence</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[test.variantA, test.variantB].map((v, i) => {
                        const label = i === 0 ? 'A' : 'B'
                        const isWinner = label === winner && test.confidence >= 90
                        return (
                          <div key={label} className={`rounded-lg border p-4 ${isWinner ? 'border-green-500/30 bg-green-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">Variant {label}</span>
                                {isWinner && <Badge variant="success" className="text-[10px]">Winner</Badge>}
                              </div>
                            </div>
                            <p className="text-sm font-medium mb-1">{v.name}</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold">{v.convRate}%</span>
                              <span className="text-xs text-slate-500">conv. rate</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{v.calls} calls</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      {lift}pp lift &middot; {test.confidence >= 95 ? 'Statistically significant' : test.confidence >= 80 ? 'Trending significant' : 'Not yet significant'}
                    </p>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Cost Analytics */}
        <TabsContent value="costs" className="mt-6 space-y-4">
          {costLoading ? (
            <LoadingState variant="skeleton-cards" count={1} className="h-72" />
          ) : !costData?.length ? (
            <EmptyState icon={DollarSign} title="No cost data" description="Cost analytics will appear once billing data is available." />
          ) : (
            <>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Costs vs Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={costData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="apiCost" name="API Cost" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="telephony" name="Telephony" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="infra" name="Infrastructure" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3">
                {(() => {
                  const latest = costData[costData.length - 1]
                  const prev = costData[costData.length - 2]
                  const pct = (curr: number, p: number) =>
                    p ? `${((curr - p) / p * 100).toFixed(0)}%` : '—'
                  return [
                    { label: 'API Costs', value: `$${latest.apiCost.toLocaleString()}`, change: prev ? pct(latest.apiCost, prev.apiCost) : '—', isDecrease: latest.apiCost <= (prev?.apiCost ?? Infinity) },
                    { label: 'Telephony', value: `$${latest.telephony.toLocaleString()}`, change: prev ? pct(latest.telephony, prev.telephony) : '—', isDecrease: latest.telephony <= (prev?.telephony ?? Infinity) },
                    { label: 'Infrastructure', value: `$${latest.infra.toLocaleString()}`, change: prev ? pct(latest.infra, prev.infra) : '—', isDecrease: latest.infra <= (prev?.infra ?? Infinity) },
                  ].map(cost => (
                    <Card key={cost.label} className="glass-card">
                      <CardContent className="p-5">
                        <p className="text-xs text-slate-500 mb-1">{cost.label}</p>
                        <p className="text-xl font-bold">{cost.value}</p>
                        <p className={`text-xs mt-1 ${cost.isDecrease ? 'text-green-400' : 'text-red-400'}`}>
                          {cost.change} vs last month
                        </p>
                      </CardContent>
                    </Card>
                  ))
                })()}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
