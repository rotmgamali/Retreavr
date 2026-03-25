/**
 * In-memory session manager for active voice calls.
 *
 * Tracks session lifecycle, enforces per-org concurrency limits,
 * and exposes helpers used by the API routes.
 *
 * Note: In a Vercel serverless environment each isolate has its own
 * memory. For true cross-instance coordination you would front this
 * with Redis or a database row lock. This module provides the
 * single-instance baseline.
 */

export type SessionStatus = "creating" | "active" | "ending" | "ended";

export interface VoiceSession {
  id: string;
  org_id: string;
  agent_id: string;
  lead_id: string | null;
  call_id: string | null;
  direction: "inbound" | "outbound";
  status: SessionStatus;
  voice: string;
  phone_from: string | null;
  phone_to: string | null;
  /** ISO timestamp */
  started_at: string;
  /** ISO timestamp */
  ended_at: string | null;
  /** Accumulated transcript lines */
  transcript: TranscriptLine[];
  /** Metadata for post-processing */
  metadata: Record<string, unknown>;
}

export interface TranscriptLine {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

/** Default max concurrent calls per organization. */
const DEFAULT_MAX_CONCURRENT = 10;

class SessionManager {
  /** sessionId -> VoiceSession */
  private sessions = new Map<string, VoiceSession>();

  /** Per-org concurrency limits. Falls back to DEFAULT_MAX_CONCURRENT. */
  private orgLimits = new Map<string, number>();

  // ── Lifecycle ───────────────────────────────────────────────────────────

  create(opts: {
    id: string;
    org_id: string;
    agent_id: string;
    lead_id?: string | null;
    call_id?: string | null;
    direction: "inbound" | "outbound";
    voice?: string;
    phone_from?: string | null;
    phone_to?: string | null;
    metadata?: Record<string, unknown>;
  }): VoiceSession {
    // Enforce concurrency
    const active = this.activeForOrg(opts.org_id);
    const limit =
      this.orgLimits.get(opts.org_id) ?? DEFAULT_MAX_CONCURRENT;
    if (active.length >= limit) {
      throw new Error(
        `Org ${opts.org_id} has reached the concurrent session limit (${limit})`
      );
    }

    const session: VoiceSession = {
      id: opts.id,
      org_id: opts.org_id,
      agent_id: opts.agent_id,
      lead_id: opts.lead_id ?? null,
      call_id: opts.call_id ?? null,
      direction: opts.direction,
      status: "creating",
      voice: opts.voice ?? "alloy",
      phone_from: opts.phone_from ?? null,
      phone_to: opts.phone_to ?? null,
      started_at: new Date().toISOString(),
      ended_at: null,
      transcript: [],
      metadata: opts.metadata ?? {},
    };

    this.sessions.set(session.id, session);
    return session;
  }

  activate(sessionId: string): VoiceSession | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    s.status = "active";
    return s;
  }

  end(sessionId: string): VoiceSession | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    s.status = "ended";
    s.ended_at = new Date().toISOString();
    return s;
  }

  /** Remove from memory entirely (after post-processing). */
  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  get(sessionId: string): VoiceSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  activeForOrg(orgId: string): VoiceSession[] {
    const result: VoiceSession[] = [];
    const all = Array.from(this.sessions.values());
    for (const s of all) {
      if (s.org_id === orgId && (s.status === "active" || s.status === "creating")) {
        result.push(s);
      }
    }
    return result;
  }

  allForOrg(orgId: string): VoiceSession[] {
    const result: VoiceSession[] = [];
    const all = Array.from(this.sessions.values());
    for (const s of all) {
      if (s.org_id === orgId) result.push(s);
    }
    return result;
  }

  listAll(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  // ── Transcript helpers ──────────────────────────────────────────────────

  appendTranscript(
    sessionId: string,
    role: "user" | "assistant" | "system",
    text: string
  ): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.transcript.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  getTranscriptText(sessionId: string): string {
    const s = this.sessions.get(sessionId);
    if (!s) return "";
    return s.transcript
      .map((l) => {
        const label =
          l.role === "user"
            ? "Customer"
            : l.role === "assistant"
            ? "Agent"
            : "System";
        return `${label}: ${l.text}`;
      })
      .join("\n");
  }

  // ── Concurrency config ──────────────────────────────────────────────────

  setOrgLimit(orgId: string, limit: number): void {
    this.orgLimits.set(orgId, limit);
  }

  /** Duration in seconds from started_at to now (or ended_at). */
  getDuration(sessionId: string): number {
    const s = this.sessions.get(sessionId);
    if (!s) return 0;
    const end = s.ended_at ? new Date(s.ended_at) : new Date();
    return Math.round(
      (end.getTime() - new Date(s.started_at).getTime()) / 1000
    );
  }
}

/** Singleton — shared across all requests in the same process. */
export const sessionManager = new SessionManager();
