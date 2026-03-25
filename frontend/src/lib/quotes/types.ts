/**
 * Shared types for the quote engine.
 */

export interface PremiumBreakdown {
  item: string;
  amount: number;
  description: string;
}

export interface QuoteResult {
  insuranceType: "auto" | "home" | "life";
  annualPremium: number;
  monthlyPremium: number;
  breakdown: PremiumBreakdown[];
  coverageDetails: Record<string, unknown>;
  rateTableVersion: string;
}

export interface BundleQuoteResult {
  quotes: QuoteResult[];
  bundleDiscount: number; // percentage as decimal
  totalAnnualBeforeDiscount: number;
  totalAnnualAfterDiscount: number;
  totalMonthlyAfterDiscount: number;
  savings: number;
}
