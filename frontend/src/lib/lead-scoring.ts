/**
 * Weighted-factor lead propensity scoring (0-1).
 * Port of Python lead_scoring.py to TypeScript.
 */

export interface LeadScoreFactors {
  hasPolicyType: number;
  hasCoverageAmount: number;
  hasRenewalDate: number;
  hasCurrentCarrier: number;
  hasContactInfo: number;
  nearRenewal: number;
  highCoverage: number;
  dataCompleteness: number;
}

export interface LeadScore {
  score: number; // 0-1
  classification: "hot" | "warm" | "cold";
  factors: LeadScoreFactors;
  recommendation: string;
}

interface LeadData {
  policyType?: string | null;
  coverageAmount?: number | null;
  renewalDate?: string | Date | null;
  currentCarrier?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  zipCode?: string | null;
  tobaccoStatus?: string | null;
  drivingRecord?: string | null;
  propertyValue?: number | null;
  vehicleYear?: number | null;
}

const WEIGHTS = {
  hasPolicyType: 0.15,
  hasCoverageAmount: 0.10,
  hasRenewalDate: 0.15,
  hasCurrentCarrier: 0.10,
  hasContactInfo: 0.10,
  nearRenewal: 0.15,
  highCoverage: 0.10,
  dataCompleteness: 0.15,
} as const;

function daysUntilRenewal(renewalDate: string | Date): number {
  const renewal = new Date(renewalDate);
  const now = new Date();
  return Math.floor((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Score a lead based on available data. Returns 0-1 propensity score. */
export function scoreLead(data: LeadData): LeadScore {
  const factors: LeadScoreFactors = {
    hasPolicyType: data.policyType ? 1.0 : 0.0,
    hasCoverageAmount: data.coverageAmount && data.coverageAmount > 0 ? 1.0 : 0.0,
    hasRenewalDate: data.renewalDate ? 1.0 : 0.0,
    hasCurrentCarrier: data.currentCarrier ? 1.0 : 0.0,
    hasContactInfo:
      (data.email ? 0.5 : 0) + (data.phone ? 0.5 : 0),
    nearRenewal: 0,
    highCoverage: 0,
    dataCompleteness: 0,
  };

  // Near renewal urgency (0-60 days = highest, 60-120 moderate)
  if (data.renewalDate) {
    const days = daysUntilRenewal(data.renewalDate);
    if (days >= 0 && days <= 30) factors.nearRenewal = 1.0;
    else if (days > 30 && days <= 60) factors.nearRenewal = 0.8;
    else if (days > 60 && days <= 120) factors.nearRenewal = 0.5;
    else if (days > 120 && days <= 180) factors.nearRenewal = 0.2;
    else factors.nearRenewal = 0;
  }

  // High coverage indicator ($500k+ = 1.0, $250k+ = 0.7, $100k+ = 0.4)
  if (data.coverageAmount) {
    if (data.coverageAmount >= 500000) factors.highCoverage = 1.0;
    else if (data.coverageAmount >= 250000) factors.highCoverage = 0.7;
    else if (data.coverageAmount >= 100000) factors.highCoverage = 0.4;
    else factors.highCoverage = 0.2;
  }

  // Data completeness — how many fields are populated
  const allFields = [
    data.policyType, data.coverageAmount, data.renewalDate,
    data.currentCarrier, data.email, data.phone, data.firstName,
    data.lastName, data.age, data.zipCode, data.tobaccoStatus,
    data.drivingRecord, data.propertyValue, data.vehicleYear,
  ];
  const populated = allFields.filter((f) => f != null && f !== "").length;
  factors.dataCompleteness = populated / allFields.length;

  // Weighted score
  const score =
    factors.hasPolicyType * WEIGHTS.hasPolicyType +
    factors.hasCoverageAmount * WEIGHTS.hasCoverageAmount +
    factors.hasRenewalDate * WEIGHTS.hasRenewalDate +
    factors.hasCurrentCarrier * WEIGHTS.hasCurrentCarrier +
    factors.hasContactInfo * WEIGHTS.hasContactInfo +
    factors.nearRenewal * WEIGHTS.nearRenewal +
    factors.highCoverage * WEIGHTS.highCoverage +
    factors.dataCompleteness * WEIGHTS.dataCompleteness;

  const roundedScore = Math.round(score * 100) / 100;

  let classification: LeadScore["classification"];
  let recommendation: string;

  if (roundedScore >= 0.7) {
    classification = "hot";
    recommendation = "High-priority lead — schedule immediate follow-up call. Near-term conversion opportunity.";
  } else if (roundedScore >= 0.4) {
    classification = "warm";
    recommendation = "Moderate potential — gather missing data points and nurture with targeted content.";
  } else {
    classification = "cold";
    recommendation = "Low engagement — add to drip campaign and monitor for re-engagement signals.";
  }

  return { score: roundedScore, classification, factors, recommendation };
}
