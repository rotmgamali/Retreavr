/**
 * Insurance rate tables — base premiums, adjustments, discounts.
 * Port of Python rate_tables.py.
 */

// --- AUTO INSURANCE ---
export const AUTO_BASE_PREMIUMS: Record<string, number> = {
  liability_only: 600,
  standard: 1200,
  full_coverage: 1800,
  comprehensive: 2400,
};

export const AUTO_VEHICLE_FACTORS: Record<string, number> = {
  sedan: 1.0,
  suv: 1.15,
  truck: 1.1,
  sports: 1.4,
  luxury: 1.5,
  minivan: 0.95,
  electric: 1.05,
  hybrid: 0.98,
};

export const AUTO_DRIVING_RECORD: Record<string, number> = {
  clean: 0.85,
  minor_violation: 1.0,
  major_violation: 1.3,
  accident: 1.5,
  dui: 2.0,
  multiple: 1.8,
};

export const AUTO_AGE_FACTORS: Record<string, number> = {
  "16-25": 1.6,
  "26-35": 1.1,
  "36-45": 1.0,
  "46-55": 0.95,
  "56-65": 1.0,
  "66+": 1.15,
};

// --- HOME INSURANCE ---
export const HOME_BASE_PREMIUMS: Record<string, number> = {
  basic: 800,
  standard: 1400,
  premium: 2200,
  luxury: 3500,
};

export const HOME_CONSTRUCTION_FACTORS: Record<string, number> = {
  frame: 1.0,
  masonry: 0.9,
  brick: 0.85,
  steel: 0.8,
  log: 1.2,
  manufactured: 1.4,
};

export const HOME_PROPERTY_VALUE_FACTORS: Record<string, number> = {
  under_200k: 0.7,
  "200k_400k": 1.0,
  "400k_700k": 1.3,
  "700k_1m": 1.6,
  over_1m: 2.0,
};

export const HOME_CLAIMS_HISTORY: Record<string, number> = {
  none: 0.85,
  one_claim: 1.0,
  two_claims: 1.3,
  three_plus: 1.6,
};

// --- LIFE INSURANCE ---
export const LIFE_BASE_PREMIUMS: Record<string, number> = {
  term_10: 25,   // per $100k per month
  term_20: 35,
  term_30: 50,
  whole_life: 120,
  universal: 90,
};

export const LIFE_AGE_FACTORS: Record<string, number> = {
  "18-25": 0.6,
  "26-35": 0.8,
  "36-45": 1.0,
  "46-55": 1.5,
  "56-65": 2.2,
  "66-75": 3.5,
  "76+": 5.0,
};

export const LIFE_HEALTH_CLASS: Record<string, number> = {
  preferred_plus: 0.7,
  preferred: 0.85,
  standard_plus: 0.95,
  standard: 1.0,
  substandard: 1.5,
};

export const LIFE_TOBACCO_FACTOR = {
  non_tobacco: 1.0,
  tobacco: 2.0,
};

// --- BUNDLE DISCOUNTS ---
export const MULTI_LINE_DISCOUNT: Record<number, number> = {
  2: 0.10,  // 10% for 2 policies
  3: 0.18,  // 18% for 3
  4: 0.22,  // 22% for 4
  5: 0.25,  // 25% cap
};

export const MAX_BUNDLE_DISCOUNT = 0.25;
