import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole, errorResponse } from "@/lib/api-helpers";
import { sessionManager, processCallEnd } from "@/lib/voice-engine";

/**
 * GET /api/voice/session/[sessionId] — Get session status and metadata.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const session = sessionManager.get(params.sessionId);
  if (!session || session.org_id !== auth.org_id) {
    return errorResponse("Session not found", 404);
  }

  return NextResponse.json({
    id: session.id,
    org_id: session.org_id,
    agent_id: session.agent_id,
    lead_id: session.lead_id,
    call_id: session.call_id,
    direction: session.direction,
    status: session.status,
    voice: session.voice,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_seconds: sessionManager.getDuration(session.id),
    transcript_lines: session.transcript.length,
  });
}

/**
 * DELETE /api/voice/session/[sessionId] — End a voice session.
 *
 * Triggers post-call processing (summary, sentiment, DB persistence).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const session = sessionManager.get(params.sessionId);
  if (!session || session.org_id !== auth.org_id) {
    return errorResponse("Session not found", 404);
  }

  // Mark as ending
  sessionManager.end(params.sessionId);

  // Run post-call processing (async but we await it)
  const result = await processCallEnd(params.sessionId);

  return NextResponse.json({
    ended: true,
    session_id: params.sessionId,
    call_id: session.call_id,
    duration_seconds: sessionManager.getDuration(params.sessionId),
    summary: result ?? null,
  });
}
