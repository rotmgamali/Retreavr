/**
 * Lexicon-based sentiment analysis for insurance call transcripts.
 * Pure TypeScript — no external ML services.
 */

// Insurance-domain sentiment lexicon
const POSITIVE_WORDS: Record<string, number> = {
  // General positive
  great: 0.6, excellent: 0.8, wonderful: 0.7, perfect: 0.8, thank: 0.4,
  thanks: 0.4, appreciate: 0.5, happy: 0.6, pleased: 0.6, glad: 0.5,
  helpful: 0.5, absolutely: 0.4, sure: 0.2, yes: 0.1, good: 0.4,
  love: 0.6, fantastic: 0.7, amazing: 0.7, awesome: 0.6,
  // Insurance positive
  covered: 0.6, savings: 0.7, discount: 0.7, approved: 0.8, protection: 0.5,
  affordable: 0.6, competitive: 0.5, bundled: 0.5, comprehensive: 0.5,
  secure: 0.5, safe: 0.4, peace: 0.5, guaranteed: 0.6, benefit: 0.5,
  benefits: 0.5, qualify: 0.5, eligible: 0.5, reduced: 0.4,
  lower: 0.4, save: 0.5,
};

const NEGATIVE_WORDS: Record<string, number> = {
  // General negative
  no: -0.2, not: -0.2, never: -0.4, bad: -0.5, terrible: -0.8,
  horrible: -0.8, awful: -0.7, hate: -0.7, angry: -0.6, upset: -0.5,
  frustrated: -0.6, annoyed: -0.5, disappointed: -0.6, worried: -0.4,
  concerned: -0.3, confused: -0.4, unfortunately: -0.4, problem: -0.4,
  issue: -0.3, wrong: -0.4, difficult: -0.3,
  // Insurance negative
  denied: -0.8, claim: -0.3, increase: -0.4, expensive: -0.5,
  cancel: -0.5, cancellation: -0.6, lapse: -0.6, lapsed: -0.6,
  deductible: -0.2, exclusion: -0.5, excluded: -0.5, reject: -0.7,
  rejected: -0.7, surcharge: -0.5, penalty: -0.5, accident: -0.4,
  violation: -0.5, uninsured: -0.6, overcharged: -0.6,
  "premium increase": -0.6,
};

// Intensifiers and negators
const INTENSIFIERS: Record<string, number> = {
  very: 1.5, really: 1.4, extremely: 1.8, absolutely: 1.6,
  incredibly: 1.6, highly: 1.4, quite: 1.2, so: 1.3, totally: 1.5,
};

const NEGATORS = new Set([
  "not", "no", "never", "neither", "nor", "don't", "doesn't",
  "didn't", "won't", "wouldn't", "couldn't", "shouldn't", "isn't",
  "aren't", "wasn't", "weren't", "can't", "cannot",
]);

export type SentimentLabel =
  | "positive"
  | "negative"
  | "neutral"
  | "frustrated"
  | "interested"
  | "confused"
  | "satisfied";

export interface SegmentSentiment {
  speaker: "agent" | "customer";
  text: string;
  score: number; // -1 to 1
  label: SentimentLabel;
  startIndex: number;
}

export interface SentimentResult {
  overallScore: number; // -1 to 1
  overallLabel: SentimentLabel;
  customerSentiment: number;
  agentSentiment: number;
  timeline: SegmentSentiment[];
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
}

function scoreToLabel(score: number): SentimentLabel {
  if (score >= 0.3) return "positive";
  if (score >= 0.15) return "satisfied";
  if (score <= -0.4) return "frustrated";
  if (score <= -0.2) return "negative";
  if (score <= -0.05) return "confused";
  return "neutral";
}

function scoreText(text: string): { score: number; posCount: number; negCount: number } {
  const words = text.toLowerCase().replace(/[^\w\s'-]/g, "").split(/\s+/);
  let totalScore = 0;
  let posCount = 0;
  let negCount = 0;
  let wordCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : "";
    const prevPrevWord = i > 1 ? words[i - 2] : "";

    let wordScore = POSITIVE_WORDS[word] ?? NEGATIVE_WORDS[word] ?? 0;
    if (wordScore === 0) continue;

    // Apply negation (within 2-word window)
    if (NEGATORS.has(prevWord) || NEGATORS.has(prevPrevWord)) {
      wordScore = -wordScore * 0.75;
    }

    // Apply intensifier
    if (INTENSIFIERS[prevWord]) {
      wordScore *= INTENSIFIERS[prevWord];
    }

    totalScore += wordScore;
    wordCount++;
    if (wordScore > 0) posCount++;
    else if (wordScore < 0) negCount++;
  }

  // Normalize: more words dilute the average less
  const normalizer = Math.max(wordCount, 1);
  const score = Math.max(-1, Math.min(1, totalScore / normalizer));

  return { score, posCount, negCount };
}

/** Parse transcript into speaker segments. Expects lines like "Agent: ..." or "Customer: ..." */
export function parseTranscriptSegments(
  transcript: string
): { speaker: "agent" | "customer"; text: string; startIndex: number }[] {
  const segments: { speaker: "agent" | "customer"; text: string; startIndex: number }[] = [];
  const lines = transcript.split("\n");
  let currentIndex = 0;

  for (const line of lines) {
    const match = line.match(/^(agent|customer|rep|caller|client)\s*:\s*(.+)/i);
    if (match) {
      const speakerRaw = match[1].toLowerCase();
      const speaker: "agent" | "customer" =
        speakerRaw === "agent" || speakerRaw === "rep" ? "agent" : "customer";
      segments.push({ speaker, text: match[2].trim(), startIndex: currentIndex });
    } else if (line.trim() && segments.length > 0) {
      // Continuation of previous segment
      segments[segments.length - 1].text += " " + line.trim();
    }
    currentIndex += line.length + 1;
  }

  return segments;
}

/** Analyze sentiment of a call transcript. */
export function analyzeSentiment(transcript: string): SentimentResult {
  const segments = parseTranscriptSegments(transcript);

  if (segments.length === 0) {
    // No parseable segments — score the whole text
    const { score, posCount, negCount } = scoreText(transcript);
    return {
      overallScore: score,
      overallLabel: scoreToLabel(score),
      customerSentiment: score,
      agentSentiment: score,
      timeline: [],
      positiveCount: posCount,
      negativeCount: negCount,
      neutralCount: posCount === 0 && negCount === 0 ? 1 : 0,
    };
  }

  const timeline: SegmentSentiment[] = [];
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;
  let customerScoreSum = 0;
  let customerCount = 0;
  let agentScoreSum = 0;
  let agentCount = 0;

  for (const seg of segments) {
    const { score, posCount, negCount } = scoreText(seg.text);
    const label = scoreToLabel(score);

    timeline.push({
      speaker: seg.speaker,
      text: seg.text,
      score,
      label,
      startIndex: seg.startIndex,
    });

    totalPositive += posCount;
    totalNegative += negCount;
    if (posCount === 0 && negCount === 0) totalNeutral++;

    if (seg.speaker === "customer") {
      customerScoreSum += score;
      customerCount++;
    } else {
      agentScoreSum += score;
      agentCount++;
    }
  }

  const overallScore =
    (customerScoreSum + agentScoreSum) / Math.max(customerCount + agentCount, 1);

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    overallLabel: scoreToLabel(overallScore),
    customerSentiment: Math.round((customerScoreSum / Math.max(customerCount, 1)) * 100) / 100,
    agentSentiment: Math.round((agentScoreSum / Math.max(agentCount, 1)) * 100) / 100,
    timeline,
    positiveCount: totalPositive,
    negativeCount: totalNegative,
    neutralCount: totalNeutral,
  };
}
