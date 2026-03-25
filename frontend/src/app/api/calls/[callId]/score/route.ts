import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, errorResponse } from "@/lib/api-helpers";
import { scoreCall } from "@/lib/call-scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  // Verify call ownership
  const call = await queryOne<{ id: string }>(
    "SELECT id FROM calls WHERE id = $1 AND organization_id = $2 AND is_deleted = false",
    [params.callId, auth.org_id]
  );
  if (!call) return errorResponse("Call not found", 404);

  // Return cached score from call_sentiments.details if available
  const cached = await queryOne<{ details: { call_score?: unknown } | null }>(
    "SELECT details FROM call_sentiments WHERE call_id = $1",
    [params.callId]
  );
  if (cached?.details?.call_score) {
    return NextResponse.json(cached.details.call_score);
  }

  // Fetch transcript
  const transcriptRow = await queryOne<{ transcript: string | null }>(
    "SELECT transcript FROM call_transcripts WHERE call_id = $1",
    [params.callId]
  );
  if (!transcriptRow?.transcript) {
    return errorResponse("No transcript available for this call", 404);
  }

  const score = scoreCall(transcriptRow.transcript);
  return NextResponse.json(score);
}
