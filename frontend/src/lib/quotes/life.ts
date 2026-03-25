/**
 * Life insurance quote calculator.
 */

import {
  LIFE_BASE_PREMIUMS,
  LIFE_AGE_FACTORS,
  LIFE_HEALTH_CLASS,
  LIFE_TOBACCO_FACTOR,
} from "./rate-tables";
import type { QuoteResult, PremiumBreakdown } from "./types";

export interface LifeQuoteInput {
  policyType: string; // term_10 | term_20 | term_30 | whole_life | universal
  coverageAmount: number; // in dollars
  ageRange: string;
  healthClass: string;
  tobacco: boolean;
}

export function calculateLifeQuote(input: LifeQuoteInput): QuoteResult {
  const basePer100k = LIFE_BASE_PREMIUMS[input.policyType] ?? LIFE_BASE_PREMIUMS.term_20;
  const ageFactor = LIFE_AGE_FACTORS[input.ageRange] ?? 1.0;
  const healthFactor = LIFE_HEALTH_CLASS[input.healthClass] ?? 1.0;
  const tobaccoFactor = input.tobacco
    ? LIFE_TOBACCO_FACTOR.tobacco
    : LIFE_TOBACCO_FACTOR.non_tobacco;

  const units = input.coverageAmount / 100000;
  const monthlyPremium = Math.round(
    basePer100k * units * ageFactor * healthFactor * tobaccoFactor * 100
  ) / 100;
  const annualPremium = Math.round(monthlyPremium * 12);

  const breakdown: PremiumBreakdown[] = [
    { item: "Base rate", amount: Math.round(basePer100k * units), description: `$${(input.coverageAmount / 1000).toFixed(0)}k ${input.policyType} at $${basePer100k}/mo per $100k` },
    { item: "Age adjustment", amount: Math.round(basePer100k * units * (ageFactor - 1)), description: `Age range: ${input.ageRange}` },
    { item: "Health class", amount: Math.round(basePer100k * units * ageFactor * (healthFactor - 1)), description: input.healthClass },
  ];

  if (input.tobacco) {
    breakdown.push({
      item: "Tobacco surcharge",
      amount: Math.round(basePer100k * units * ageFactor * healthFactor),
      description: "Tobacco user 2x rate",
    });
  }

  return {
    insuranceType: "life",
    annualPremium,
    monthlyPremium,
    breakdown,
    coverageDetails: {
      policyType: input.policyType,
      coverageAmount: input.coverageAmount,
      healthClass: input.healthClass,
      tobacco: input.tobacco,
    },
    rateTableVersion: "2024-Q1",
  };
}
