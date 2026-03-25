'use client'

import { Skeleton } from '@/components/ui/skeleton'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function SkeletonCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 ${className}`}>
      {children}
    </div>
  )
}

function PageHeader({ withButton = false }: { withButton?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withButton && <Skeleton className="h-9 w-28 rounded-md" />}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-20" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <Skeleton className="h-5 w-48 mb-1" />
          <Skeleton className="h-3 w-32 mb-5" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-5 w-36 mb-5" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </SkeletonCard>
      </div>

      {/* Live panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Heatmap */}
      <SkeletonCard>
        <Skeleton className="h-5 w-52 mb-1" />
        <Skeleton className="h-3 w-40 mb-5" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </SkeletonCard>
    </div>
  )
}

// ── Voice Agents ───────────────────────────────────────────────────────────────

export function VoiceAgentsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader withButton />

      {/* Stats row */}
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>

      {/* Agent grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            {/* Card header */}
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            {/* Persona */}
            <Skeleton className="h-3 w-full mb-4" />
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-md bg-white/5 px-2 py-2 space-y-1.5">
                  <Skeleton className="h-3 w-3 mx-auto rounded-full" />
                  <Skeleton className="h-4 w-8 mx-auto" />
                  <Skeleton className="h-2.5 w-6 mx-auto" />
                </div>
              ))}
            </div>
            {/* Footer */}
            <Skeleton className="h-3 w-2/3 mt-3" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

// ── Lead Pipeline ─────────────────────────────────────────────────────────────

export function LeadsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader withButton />

      {/* Search bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-hidden pb-4">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="min-w-[260px] w-[260px] shrink-0">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
            {/* Cards */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 space-y-2 min-h-[400px]">
              {Array.from({ length: col === 0 ? 2 : col === 1 ? 2 : col === 2 ? 2 : col === 3 ? 2 : col === 4 ? 2 : 1 }).map((_, j) => (
                <div key={j} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Call History ──────────────────────────────────────────────────────────────

export function CallHistorySkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </SkeletonCard>
        ))}
      </div>

      {/* Search & filters */}
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Table */}
      <SkeletonCard className="p-0 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
          {[32, 28, 16, 12, 12].map((w, i) => (
            <Skeleton key={i} className={`h-3`} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, k) => (
                <Skeleton key={k} className="h-3 w-3 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}

// ── Call Center ───────────────────────────────────────────────────────────────

export function CallCenterSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="py-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-12" />
          </SkeletonCard>
        ))}
      </div>

      {/* Active calls */}
      <div>
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              {/* Waveform */}
              <div className="flex items-center gap-0.5 h-10 mb-3">
                {Array.from({ length: 30 }).map((_, j) => (
                  <Skeleton
                    key={j}
                    className={`flex-1 rounded-full h-6`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, k) => (
                    <Skeleton key={k} className="h-7 w-7 rounded-md" />
                  ))}
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>

      {/* Queue */}
      <SkeletonCard>
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export function CampaignsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader withButton />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-16" />
          </SkeletonCard>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            {/* Progress bar */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-md bg-white/5 p-2 space-y-1">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-5 w-10" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={`h-9 w-24 rounded-t-md ${i === 0 ? 'opacity-100' : 'opacity-40'}`} />
        ))}
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </SkeletonCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-28 mb-5" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </SkeletonCard>
        ))}
      </div>

      {/* Table */}
      <SkeletonCard>
        <Skeleton className="h-5 w-36 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1 max-w-[60px]" />
              <Skeleton className="h-4 flex-1 max-w-[60px]" />
              <Skeleton className="h-4 flex-1 max-w-[60px]" />
              <Skeleton className="h-4 flex-1 max-w-[60px]" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Tabs */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={`h-9 w-28 rounded-md ${i === 0 ? 'opacity-100' : 'opacity-40'}`} />
        ))}
      </div>

      {/* Form sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, section) => (
          <SkeletonCard key={section}>
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Wide section */}
      <SkeletonCard>
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Save button area */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}
