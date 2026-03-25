import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuthAndRole, errorResponse } from "@/lib/api-helpers";
import { analyzeSentiment, SentimentLabel } from "@/lib/sentiment";
import { scoreCall } from "@/lib/call-scoring";

function scoreToLabel(score: number): SentimentLabel {
  if (score >= 0.3) return "positive";
  if (score >= 0.15) return "satisfied";
  if (score <= -0.4) return "frustrated";
  if (score <= -0.2) return "negative";
  if (score <= -0.05) return "confused";
  return "neutral";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Verify call ownership
  const call = await queryOne<{ id: string; sentiment_score: number | null }>(
    "SELECT id, sentiment_score FROM calls WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.callId, auth.org_id]
  );
  if (!call) return errorResponse("Call not found", 404);

  // Return cached sentiment if already processed
  const cached = await queryOne<{
    overall_score: number | null;
    customer_sentiment: string | null;
    agent_sentiment: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT overall_score, customer_sentiment, agent_sentiment, details, created_at, updated_at FROM call_sentiments WHERE call_id = $1",
    [params.callId]
  );
  if (cached) return NextResponse.json(cached);

  // Fetch transcript
  const transcriptRow = await queryOne<{ transcript: string | null }>(
    "SELECT transcript FROM call_transcripts WHERE call_id = $1",
    [params.callId]
  );
  if (!transcriptRow?.transcript) {
    return errorResponse("No transcript available for this call", 404);
  }

  const transcript = transcriptRow.transcript;

  // Run sentiment analysis and call scoring
  const sentiment = analyzeSentiment(transcript);
  const callScore = scoreCall(transcript);

  const details = {
    sentiment: {
      overallScore: sentiment.overallScore,
      overallLabel: sentiment.overallLabel,
      customerSentiment: sentiment.customerSentiment,
      agentSentiment: sentiment.agentSentiment,
      timeline: sentiment.timeline,
      positiveCount: sentiment.positiveCount,
      negativeCount: sentiment.negativeCount,
      neutralCount: sentiment.neutralCount,
    },
    call_score: {
      totalScore: callScore.totalScore,
      dimensions: callScore.dimensions,
      strengths: callScore.strengths,
      improvements: callScore.improvements,
      grade: callScore.grade,
    },
  };

  // Store in call_sentiments
  const [stored] = await query<{
    overall_score: number;
    customer_sentiment: string;
    agent_sentiment: string;
    details: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO call_sentiments (call_id, overall_score, customer_sentiment, agent_sentiment, details)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (call_id) DO UPDATE SET
       overall_score = EXCLUDED.overall_score,
       customer_sentiment = EXCLUDED.customer_sentiment,
       agent_sentiment = EXCLUDED.agent_sentiment,
       details = EXCLUDED.details,
       updated_at = NOW()
     RETURNING overall_score, customer_sentiment, agent_sentiment, details, created_at, updated_at`,
    [
      params.callId,
      callScore.totalScore,
      scoreToLabel(sentiment.customerSentiment),
      scoreToLabel(sentiment.agentSentiment),
      details,
    ]
  );

  // Update calls.sentiment_score
  await query(
    "UPDATE calls SET sentiment_score = $1, updated_at = NOW() WHERE id = $2",
    [callScore.totalScore, params.callId]
  );

  return NextResponse.json(stored);
}
