'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Calculator,
  Car,
  Home,
  HeartPulse,
  Plus,
  Loader2,
  DollarSign,
  TrendingDown,
  Trash2,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  useGenerateQuote,
  useBundleQuotes,
  type QuoteRequest,
  type QuoteResult,
  type BundleResult,
} from '@/hooks/use-quotes'

type InsuranceType = 'auto' | 'home' | 'life'

const TYPE_CONFIG = {
  auto: { icon: Car, label: 'Auto Insurance', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  home: { icon: Home, label: 'Home Insurance', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  life: { icon: HeartPulse, label: 'Life Insurance', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
} as const

interface QuoteLine {
  id: string
  request: QuoteRequest
  result?: QuoteResult
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function QuotesPage() {
  const [selectedType, setSelectedType] = useState<InsuranceType>('auto')
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [bundleResult, setBundleResult] = useState<BundleResult | null>(null)

  // Form state
  const [age, setAge] = useState('35')
  const [zipCode, setZipCode] = useState('')
  const [creditScore, setCreditScore] = useState<string>('')

  // Auto fields
  const [vehicleYear, setVehicleYear] = useState(String(new Date().getFullYear() - 3))
  const [drivingRecord, setDrivingRecord] = useState('clean')
  const [autoDeductible, setAutoDeductible] = useState('500')

  // Home fields
  const [propertyValue, setPropertyValue] = useState('300000')
  const [homeAge, setHomeAge] = useState('15')
  const [constructionType, setConstructionType] = useState('frame')
  const [claimsHistory, setClaimsHistory] = useState('0')
  const [homeDeductible, setHomeDeductible] = useState('1000')

  // Life fields
  const [coverageAmount, setCoverageAmount] = useState('500000')
  const [termYears, setTermYears] = useState('20')
  const [gender, setGender] = useState('male')
  const [tobaccoStatus, setTobaccoStatus] = useState('false')
  const [healthClass, setHealthClass] = useState('standard')

  const generateMutation = useGenerateQuote()
  const bundleMutation = useBundleQuotes()

  const buildRequest = (): QuoteRequest => {
    const base: QuoteRequest = {
      insurance_type: selectedType,
      age: parseInt(age) || 35,
      zip_code: zipCode || undefined,
    }

    if (selectedType === 'auto') {
      return {
        ...base,
        vehicle_year: parseInt(vehicleYear) || undefined,
        driving_record: drivingRecord,
        deductible: parseInt(autoDeductible) || 500,
      }
    }

    if (selectedType === 'home') {
      return {
        ...base,
        property_value: parseInt(propertyValue) || 300000,
        home_age: parseInt(homeAge) || 15,
        construction_type: constructionType,
        claims_history: parseInt(claimsHistory) || 0,
        deductible: parseInt(homeDeductible) || 1000,
      }
    }

    // life
    return {
      ...base,
      coverage_amount: parseInt(coverageAmount) || 500000,
      term_years: parseInt(termYears) || 20,
      gender,
      tobacco_status: tobaccoStatus === 'true',
      health_class: healthClass,
    }
  }

  const handleGenerate = async () => {
    const request = buildRequest()
    try {
      const result = await generateMutation.mutateAsync(request)
      const newLine: QuoteLine = {
        id: crypto.randomUUID(),
        request,
        result,
      }
      setLines((prev) => [...prev, newLine])
      setBundleResult(null)
      toast.success(`${TYPE_CONFIG[selectedType].label} quote generated`)
    } catch {
      toast.error('Failed to generate quote')
    }
  }

  const handleBundle = async () => {
    const requests = lines.map((l) => l.request)
    try {
      const result = await bundleMutation.mutateAsync({ quotes: requests })
      setBundleResult(result)
      // Update individual line results with bundled versions
      setLines((prev) =>
        prev.map((line, i) => ({
          ...line,
          result: result.quotes[i] ?? line.result,
        }))
      )
      toast.success('Bundle discount calculated')
    } catch {
      toast.error('Failed to calculate bundle')
    }
  }

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
    setBundleResult(null)
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <h1 className="text-3xl font-bold tracking-tight">Insurance Quotes</h1>
        <p className="text-muted-foreground mt-1">
          Generate real-time premium quotes and bundle multiple coverage lines for discounts
        </p>
      </motion.div>

      {/* Insurance Type Selector */}
      <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-3">
        {(Object.entries(TYPE_CONFIG) as [InsuranceType, (typeof TYPE_CONFIG)[InsuranceType]][]).map(
          ([type, config]) => {
            const isSelected = selectedType === type
            return (
              <Card
                key={type}
                className={`glass-card cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? `${config.border} border ring-1 ring-${type === 'auto' ? 'blue' : type === 'home' ? 'emerald' : 'purple'}-500/20`
                    : 'border-white/5 hover:border-white/15'
                }`}
                onClick={() => setSelectedType(type)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${config.bg}`}>
                    <config.icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {type === 'auto' && 'Vehicle coverage'}
                      {type === 'home' && 'Property protection'}
                      {type === 'life' && 'Term life coverage'}
                    </p>
                  </div>
                  {isSelected && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Selected
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          }
        )}
      </motion.div>

      {/* Quote Form */}
      <motion.div variants={staggerItem}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-400" />
              Quote Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Common fields */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Age</label>
                <Input
                  type="number"
                  placeholder="35"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min={16}
                  max={99}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP Code</label>
                <Input
                  placeholder="e.g. 90210"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Credit Score</label>
                <Select value={creditScore} onValueChange={setCreditScore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent (750+)</SelectItem>
                    <SelectItem value="good">Good (700-749)</SelectItem>
                    <SelectItem value="fair">Fair (650-699)</SelectItem>
                    <SelectItem value="poor">Poor (&lt;650)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-specific */}
            {selectedType === 'auto' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vehicle Year</label>
                  <Input
                    type="number"
                    placeholder="2023"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    min={1990}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Driving Record</label>
                  <Select value={drivingRecord} onValueChange={setDrivingRecord}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">Clean</SelectItem>
                      <SelectItem value="minor_violations">Minor Violations</SelectItem>
                      <SelectItem value="major_violations">Major Violations</SelectItem>
                      <SelectItem value="dui">DUI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deductible</label>
                  <Select value={autoDeductible} onValueChange={setAutoDeductible}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="250">$250</SelectItem>
                      <SelectItem value="500">$500</SelectItem>
                      <SelectItem value="1000">$1,000</SelectItem>
                      <SelectItem value="2000">$2,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Home-specific */}
            {selectedType === 'home' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Property Value</label>
                    <Input
                      type="number"
                      placeholder="300000"
                      value={propertyValue}
                      onChange={(e) => setPropertyValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Home Age (years)</label>
                    <Input
                      type="number"
                      placeholder="15"
                      value={homeAge}
                      onChange={(e) => setHomeAge(e.target.value)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Construction Type</label>
                    <Select value={constructionType} onValueChange={setConstructionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="frame">Frame</SelectItem>
                        <SelectItem value="masonry">Masonry</SelectItem>
                        <SelectItem value="fire_resistive">Fire Resistive</SelectItem>
                        <SelectItem value="superior">Superior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Claims History (past 5 years)</label>
                    <Select value={claimsHistory} onValueChange={setClaimsHistory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 claims</SelectItem>
                        <SelectItem value="1">1 claim</SelectItem>
                        <SelectItem value="2">2 claims</SelectItem>
                        <SelectItem value="3">3+ claims</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Deductible</label>
                    <Select value={homeDeductible} onValueChange={setHomeDeductible}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">$500</SelectItem>
                        <SelectItem value="1000">$1,000</SelectItem>
                        <SelectItem value="2500">$2,500</SelectItem>
                        <SelectItem value="5000">$5,000</SelectItem>
                        <SelectItem value="10000">$10,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Life-specific */}
            {selectedType === 'life' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Coverage Amount</label>
                    <Select value={coverageAmount} onValueChange={setCoverageAmount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100000">$100,000</SelectItem>
                        <SelectItem value="250000">$250,000</SelectItem>
                        <SelectItem value="500000">$500,000</SelectItem>
                        <SelectItem value="750000">$750,000</SelectItem>
                        <SelectItem value="1000000">$1,000,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Term (years)</label>
                    <Select value={termYears} onValueChange={setTermYears}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 years</SelectItem>
                        <SelectItem value="15">15 years</SelectItem>
                        <SelectItem value="20">20 years</SelectItem>
                        <SelectItem value="25">25 years</SelectItem>
                        <SelectItem value="30">30 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tobacco Use</label>
                    <Select value={tobaccoStatus} onValueChange={setTobaccoStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Non-tobacco</SelectItem>
                        <SelectItem value="true">Tobacco user</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Health Class</label>
                    <Select value={healthClass} onValueChange={setHealthClass}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preferred_plus">Preferred Plus</SelectItem>
                        <SelectItem value="preferred">Preferred</SelectItem>
                        <SelectItem value="standard_plus">Standard Plus</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="substandard">Substandard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Generate Quote
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quote Results */}
      {lines.length > 0 && (
        <motion.div variants={staggerItem} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Quote Results</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setLines([]); setBundleResult(null) }}>
                Clear All
              </Button>
              {lines.length >= 2 && (
                <Button
                  onClick={handleBundle}
                  disabled={bundleMutation.isPending}
                  size="sm"
                >
                  {bundleMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 h-4 w-4" />
                  )}
                  Calculate Bundle
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((line) => {
              const result = line.result
              if (!result) return null
              const config = TYPE_CONFIG[line.request.insurance_type]
              return (
                <Card key={line.id} className={`glass-card ${config.border} border`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Premium Display */}
                    <div className="flex items-baseline gap-3">
                      <div>
                        <p className="text-3xl font-bold">{formatCurrency(result.monthly_premium)}</p>
                        <p className="text-xs text-muted-foreground">per month</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-semibold text-slate-300">
                          {formatCurrency(result.annual_premium)}
                        </p>
                        <p className="text-xs text-muted-foreground">per year</p>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Base Premium</span>
                        <span className="tabular-nums">{formatCurrency(result.breakdown.base_premium)}</span>
                      </div>
                      {Object.entries(result.breakdown.adjustments).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-red-400/80 capitalize">
                            + {key.replace(/_/g, ' ')}
                          </span>
                          <span className="tabular-nums text-red-400">
                            +{formatCurrency(value)}
                          </span>
                        </div>
                      ))}
                      {Object.entries(result.breakdown.discounts).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-green-400/80 capitalize">
                            - {key.replace(/_/g, ' ')}
                          </span>
                          <span className="tabular-nums text-green-400">
                            -{formatCurrency(value)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-white/5">
                        <span>Total Annual</span>
                        <span className="tabular-nums">{formatCurrency(result.breakdown.total_premium)}</span>
                      </div>
                    </div>

                    {/* Coverage Details */}
                    <div className="space-y-1 pt-2 border-t border-white/10">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Coverage Details</p>
                      {Object.entries(result.coverage_details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-slate-300 capitalize">{value.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-600">
                      Rate table: {result.rate_table_version}
                    </p>
                  </CardContent>
                </Card>
              )
            })}

            {/* Add Another Line Card */}
            <Card
              className="glass-card border-dashed border-white/10 cursor-pointer hover:border-white/20 transition-colors flex items-center justify-center min-h-[200px]"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <div className="p-3 rounded-full bg-white/5">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Add Another Line</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Bundle Results */}
      {bundleResult && (
        <motion.div
          variants={staggerItem}
          initial="hidden"
          animate="visible"
        >
          <Card className="glass-card border-indigo-500/30 border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-400" />
                Bundle Summary
                <Badge variant="secondary" className="ml-2">
                  {bundleResult.quotes.length} lines
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    Monthly Total
                  </p>
                  <p className="text-3xl font-bold">{formatCurrency(bundleResult.total_monthly)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    Annual Total
                  </p>
                  <p className="text-3xl font-bold">{formatCurrency(bundleResult.total_annual)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" />
                    Annual Savings
                  </p>
                  <p className="text-3xl font-bold text-green-400">
                    {formatCurrency(bundleResult.bundle_savings_annual)}
                  </p>
                  {bundleResult.bundle_savings_annual > 0 && (
                    <Badge variant="success" className="text-xs">
                      {((bundleResult.bundle_savings_annual / (bundleResult.total_annual + bundleResult.bundle_savings_annual)) * 100).toFixed(0)}% bundle discount
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {lines.length === 0 && (
        <motion.div variants={staggerItem}>
          <Card className="glass-card">
            <CardContent className="py-6">
              <EmptyState
                icon={Calculator}
                title="No quotes generated yet"
                description="Fill in the form above and click Generate Quote to get started. Add multiple insurance lines for bundle discounts."
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
