'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Building2,
  Car,
  Home,
  Heart,
  Activity,
  Landmark,
  Star,
  Mic,
  Phone,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Rocket,
  Globe,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/providers/auth-provider'
import { api } from '@/lib/api-client'
import type { InsuranceFocus } from '@/lib/default-agent-templates'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingData {
  // Step 1
  company_name: string
  company_address: string
  company_phone: string
  company_website: string
  license_number: string
  // Step 2
  insurance_types: InsuranceFocus[]
  // Step 3
  agent_name: string
  agent_voice: string
  agent_greeting: string
  // Step 4 — Phone Setup
  inbound_number: string
  request_outbound_number: boolean
}

interface OnboardingStatus {
  org_setup: boolean
  agent_configured: boolean
  first_campaign: boolean
  phone_provisioned: boolean
  onboarding_completed: boolean
  current_step: number
  organization_name: string | null
  insurance_types: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Company Details', icon: Building2 },
  { label: 'Insurance Focus', icon: FileText },
  { label: 'Voice Agent', icon: Mic },
  { label: 'Phone Setup', icon: Phone },
  { label: 'Review & Launch', icon: Rocket },
]

const INSURANCE_OPTIONS: {
  value: InsuranceFocus
  label: string
  description: string
  icon: typeof Car
}[] = [
  {
    value: 'auto',
    label: 'Auto Insurance',
    description: 'Vehicle coverage, accidents, and roadside claims',
    icon: Car,
  },
  {
    value: 'home',
    label: 'Home Insurance',
    description: 'Property protection, storm damage, and liability',
    icon: Home,
  },
  {
    value: 'life',
    label: 'Life Insurance',
    description: 'Term, whole life, and beneficiary services',
    icon: Heart,
  },
  {
    value: 'health',
    label: 'Health Insurance',
    description: 'Medical plans, enrollment, and claims',
    icon: Activity,
  },
  {
    value: 'commercial',
    label: 'Commercial Insurance',
    description: 'Business liability, property, and workers comp',
    icon: Landmark,
  },
  {
    value: 'specialty',
    label: 'Specialty Insurance',
    description: 'Niche risks, surplus lines, and unique coverage',
    icon: Star,
  },
]

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'nova', label: 'Nova', description: 'Warm and friendly' },
  { value: 'shimmer', label: 'Shimmer', description: 'Clear and expressive' },
  { value: 'echo', label: 'Echo', description: 'Calm and composed' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'fable', label: 'Fable', description: 'Engaging and dynamic' },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<OnboardingData>({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_website: '',
    license_number: '',
    insurance_types: [],
    agent_name: '',
    agent_voice: 'alloy',
    agent_greeting: '',
    inbound_number: '',
    request_outbound_number: true,
  })

  // Load existing onboarding status
  const loadStatus = useCallback(async () => {
    try {
      const status = await api.get<OnboardingStatus>('/onboarding/status')
      if (status.onboarding_completed) {
        router.push('/')
        return
      }
      if (status.organization_name) {
        setData((d) => ({ ...d, company_name: status.organization_name ?? '' }))
      }
      if (status.insurance_types?.length) {
        setData((d) => ({
          ...d,
          insurance_types: status.insurance_types as InsuranceFocus[],
        }))
      }
      // Resume at the right step
      if (status.current_step > 1) {
        setStep(status.current_step - 1)
      }
    } catch {
      // Status endpoint may fail for new orgs, that's fine
    }
  }, [router])

  useEffect(() => {
    if (!authLoading && user) loadStatus()
  }, [authLoading, user, loadStatus])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  function updateField<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function toggleInsuranceType(type: InsuranceFocus) {
    setData((prev) => {
      const types = prev.insurance_types.includes(type)
        ? prev.insurance_types.filter((t) => t !== type)
        : [...prev.insurance_types, type]
      return { ...prev, insurance_types: types }
    })
  }

  async function goNext() {
    if (step < 4) {
      setSaving(true)
      setError(null)
      try {
        await api.post('/onboarding', data)
      } catch {
        // Save failed — continue anyway, will retry on next step or launch
      }
      setSaving(false)
      setDirection(1)
      setStep((s) => s + 1)
    }
  }

  function goBack() {
    if (step > 0) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }

  async function handleLaunch() {
    setLaunching(true)
    setError(null)
    try {
      await api.post('/onboarding', data)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup')
      setLaunching(false)
    }
  }

  // Validate current step
  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!data.company_name.trim()
      case 1:
        return data.insurance_types.length > 0
      case 2:
        return true // agent config is optional
      case 3:
        return true // phone is optional
      case 4:
        return true
      default:
        return false
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f172a] text-white">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-1/2 right-0 h-[600px] w-[600px] rounded-full bg-blue-400/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Retrevr Insurance</h1>
            <p className="text-xs text-slate-400">Platform Setup</p>
          </div>
        </div>
      </header>

      {/* Progress Stepper */}
      <div className="relative z-10 border-b border-white/5 px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isDone = i < step
              return (
                <div key={s.label} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : isDone
                            ? 'border-green-500 bg-green-500/20 text-green-400'
                            : 'border-white/10 bg-white/5 text-slate-500'
                      }`}
                      animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </motion.div>
                    <span
                      className={`text-[11px] font-medium ${
                        isActive ? 'text-blue-400' : isDone ? 'text-green-400' : 'text-slate-500'
                      } hidden sm:block`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-2 h-px flex-1 ${
                        i < step ? 'bg-green-500/40' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="relative z-10 flex flex-1 items-start justify-center overflow-hidden px-6 py-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {step === 0 && <StepCompanyDetails data={data} updateField={updateField} />}
              {step === 1 && (
                <StepInsuranceFocus
                  selected={data.insurance_types}
                  onToggle={toggleInsuranceType}
                />
              )}
              {step === 2 && <StepVoiceAgent data={data} updateField={updateField} />}
              {step === 3 && <StepPhoneConfig data={data} updateField={updateField} />}
              {step === 4 && <StepReview data={data} />}
            </motion.div>
          </AnimatePresence>

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 0 || saving || launching}
            className="gap-2 text-slate-400"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <span className="text-xs text-slate-500">
            Step {step + 1} of {STEPS.length}
          </span>

          {step < 4 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed() || saving}
              className="gap-2 bg-blue-600 hover:bg-blue-500"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleLaunch}
              disabled={launching}
              className="gap-2 bg-green-600 hover:bg-green-500"
            >
              {launching && <Loader2 className="h-4 w-4 animate-spin" />}
              Launch Platform
              <Rocket className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Company Details
// ---------------------------------------------------------------------------

function StepCompanyDetails({
  data,
  updateField,
}: {
  data: OnboardingData
  updateField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Company Details</h2>
        <p className="mt-1 text-slate-400">
          Tell us about your insurance company so we can configure your platform.
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Company Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={data.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
              placeholder="Acme Insurance Group"
              className="border-white/10 bg-white/5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Address</label>
            <Input
              value={data.company_address}
              onChange={(e) => updateField('company_address', e.target.value)}
              placeholder="123 Main St, Suite 400, Chicago, IL 60601"
              className="border-white/10 bg-white/5"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phone</label>
              <Input
                value={data.company_phone}
                onChange={(e) => updateField('company_phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={data.company_website}
                  onChange={(e) => updateField('company_website', e.target.value)}
                  placeholder="www.acmeinsurance.com"
                  className="border-white/10 bg-white/5 pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Insurance License Number
            </label>
            <Input
              value={data.license_number}
              onChange={(e) => updateField('license_number', e.target.value)}
              placeholder="IL-12345678"
              className="border-white/10 bg-white/5"
            />
            <p className="text-xs text-slate-500">
              Your state insurance license or NPN for compliance records.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Insurance Focus
// ---------------------------------------------------------------------------

function StepInsuranceFocus({
  selected,
  onToggle,
}: {
  selected: InsuranceFocus[]
  onToggle: (type: InsuranceFocus) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Insurance Focus</h2>
        <p className="mt-1 text-slate-400">
          Select the lines of insurance your company handles. We will create specialized AI
          agents for each.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INSURANCE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = selected.includes(option.value)
          return (
            <motion.button
              key={option.value}
              onClick={() => onToggle(option.value)}
              whileTap={{ scale: 0.97 }}
              className={`group relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-slate-400 group-hover:text-slate-300'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className={`font-medium ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}
                >
                  {option.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{option.description}</p>
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-3 top-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-blue-400" />
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-slate-400"
        >
          {selected.length} line{selected.length > 1 ? 's' : ''} selected — a dedicated AI agent
          will be created for each.
        </motion.p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Voice Agent Setup
// ---------------------------------------------------------------------------

function StepVoiceAgent({
  data,
  updateField,
}: {
  data: OnboardingData
  updateField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Voice Agent Setup</h2>
        <p className="mt-1 text-slate-400">
          Configure how your AI voice agent sounds and greets callers. You can customize each
          agent later.
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Agent Name</label>
            <Input
              value={data.agent_name}
              onChange={(e) => updateField('agent_name', e.target.value)}
              placeholder="e.g. Sarah from Acme Insurance"
              className="border-white/10 bg-white/5"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Voice</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VOICE_OPTIONS.map((voice) => (
                <motion.button
                  key={voice.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => updateField('agent_voice', voice.value)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                    data.agent_voice === voice.value
                      ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      data.agent_voice === voice.value ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {voice.label}
                  </p>
                  <p className="text-[11px] text-slate-500">{voice.description}</p>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Custom Greeting</label>
            <Textarea
              value={data.agent_greeting}
              onChange={(e) => updateField('agent_greeting', e.target.value)}
              placeholder="Hello! Thank you for calling Acme Insurance. How can I help you today?"
              rows={3}
              className="border-white/10 bg-white/5"
            />
            <p className="text-xs text-slate-500">
              Leave blank to use the default greeting for your insurance type.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Phone Configuration
// ---------------------------------------------------------------------------

function StepPhoneConfig({
  data,
  updateField,
}: {
  data: OnboardingData
  updateField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Phone Configuration</h2>
        <p className="mt-1 text-slate-400">
          Set up your inbound and outbound phone lines for AI voice agents.
        </p>
      </div>

      {/* Inbound Line */}
      <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-slate-200">Inbound Line</p>
              <p className="text-xs text-slate-500">
                The number customers call to reach your AI agent
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Your Business Number</label>
            <Input
              value={data.inbound_number}
              onChange={(e) => updateField('inbound_number', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="border-white/10 bg-white/5"
            />
            <p className="text-xs text-slate-500">
              Enter your existing business number. We will provide call forwarding instructions
              so incoming calls are answered by your AI agent.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Outbound Line */}
      <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Outbound Line</p>
                <p className="text-xs text-slate-500">
                  A dedicated number for your AI agent to make outgoing calls
                </p>
              </div>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                data.request_outbound_number
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 text-slate-500'
              }`}
            >
              {data.request_outbound_number ? 'Included' : 'Skipped'}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-green-500/20 bg-green-500/5 p-3"
          >
            <p className="text-sm text-green-300">
              A new outbound phone number will be provisioned for your organization after launch.
              This keeps outbound calls separate from your main business line.
            </p>
          </motion.div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => updateField('request_outbound_number', !data.request_outbound_number)}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm transition-all ${
              data.request_outbound_number
                ? 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                : 'border-green-500/50 bg-green-500/10 text-green-300'
            }`}
          >
            {data.request_outbound_number
              ? 'Skip outbound number for now'
              : 'Add outbound number'}
          </motion.button>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs text-slate-500">
          You can update phone configuration anytime from the dashboard settings.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Review & Launch
// ---------------------------------------------------------------------------

function StepReview({ data }: { data: OnboardingData }) {
  const items = [
    {
      label: 'Company',
      value: data.company_name || 'Not set',
      done: !!data.company_name,
    },
    {
      label: 'Insurance Lines',
      value:
        data.insurance_types.length > 0
          ? data.insurance_types
              .map((t) => INSURANCE_OPTIONS.find((o) => o.value === t)?.label ?? t)
              .join(', ')
          : 'None selected',
      done: data.insurance_types.length > 0,
    },
    {
      label: 'Voice Agent',
      value: data.agent_name || 'Default template',
      done: true,
    },
    {
      label: 'Voice',
      value:
        VOICE_OPTIONS.find((v) => v.value === data.agent_voice)?.label ?? data.agent_voice,
      done: true,
    },
    {
      label: 'Inbound Line',
      value: data.inbound_number || 'Not configured (can add later)',
      done: !!data.inbound_number,
    },
    {
      label: 'Outbound Line',
      value: data.request_outbound_number
        ? 'New number will be provisioned'
        : 'Skipped (can add later)',
      done: data.request_outbound_number,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review & Launch</h2>
        <p className="mt-1 text-slate-400">
          Everything looks good? Hit Launch to activate your insurance AI platform.
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="divide-y divide-white/5 p-0">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    item.done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-slate-300">{item.label}</span>
              </div>
              <span className="text-sm text-slate-400">{item.value}</span>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center"
      >
        <p className="text-sm text-green-300">
          Your AI agents will be ready to handle calls immediately after launch. You can
          fine-tune settings anytime from the dashboard.
        </p>
      </motion.div>
    </div>
  )
}
