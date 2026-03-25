/**
 * Auto insurance quote calculator.
 */

import {
  AUTO_BASE_PREMIUMS,
  AUTO_VEHICLE_FACTORS,
  AUTO_DRIVING_RECORD,
  AUTO_AGE_FACTORS,
} from "./rate-tables";
import type { QuoteResult, PremiumBreakdown } from "./types";

export interface AutoQuoteInput {
  coverageLevel: string; // liability_only | standard | full_coverage | comprehensive
  vehicleType: string;
  drivingRecord: string;
  ageRange: string; // "26-35" etc.
  vehicleYear?: number;
  zipCode?: string;
}

export function calculateAutoQuote(input: AutoQuoteInput): QuoteResult {
  const base = AUTO_BASE_PREMIUMS[input.coverageLevel] ?? AUTO_BASE_PREMIUMS.standard;
  const vehicleFactor = AUTO_VEHICLE_FACTORS[input.vehicleType] ?? 1.0;
  const drivingFactor = AUTO_DRIVING_RECORD[input.drivingRecord] ?? 1.0;
  const ageFactor = AUTO_AGE_FACTORS[input.ageRange] ?? 1.0;

  // Vehicle age adjustment (newer = slightly more expensive)
  let vehicleAgeFactor = 1.0;
  if (input.vehicleYear) {
    const age = new Date().getFullYear() - input.vehicleYear;
    if (age <= 2) vehicleAgeFactor = 1.15;
    else if (age <= 5) vehicleAgeFactor = 1.05;
    else if (age >= 10) vehicleAgeFactor = 0.85;
  }

  const annualPremium = Math.round(
    base * vehicleFactor * drivingFactor * ageFactor * vehicleAgeFactor
  );
  const monthlyPremium = Math.round((annualPremium / 12) * 100) / 100;

  const breakdown: PremiumBreakdown[] = [
    { item: "Base premium", amount: base, description: `${input.coverageLevel} coverage` },
    { item: "Vehicle type adjustment", amount: Math.round(base * (vehicleFactor - 1)), description: input.vehicleType },
    { item: "Driving record adjustment", amount: Math.round(base * vehicleFactor * (drivingFactor - 1)), description: input.drivingRecord },
    { item: "Age adjustment", amount: Math.round(base * vehicleFactor * drivingFactor * (ageFactor - 1)), description: `Age range: ${input.ageRange}` },
  ];

  return {
    insuranceType: "auto",
    annualPremium,
    monthlyPremium,
    breakdown,
    coverageDetails: {
      level: input.coverageLevel,
      vehicleType: input.vehicleType,
      drivingRecord: input.drivingRecord,
    },
    rateTableVersion: "2024-Q1",
  };
}
