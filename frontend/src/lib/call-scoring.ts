/**
 * Rule-based call quality scoring for insurance calls.
 * Evaluates 4 dimensions at 25 points each = 100 total.
 * Pure TypeScript — no external ML.
 */

export interface ScoreDimension {
  name: string;
  score: number; // 0-25
  maxScore: number;
  details: string;
}

export interface CallScore {
  totalScore: number; // 0-100
  dimensions: ScoreDimension[];
  strengths: string[];
  improvements: string[];
  grade: "A" | "B" | "C" | "D" | "F";
}

// Greeting patterns
const GREETING_PATTERNS = [
  /\b(hello|hi|good\s+(morning|afternoon|evening))\b/i,
  /\bwelcome\b/i,
  /\bthank\s+you\s+for\s+calling\b/i,
  /\bhow\s+(can|may)\s+I\s+help\b/i,
  /\bmy\s+name\s+is\b/i,
];

// Discovery question patterns
const DISCOVERY_PATTERNS = [
  /\bwhat\s+(type|kind)\s+of\s+(insurance|coverage|policy)\b/i,
  /\bcurrently\s+(have|carry|insured)\b/i,
  /\brenewal\s+date\b/i,
  /\bcurrent\s+(carrier|provider|insurer)\b/i,
  /\bhow\s+much\s+(coverage|protection)\b/i,
  /\bwhat\s+is\s+your\s+(age|zip|address|vehicle)\b/i,
  /\bhave\s+you\s+(had|filed)\s+(any|a)\s+claim/i,
  /\bwhat\s+are\s+you\s+looking\s+for\b/i,
  /\btell\s+me\s+(about|more)\b/i,
  /\bwhat\s+brings\s+you\b/i,
];

// Information gathering patterns
const INFO_PATTERNS = [
  /\b(policy|coverage)\s+(type|amount|limit)\b/i,
  /\b(deductible|premium|rate)\b/i,
  /\b(auto|home|life|health|commercial)\s+insurance\b/i,
  /\b(vehicle|car|home|house|property)\b/i,
  /\b(driver|driving)\s+(record|history)\b/i,
  /\b(zip\s*code|address|location)\b/i,
  /\b(date\s+of\s+birth|age|dob)\b/i,
  /\b(tobacco|smoking|smoker)\b/i,
  /\b(beneficiary|dependent)\b/i,
  /\b(vin|year|make|model)\b/i,
];

// Quote/objection handling patterns
const RESOLUTION_PATTERNS = [
  /\b(quote|estimate|premium|price|cost)\b/i,
  /\b(monthly|annual|per\s+month)\b/i,
  /\b(bundle|discount|save|savings)\b/i,
  /\b(compare|comparison|better|lower)\b/i,
  /\b(coverage\s+options|plan\s+options)\b/i,
  /\bnext\s+steps?\b/i,
  /\bfollow\s+up\b/i,
  /\bschedule\b/i,
  /\bemail\s+(you|the|a)\b/i,
  /\bsend\s+(you|over|the)\b/i,
];

// Closing patterns
const CLOSING_PATTERNS = [
  /\bthank\s+you\s+(for|so)\b/i,
  /\banything\s+else\b/i,
  /\bhave\s+a\s+(great|good|wonderful)\b/i,
  /\btake\s+care\b/i,
  /\bpleasure\s+(speaking|talking)\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

function getAgentText(transcript: string): string {
  const lines = transcript.split("\n");
  return lines
    .filter((l) => /^(agent|rep)\s*:/i.test(l))
    .map((l) => l.replace(/^(agent|rep)\s*:\s*/i, ""))
    .join(" ");
}

/** Score a call transcript (0-100) across 4 dimensions. */
export function scoreCall(transcript: string): CallScore {
  const agentText = getAgentText(transcript);
  const fullText = transcript;
  const strengths: string[] = [];
  const improvements: string[] = [];

  // Dimension 1: Greeting & Introduction (0-25)
  const greetingHits = countMatches(agentText, GREETING_PATTERNS);
  const hasClosing = countMatches(agentText, CLOSING_PATTERNS) > 0;
  let greetingScore = Math.min(greetingHits * 6, 20);
  if (hasClosing) greetingScore += 5;
  greetingScore = Math.min(greetingScore, 25);

  if (greetingScore >= 20) strengths.push("Strong greeting and professional closing");
  else if (greetingScore < 10) improvements.push("Improve greeting — introduce yourself and the company");

  // Dimension 2: Discovery & Needs Assessment (0-25)
  const discoveryHits = countMatches(agentText, DISCOVERY_PATTERNS);
  const discoveryScore = Math.min(discoveryHits * 5, 25);

  if (discoveryScore >= 20) strengths.push("Thorough needs discovery with probing questions");
  else if (discoveryScore < 10) improvements.push("Ask more discovery questions to understand customer needs");

  // Dimension 3: Information Gathering (0-25)
  const infoHits = countMatches(fullText, INFO_PATTERNS);
  const infoScore = Math.min(infoHits * 3, 25);

  if (infoScore >= 20) strengths.push("Comprehensive information gathering");
  else if (infoScore < 10) improvements.push("Gather more detailed policy information");

  // Dimension 4: Quote/Resolution & Objection Handling (0-25)
  const resolutionHits = countMatches(agentText, RESOLUTION_PATTERNS);
  const resolutionScore = Math.min(resolutionHits * 5, 25);

  if (resolutionScore >= 20) strengths.push("Effective quote presentation and next steps");
  else if (resolutionScore < 10) improvements.push("Present quotes more clearly and establish next steps");

  const totalScore = greetingScore + discoveryScore + infoScore + resolutionScore;

  let grade: CallScore["grade"];
  if (totalScore >= 90) grade = "A";
  else if (totalScore >= 75) grade = "B";
  else if (totalScore >= 60) grade = "C";
  else if (totalScore >= 40) grade = "D";
  else grade = "F";

  return {
    totalScore,
    dimensions: [
      { name: "Greeting & Introduction", score: greetingScore, maxScore: 25, details: `${greetingHits} greeting elements, ${hasClosing ? "has" : "no"} closing` },
      { name: "Discovery & Needs Assessment", score: discoveryScore, maxScore: 25, details: `${discoveryHits} discovery questions identified` },
      { name: "Information Gathering", score: infoScore, maxScore: 25, details: `${infoHits} data points collected` },
      { name: "Quote & Resolution", score: resolutionScore, maxScore: 25, details: `${resolutionHits} resolution indicators found` },
    ],
    strengths,
    improvements,
    grade,
  };
}
