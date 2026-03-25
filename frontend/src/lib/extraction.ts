/**
 * Pattern-based data extraction from call transcripts.
 * Extracts insurance-relevant fields using regex + keyword matching.
 * No ML — pure TypeScript.
 */

export interface ExtractedInsuranceData {
  policyType: string | null;
  coverageAmount: number | null;
  deductible: number | null;
  currentCarrier: string | null;
  renewalDate: string | null;
  age: number | null;
  zipCode: string | null;
  tobaccoStatus: "tobacco" | "non_tobacco" | null;
  drivingRecord: string | null;
  gender: string | null;
  propertyValue: number | null;
  vehicleYear: number | null;
  vehicleType: string | null;
  email: string | null;
  phone: string | null;
  confidence: Record<string, number>;
}

const POLICY_TYPES: Record<string, string> = {
  auto: "auto",
  car: "auto",
  vehicle: "auto",
  automobile: "auto",
  home: "home",
  homeowner: "home",
  house: "home",
  property: "home",
  renter: "home",
  life: "life",
  "term life": "life",
  "whole life": "life",
  health: "health",
  medical: "health",
  commercial: "commercial",
  business: "commercial",
  umbrella: "umbrella",
};

const KNOWN_CARRIERS = [
  "State Farm", "Geico", "Progressive", "Allstate", "USAA",
  "Liberty Mutual", "Farmers", "Nationwide", "Travelers", "American Family",
  "Erie", "MetLife", "Prudential", "New York Life", "Northwestern Mutual",
  "Aetna", "Cigna", "UnitedHealthcare", "Humana", "Blue Cross",
];

function extractFirst(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1]?.trim() ?? match[0]?.trim() : null;
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const numStr = (match[1] || match[0]).replace(/[,$]/g, "");
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

export function extractInsuranceData(transcript: string): ExtractedInsuranceData {
  const lower = transcript.toLowerCase();
  const confidence: Record<string, number> = {};

  // Policy type
  let policyType: string | null = null;
  for (const [keyword, type] of Object.entries(POLICY_TYPES)) {
    if (lower.includes(keyword + " insurance") || lower.includes(keyword + " policy")) {
      policyType = type;
      confidence.policyType = 0.9;
      break;
    }
    if (lower.includes(keyword)) {
      policyType = type;
      confidence.policyType = 0.6;
    }
  }

  // Coverage amount
  const coverageAmount = extractNumber(
    transcript,
    /(?:coverage|limit|amount|worth)\s*(?:of|is|at)?\s*\$?([\d,]+(?:\.\d{2})?)\s*(?:k|thousand|million)?/i
  );
  if (coverageAmount) {
    confidence.coverageAmount = 0.8;
  }

  // Deductible
  const deductible = extractNumber(
    transcript,
    /deductible\s*(?:of|is|at)?\s*\$?([\d,]+)/i
  );
  if (deductible) confidence.deductible = 0.85;

  // Current carrier
  let currentCarrier: string | null = null;
  for (const carrier of KNOWN_CARRIERS) {
    if (transcript.toLowerCase().includes(carrier.toLowerCase())) {
      currentCarrier = carrier;
      confidence.currentCarrier = 0.9;
      break;
    }
  }
  if (!currentCarrier) {
    const carrierMatch = extractFirst(
      transcript,
      /(?:current(?:ly)?|with|through|have)\s+(?:insurance\s+)?(?:with|through|from)\s+([A-Z][\w\s]{2,25})/i
    );
    if (carrierMatch) {
      currentCarrier = carrierMatch;
      confidence.currentCarrier = 0.5;
    }
  }

  // Renewal date
  let renewalDate: string | null = null;
  const dateMatch = extractFirst(
    transcript,
    /(?:renew|renewal|expires?|expir(?:ation|ing))\s*(?:date|on|is|in)?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );
  if (dateMatch) {
    renewalDate = dateMatch;
    confidence.renewalDate = 0.7;
  }

  // Age
  const age = extractNumber(
    transcript,
    /(?:I'm|I am|age|aged|years old)\s*(\d{2})/i
  );
  if (age && age >= 16 && age <= 100) confidence.age = 0.8;

  // Zip code
  const zipCode = extractFirst(transcript, /\b(\d{5}(?:-\d{4})?)\b/);
  if (zipCode) confidence.zipCode = 0.7;

  // Tobacco
  let tobaccoStatus: "tobacco" | "non_tobacco" | null = null;
  if (/\b(non[- ]?smok|don't smoke|no tobacco|tobacco[- ]?free)\b/i.test(transcript)) {
    tobaccoStatus = "non_tobacco";
    confidence.tobaccoStatus = 0.85;
  } else if (/\b(smok|tobacco|cigar|vape)\b/i.test(transcript)) {
    tobaccoStatus = "tobacco";
    confidence.tobaccoStatus = 0.75;
  }

  // Driving record
  let drivingRecord: string | null = null;
  if (/\b(clean record|no accidents|no violations|good record)\b/i.test(transcript)) {
    drivingRecord = "clean";
    confidence.drivingRecord = 0.8;
  } else if (/\b(dui|dwi)\b/i.test(transcript)) {
    drivingRecord = "dui";
    confidence.drivingRecord = 0.9;
  } else if (/\b(accident|crash|collision)\b/i.test(transcript)) {
    drivingRecord = "accident";
    confidence.drivingRecord = 0.7;
  } else if (/\b(ticket|violation|speeding)\b/i.test(transcript)) {
    drivingRecord = "minor_violation";
    confidence.drivingRecord = 0.7;
  }

  // Vehicle year
  const vehicleYear = extractNumber(transcript, /\b(20[0-2]\d|19\d{2})\b.*(?:vehicle|car|truck|suv)/i) ??
    extractNumber(transcript, /(?:vehicle|car|truck|suv).*\b(20[0-2]\d|19\d{2})\b/i);
  if (vehicleYear) confidence.vehicleYear = 0.7;

  // Vehicle type
  let vehicleType: string | null = null;
  const vehicleTypes = ["sedan", "suv", "truck", "sports", "luxury", "minivan", "electric", "hybrid"];
  for (const vt of vehicleTypes) {
    if (lower.includes(vt)) {
      vehicleType = vt;
      confidence.vehicleType = 0.7;
      break;
    }
  }

  // Property value
  const propertyValue = extractNumber(
    transcript,
    /(?:home|house|property)\s*(?:is\s+)?(?:worth|valued?\s+at|appraised)\s*\$?([\d,]+)/i
  );
  if (propertyValue) confidence.propertyValue = 0.75;

  // Email
  const email = extractFirst(transcript, /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (email) confidence.email = 0.95;

  // Phone
  const phone = extractFirst(transcript, /\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/);
  if (phone) confidence.phone = 0.9;

  // Gender
  let gender: string | null = null;
  if (/\b(husband|he|him|mr\.|sir|father|son|male)\b/i.test(lower)) {
    gender = "male";
    confidence.gender = 0.5;
  } else if (/\b(wife|she|her|ms\.|mrs\.|ma'am|mother|daughter|female)\b/i.test(lower)) {
    gender = "female";
    confidence.gender = 0.5;
  }

  return {
    policyType,
    coverageAmount: coverageAmount != null ? (coverageAmount < 1000 ? coverageAmount * 1000 : coverageAmount) : null,
    deductible,
    currentCarrier,
    renewalDate,
    age: age && age >= 16 && age <= 100 ? age : null,
    zipCode,
    tobaccoStatus,
    drivingRecord,
    gender,
    propertyValue: propertyValue != null ? (propertyValue < 1000 ? propertyValue * 1000 : propertyValue) : null,
    vehicleYear,
    vehicleType,
    email,
    phone,
    confidence,
  };
}

