import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface QuoteRequest {
  insurance_type: 'auto' | 'home' | 'life'
  age?: number
  zip_code?: string
  coverage_amount?: number
  deductible?: number
  // Auto-specific
  driving_record?: string
  vehicle_year?: number
  vehicle_type?: string
  // Home-specific
  property_value?: number
  construction_type?: string
  home_age?: number
  claims_history?: number
  // Life-specific
  gender?: string
  tobacco_status?: boolean
  health_class?: string
  term_years?: number
}

export interface PremiumBreakdown {
  base_premium: number
  adjustments: Record<string, number>
  discounts: Record<string, number>
  total_premium: number
}

export interface QuoteResult {
  insurance_type: string
  monthly_premium: number
  annual_premium: number
  breakdown: PremiumBreakdown
  coverage_details: Record<string, string>
  rate_table_version: string
}

export interface BundleResult {
  quotes: QuoteResult[]
  total_monthly: number
  total_annual: number
  bundle_savings_annual: number
}

export function useGenerateQuote() {
  return useMutation({
    mutationFn: (data: QuoteRequest) =>
      api.post<QuoteResult>('/quotes/generate', data),
  })
}

export function useBundleQuotes() {
  return useMutation({
    mutationFn: (data: { quotes: QuoteRequest[] }) =>
      api.post<BundleResult>('/quotes/bundle', data),
  })
}
