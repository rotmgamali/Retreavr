/**
 * Home insurance quote calculator.
 */

import {
  HOME_BASE_PREMIUMS,
  HOME_CONSTRUCTION_FACTORS,
  HOME_PROPERTY_VALUE_FACTORS,
  HOME_CLAIMS_HISTORY,
} from "./rate-tables";
import type { QuoteResult, PremiumBreakdown } from "./types";

export interface HomeQuoteInput {
  coverageLevel: string; // basic | standard | premium | luxury
  constructionType: string;
  propertyValueRange: string;
  claimsHistory: string;
  yearBuilt?: number;
}

export function calculateHomeQuote(input: HomeQuoteInput): QuoteResult {
  const base = HOME_BASE_PREMIUMS[input.coverageLevel] ?? HOME_BASE_PREMIUMS.standard;
  const constructionFactor = HOME_CONSTRUCTION_FACTORS[input.constructionType] ?? 1.0;
  const valueFactor = HOME_PROPERTY_VALUE_FACTORS[input.propertyValueRange] ?? 1.0;
  const claimsFactor = HOME_CLAIMS_HISTORY[input.claimsHistory] ?? 1.0;

  // Older homes cost more
  let ageFactor = 1.0;
  if (input.yearBuilt) {
    const age = new Date().getFullYear() - input.yearBuilt;
    if (age > 50) ageFactor = 1.25;
    else if (age > 30) ageFactor = 1.15;
    else if (age > 15) ageFactor = 1.05;
    else if (age <= 5) ageFactor = 0.9;
  }

  const annualPremium = Math.round(
    base * constructionFactor * valueFactor * claimsFactor * ageFactor
  );
  const monthlyPremium = Math.round((annualPremium / 12) * 100) / 100;

  const breakdown: PremiumBreakdown[] = [
    { item: "Base premium", amount: base, description: `${input.coverageLevel} coverage` },
    { item: "Construction type", amount: Math.round(base * (constructionFactor - 1)), description: input.constructionType },
    { item: "Property value", amount: Math.round(base * constructionFactor * (valueFactor - 1)), description: input.propertyValueRange },
    { item: "Claims history", amount: Math.round(base * constructionFactor * valueFactor * (claimsFactor - 1)), description: input.claimsHistory },
  ];

  return {
    insuranceType: "home",
    annualPremium,
    monthlyPremium,
    breakdown,
    coverageDetails: {
      level: input.coverageLevel,
      constructionType: input.constructionType,
      propertyValueRange: input.propertyValueRange,
    },
    rateTableVersion: "2024-Q1",
  };
}
