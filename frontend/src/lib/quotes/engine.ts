/**
 * Quote engine — routes to insurance-type-specific calculators.
 * Supports individual and bundle quotes.
 */

import { calculateAutoQuote, type AutoQuoteInput } from "./auto";
import { calculateHomeQuote, type HomeQuoteInput } from "./home";
import { calculateLifeQuote, type LifeQuoteInput } from "./life";
import { MULTI_LINE_DISCOUNT, MAX_BUNDLE_DISCOUNT } from "./rate-tables";
import type { QuoteResult, BundleQuoteResult } from "./types";

export type QuoteInput =
  | { type: "auto"; data: AutoQuoteInput }
  | { type: "home"; data: HomeQuoteInput }
  | { type: "life"; data: LifeQuoteInput };

/** Generate a single insurance quote. */
export function generateQuote(input: QuoteInput): QuoteResult {
  switch (input.type) {
    case "auto":
      return calculateAutoQuote(input.data);
    case "home":
      return calculateHomeQuote(input.data);
    case "life":
      return calculateLifeQuote(input.data);
    default:
      throw new Error(`Unsupported insurance type: ${(input as { type: string }).type}`);
  }
}

/** Generate bundle quotes with multi-line discount. */
export function generateBundleQuotes(inputs: QuoteInput[]): BundleQuoteResult {
  if (inputs.length === 0) {
    throw new Error("At least one quote input is required");
  }

  const quotes = inputs.map(generateQuote);
  const totalBeforeDiscount = quotes.reduce((sum, q) => sum + q.annualPremium, 0);

  const lineCount = Math.min(quotes.length, 5);
  const discountRate = Math.min(
    MULTI_LINE_DISCOUNT[lineCount] ?? 0,
    MAX_BUNDLE_DISCOUNT
  );

  const savings = Math.round(totalBeforeDiscount * discountRate);
  const totalAfterDiscount = totalBeforeDiscount - savings;
  const monthlyAfterDiscount = Math.round((totalAfterDiscount / 12) * 100) / 100;

  return {
    quotes,
    bundleDiscount: discountRate,
    totalAnnualBeforeDiscount: totalBeforeDiscount,
    totalAnnualAfterDiscount: totalAfterDiscount,
    totalMonthlyAfterDiscount: monthlyAfterDiscount,
    savings,
  };
}

// Re-export types and calculators
export type { QuoteResult, BundleQuoteResult, PremiumBreakdown } from "./types";
export type { AutoQuoteInput } from "./auto";
export type { HomeQuoteInput } from "./home";
export type { LifeQuoteInput } from "./life";
