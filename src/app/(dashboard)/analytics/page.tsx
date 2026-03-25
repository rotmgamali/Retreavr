'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, DollarSign, Users, Phone, Target } from 'lucide-react'

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

// ── Mock data generators ─────────────────────────────────────────────────────

function generateConversionData() {
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
  return weeks.map(week => ({
    week,
    calls: Math.round(200 + Math.random() * 150),
    qualified: Math.round(80 + Math.random() * 60),
    quoted: Math.round(40 + Math.random() * 30),
    bound: Math.round(15 + Math.random() * 15),
  }))
}

function generateAgentPerformance() {
  return [
    { name: 'Sarah AI', calls: 342, conversion: 32, avgDuration: 4.2, satisfaction: 94 },
    { name: 'Mike AI', calls: 287, conversion: 28, avgDuration: 6.1, satisfaction: 89 },
    { name: 'Alex AI', calls: 198, conversion: 24, avgDuration: 5.4, satisfaction: 91 },
    { name: 'Jordan AI', calls: 256, conversion: 30, avgDuration: 3.8, satisfaction: 92 },
    { name: 'Lisa AI', calls: 167, conversion: 41, avgDuration: 4.8, satisfaction: 96 },
  ]
}

function generateABTestData() {
  return [
    {
      id: 'ab1', name: 'Greeting Style', status: 'running',
      variantA: { name: 'Formal', convRate: 24.3, calls: 520 },
      variantB: { name: 'Casual', convRate: 28.7, calls: 510 },
      confidence: 87,
    },
    {
      id: 'ab2', name: 'Follow-up Timing', status: 'completed',
      variantA: { name: '1 hour', convRate: 31.2, calls: 440 },
      variantB: { name: '4 hours', convRate: 26.8, calls: 445 },
      confidence: 95,
    },
    {
      id: 'ab3', name: 'Quote Presentation', status: 'running',
      variantA: { name: 'Detailed', convRate: 22.1, calls: 310 },
      variantB: { name: 'Summary', convRate: 23.5, calls: 305 },
      confidence: 52,
    },
  ]
}

function generateCostData() {
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  return months.map(month => ({
    month,
    apiCost: Math.round(800 + Math.random() * 400),
    telephony: Math.round(1200 + Math.random() * 600),
    infra: Math.round(400 + Math.random() * 200),
    revenue: Math.round(8000 + Math.random() * 4000),
  }))
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const conversionData = useMemo(() => generateConversionData(), [])
  const agentData = useMemo(() => generateAgentPerformance(), [])
  const abTests = useMemo(() => generateABTestData(), [])
  const costData = useMemo(() => generateCostData(), [])

  // Pie data for lead sources
  const sourceData = useMemo(() => [
    { name: 'Inbound', value: 420 },
    { name: 'Outbound', value: 310 },
    { name: 'Website', value: 280 },
    { name: 'Referral', value: 150 },
    { name: 'Campaign', value: 190 },
  ], [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Conversion analytics, agent performance, and A/B test results</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Phone} label="Total Calls (30d)" value="3,842" change="+12.4%" positive />
        <KPICard icon={Target} label="Conversion Rate" value="28.3%" change="+2.1%" positive />
        <KPICard icon={Users} label="Active Leads" value="1,247" change="+8.7%" positive />
        <KPICard icon={DollarSign} label="Revenue (30d)" value="$142K" change="-3.2%" positive={false} />
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
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i]} />
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
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-slate-400">{s.name}</span>
                      </div>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agent Performance */}
        <TabsContent value="agents" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Agent Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

          {/* Agent detail table */}
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
                    {agentData.map(agent => (
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
                              <div
                                className="h-full rounded-full bg-cyan-400"
                                style={{ width: `${agent.satisfaction}%` }}
                              />
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
        </TabsContent>

        {/* A/B Tests */}
        <TabsContent value="ab-tests" className="mt-6 space-y-4">
          {abTests.map(test => {
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
                        <div
                          key={label}
                          className={`rounded-lg border p-4 ${
                            isWinner ? 'border-green-500/30 bg-green-500/5' : 'border-white/10 bg-white/[0.02]'
                          }`}
                        >
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
          })}
        </TabsContent>

        {/* Cost Analytics */}
        <TabsContent value="costs" className="mt-6 space-y-4">
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

          {/* Cost breakdown */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'API Costs', value: '$1,087', change: '-8%', icon: '/', color: 'text-amber-400' },
              { label: 'Telephony', value: '$1,643', change: '+3%', icon: '$', color: 'text-red-400' },
              { label: 'Infrastructure', value: '$512', change: '-12%', icon: '#', color: 'text-purple-400' },
            ].map(cost => (
              <Card key={cost.label} className="glass-card">
                <CardContent className="p-5">
                  <p className="text-xs text-slate-500 mb-1">{cost.label}</p>
                  <p className="text-xl font-bold">{cost.value}</p>
                  <p className={`text-xs mt-1 ${cost.change.startsWith('-') ? 'text-green-400' : 'text-red-400'}`}>
                    {cost.change} vs last month
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
