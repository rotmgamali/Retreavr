/**
 * Post-call processing: persist call data and clean up sessions.
 */

import { sessionManager } from "./session-manager";
import { queryOne } from "@/lib/db";

export interface CallEndResult {
  call_id: string;
  duration_seconds: number;
  transcript_lines: number;
  summary: string | null;
}

export async function processCallEnd(sessionId: string): Promise<CallEndResult | null> {
  const session = sessionManager.get(sessionId);
  if (!session) return null;

  const durationSeconds = sessionManager.getDuration(sessionId);
  const transcriptLines = session.transcript.length;

  const summary =
    transcriptLines > 0
      ? `Call lasted ${durationSeconds}s with ${transcriptLines} transcript exchanges.`
      : null;

  try {
    await queryOne(
      `UPDATE calls SET status = 'completed', duration = $2, updated_at = NOW() WHERE id = $1`,
      [session.call_id, durationSeconds]
    );
  } catch {
    // Non-fatal
  }

  return {
    call_id: session.call_id ?? "",
    duration_seconds: durationSeconds,
    transcript_lines: transcriptLines,
    summary,
  };
}
