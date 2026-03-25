/**
 * Post-call processing: summarization, entity extraction, sentiment,
 * and database persistence.
 *
 * Uses gpt-4o-mini for all post-call AI work (cheapest option).
 */

import { queryOne } from "@/lib/db";
import { randomUUID } from "crypto";
import { analyzeSentiment } from "@/lib/sentiment";
import { sessionManager } from "./session-manager";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const POST_CALL_MODEL = "gpt-4o-mini";

interface CallSummaryResult {
  summary: string;
  key_points: string[];
  next_actions: string[];
  entities: ExtractedEntities;
  sentiment_score: number;
  sentiment_label: string;
  outcome: string;
}

interface ExtractedEntities {
  customer_name?: string;
  policy_numbers: string[];
  claim_numbers: string[];
  dates: string[];
  amounts: string[];
  phone_numbers: string[];
  insurance_types: string[];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run full post-call processing for a finished session.
 * Generates summary, extracts entities, scores sentiment,
 * and persists everything to the database.
 */
export async function processCallEnd(
  sessionId: string
): Promise<CallSummaryResult | null> {
  const session = sessionManager.get(sessionId);
  if (!session) return null;

  const transcript = sessionManager.getTranscriptText(sessionId);
  if (!transcript || transcript.trim().length < 10) {
    // Too short to process
    await finalizeCallRecord(session.call_id, null, sessionManager.getDuration(sessionId), "neutral");
    sessionManager.remove(sessionId);
    return null;
  }

  // Run summary + entity extraction in parallel with sentiment
  const apiKey = process.env.OPENAI_API_KEY;

  let result: CallSummaryResult;

  if (apiKey) {
    const [aiResult, sentimentResult] = await Promise.all([
      generateAISummary(transcript, apiKey),
      Promise.resolve(analyzeSentiment(transcript)),
    ]);

    result = {
      ...aiResult,
      sentiment_score: sentimentResult.overallScore,
      sentiment_label: sentimentResult.overallLabel,
    };
  } else {
    // Fallback: sentiment-only analysis when no API key
    const sentimentResult = analyzeSentiment(transcript);
    result = {
      summary: transcript.substring(0, 500),
      key_points: [],
      next_actions: [],
      entities: extractEntitiesLocal(transcript),
      sentiment_score: sentimentResult.overallScore,
      sentiment_label: sentimentResult.overallLabel,
      outcome: "completed",
    };
  }

  // Persist to database
  const duration = sessionManager.getDuration(sessionId);

  await Promise.all([
    saveTranscript(session.call_id, transcript),
    saveSummary(session.call_id, result),
    finalizeCallRecord(
      session.call_id,
      result,
      duration,
      result.sentiment_label
    ),
    updateLeadFromOutcome(session.lead_id, session.org_id, result),
  ]);

  // Clean up in-memory session
  sessionManager.remove(sessionId);

  return result;
}

// ── AI Summary Generation (gpt-4o-mini) ──────────────────────────────────────

async function generateAISummary(
  transcript: string,
  apiKey: string
): Promise<{
  summary: string;
  key_points: string[];
  next_actions: string[];
  entities: ExtractedEntities;
  outcome: string;
}> {
  const systemPrompt = `You are a post-call analyst for an insurance company. Analyze the following call transcript and return a JSON object with these fields:
- "summary": A 2-3 sentence summary of the call.
- "key_points": Array of key discussion points (max 5).
- "next_actions": Array of follow-up actions needed (max 3).
- "entities": Object with: customer_name (string or null), policy_numbers (string[]), claim_numbers (string[]), dates (string[]), amounts (string[]), phone_numbers (string[]), insurance_types (string[]).
- "outcome": One of "sale_completed", "quote_given", "callback_scheduled", "transferred", "issue_resolved", "no_resolution", "not_interested", "voicemail", "completed".
Return ONLY valid JSON, no markdown.`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: POST_CALL_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript.substring(0, 8000) }, // limit tokens
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary ?? "Call completed.",
      key_points: parsed.key_points ?? [],
      next_actions: parsed.next_actions ?? [],
      entities: {
        customer_name: parsed.entities?.customer_name ?? undefined,
        policy_numbers: parsed.entities?.policy_numbers ?? [],
        claim_numbers: parsed.entities?.claim_numbers ?? [],
        dates: parsed.entities?.dates ?? [],
        amounts: parsed.entities?.amounts ?? [],
        phone_numbers: parsed.entities?.phone_numbers ?? [],
        insurance_types: parsed.entities?.insurance_types ?? [],
      },
      outcome: parsed.outcome ?? "completed",
    };
  } catch {
    // Fallback to local extraction
    return {
      summary: "Call summary generation failed. See transcript.",
      key_points: [],
      next_actions: [],
      entities: extractEntitiesLocal(transcript),
      outcome: "completed",
    };
  }
}

// ── Local entity extraction (no API needed) ──────────────────────────────────

function extractEntitiesLocal(transcript: string): ExtractedEntities {
  const policyNumbers =
    transcript.match(/\b[A-Z]{2,3}-?\d{6,10}\b/g) ?? [];
  const claimNumbers =
    transcript.match(/\bCL[A-Z]?-?\d{6,10}\b/gi) ?? [];
  const dates =
    transcript.match(
      /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})\b/g
    ) ?? [];
  const amounts =
    transcript.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
  const phoneNumbers =
    transcript.match(
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
    ) ?? [];
  const insuranceTypes: string[] = [];
  for (const t of ["auto", "home", "life", "renters", "umbrella", "commercial"]) {
    if (transcript.toLowerCase().includes(t + " insurance")) {
      insuranceTypes.push(t);
    }
  }

  return {
    policy_numbers: Array.from(new Set(policyNumbers)),
    claim_numbers: Array.from(new Set(claimNumbers)),
    dates: Array.from(new Set(dates)),
    amounts: Array.from(new Set(amounts)),
    phone_numbers: Array.from(new Set(phoneNumbers)),
    insurance_types: Array.from(new Set(insuranceTypes)),
  };
}

// ── Database persistence ─────────────────────────────────────────────────────

async function saveTranscript(
  callId: string | null,
  transcript: string
): Promise<void> {
  if (!callId) return;
  await queryOne(
    `INSERT INTO call_transcripts (id, call_id, transcript, language, created_at)
     VALUES ($1, $2, $3, 'en', NOW())
     ON CONFLICT (call_id) DO UPDATE SET transcript = $3`,
    [randomUUID(), callId, transcript]
  ).catch(() => {});
}

async function saveSummary(
  callId: string | null,
  result: CallSummaryResult
): Promise<void> {
  if (!callId) return;
  await queryOne(
    `INSERT INTO call_summaries (id, call_id, summary, key_points, next_actions, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (call_id) DO UPDATE SET summary = $3, key_points = $4, next_actions = $5`,
    [
      randomUUID(),
      callId,
      result.summary,
      JSON.stringify(result.key_points),
      JSON.stringify(result.next_actions),
    ]
  ).catch(() => {});
}

/* eslint-disable @typescript-eslint/no-unused-vars */
async function finalizeCallRecord(
  callId: string | null,
  result: CallSummaryResult | null,
  durationSeconds: number,
  _sentimentLabel: string
): Promise<void> {
/* eslint-enable @typescript-eslint/no-unused-vars */
  if (!callId) return;

  const sentimentScore = result?.sentiment_score ?? 0;

  await queryOne(
    `UPDATE calls SET
       status = 'completed',
       duration = $1,
       sentiment_score = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [durationSeconds, sentimentScore, callId]
  ).catch(() => {});
}

async function updateLeadFromOutcome(
  leadId: string | null,
  orgId: string,
  result: CallSummaryResult
): Promise<void> {
  if (!leadId) return;

  // Map call outcome to lead status
  const outcomeToStatus: Record<string, string> = {
    sale_completed: "bound",
    quote_given: "quoted",
    callback_scheduled: "contacted",
    transferred: "contacted",
    issue_resolved: "contacted",
    not_interested: "lost",
  };

  const newStatus = outcomeToStatus[result.outcome];
  if (!newStatus) return;

  await queryOne(
    `UPDATE leads SET status = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [newStatus, leadId, orgId]
  ).catch(() => {});

  // Log the interaction
  await queryOne(
    `INSERT INTO lead_interactions (id, lead_id, interaction_type, notes, metadata, created_at)
     VALUES ($1, $2, 'voice_call', $3, $4, NOW())`,
    [
      randomUUID(),
      leadId,
      result.summary,
      JSON.stringify({
        outcome: result.outcome,
        sentiment: result.sentiment_label,
        key_points: result.key_points,
      }),
    ]
  ).catch(() => {});
}
