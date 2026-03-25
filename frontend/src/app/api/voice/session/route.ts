import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";
import {
  sessionManager,
  buildSystemPrompt,
  INSURANCE_TOOL_DEFINITIONS,
  executeInsuranceTool,
} from "@/lib/voice-engine";
import type { CallType } from "@/lib/voice-engine";

/**
 * POST /api/voice/session — Create a new voice session.
 *
 * Body: { agent_id, lead_id?, direction, call_type?, phone_from?, phone_to? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body || !body.agent_id) return errorResponse("agent_id is required", 400);

  const agentId = body.agent_id as string;
  const leadId = (body.lead_id as string) ?? null;
  const direction = (body.direction as string) === "inbound" ? "inbound" : "outbound";
  const callType = (body.call_type as CallType) ?? (direction === "inbound" ? "inbound_support" : "outbound_sales");

  // Fetch the voice agent config
  const agent = await queryOne<Record<string, unknown>>(
    `SELECT id, name, persona, system_prompt, voice, vad_config, organization_id
     FROM voice_agents
     WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [agentId, auth.org_id]
  );

  if (!agent) return errorResponse("Voice agent not found or inactive", 404);

  // Fetch org name for the prompt
  const org = await queryOne<{ name: string }>(
    "SELECT name FROM organizations WHERE id = $1",
    [auth.org_id]
  );

  // Build the system prompt
  const instructions = await buildSystemPrompt({
    agentName: agent.name as string,
    agentPersona: (agent.persona as string) ?? "Professional insurance agent",
    agentSystemPrompt: (agent.system_prompt as string) ?? undefined,
    callType,
    orgId: auth.org_id,
    orgName: org?.name,
    leadId,
  });

  // Create call record in the database
  const callId = randomUUID();
  await queryOne(
    `INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, phone_from, phone_to, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'initiated', $6, $7, false, NOW(), NOW())
     RETURNING id`,
    [
      callId,
      auth.org_id,
      agentId,
      leadId,
      direction,
      (body.phone_from as string) ?? null,
      (body.phone_to as string) ?? null,
    ]
  );

  // Create in-memory session
  const sessionId = randomUUID();
  const session = sessionManager.create({
    id: sessionId,
    org_id: auth.org_id,
    agent_id: agentId,
    lead_id: leadId,
    call_id: callId,
    direction: direction as "inbound" | "outbound",
    voice: (agent.voice as string) ?? "alloy",
    phone_from: (body.phone_from as string) ?? null,
    phone_to: (body.phone_to as string) ?? null,
    metadata: { call_type: callType, user_id: auth.sub },
  });

  return NextResponse.json(
    {
      session_id: session.id,
      call_id: callId,
      voice: session.voice,
      instructions,
      tools: INSURANCE_TOOL_DEFINITIONS,
      vad_config: agent.vad_config ?? {
        type: "server_vad",
        silence_duration_ms: 500,
        threshold: 0.5,
        prefix_padding_ms: 300,
      },
    },
    { status: 201 }
  );
}

/**
 * PATCH /api/voice/session — Execute a tool call from the browser Realtime client.
 *
 * Body: { session_id: string, tool_call: { name: string, arguments: string, call_id: string } }
 *
 * The browser-side RealtimeClient cannot call tools server-side directly, so
 * it proxies function_call_arguments.done events here for secure server-side execution.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body?.session_id || !body?.tool_call) {
    return errorResponse("session_id and tool_call are required", 400);
  }

  const { session_id, tool_call } = body as {
    session_id: string;
    tool_call: { name: string; arguments: string; call_id: string };
  };

  const session = sessionManager.get(session_id);
  if (!session || session.org_id !== auth.org_id) {
    return errorResponse("Session not found", 404);
  }

  const result = await executeInsuranceTool(
    tool_call.name,
    tool_call.arguments,
    session.org_id
  );

  return NextResponse.json({ result, call_id: tool_call.call_id });
}

/**
 * GET /api/voice/session — List active sessions for the org.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const sessions = sessionManager.activeForOrg(auth.org_id).map((s) => ({
    id: s.id,
    agent_id: s.agent_id,
    lead_id: s.lead_id,
    call_id: s.call_id,
    direction: s.direction,
    status: s.status,
    voice: s.voice,
    started_at: s.started_at,
    duration_seconds: sessionManager.getDuration(s.id),
  }));

  return NextResponse.json({ sessions, count: sessions.length });
}
