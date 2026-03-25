import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { queryOne } from "@/lib/db";
import { requireAuthAndRole, parseBody, errorResponse } from "@/lib/api-helpers";
import {
  sessionManager,
  buildSystemPrompt,
  INSURANCE_TOOL_DEFINITIONS,
} from "@/lib/voice-engine";
import type { CallType } from "@/lib/voice-engine";

/**
 * POST /api/voice/outbound — Initiate an outbound call.
 *
 * Body: {
 *   agent_id: string,
 *   lead_id?: string,
 *   phone_to: string,
 *   call_type?: CallType,
 * }
 *
 * In production this would use the Twilio REST API to place the call
 * and then connect the audio via a <Stream> to the Realtime API.
 * For now, it creates the session and returns config for browser-based calling.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req);
  if (!body || !body.agent_id) return errorResponse("agent_id is required", 400);
  if (!body.phone_to) return errorResponse("phone_to is required", 400);

  const agentId = body.agent_id as string;
  const leadId = (body.lead_id as string) ?? null;
  const phoneTo = body.phone_to as string;
  const callType = (body.call_type as CallType) ?? "outbound_sales";

  // Fetch voice agent
  const agent = await queryOne<Record<string, unknown>>(
    `SELECT id, name, persona, system_prompt, voice, vad_config, organization_id
     FROM voice_agents WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [agentId, auth.org_id]
  );

  if (!agent) return errorResponse("Voice agent not found or inactive", 404);

  // Fetch org info
  const org = await queryOne<{ name: string }>(
    "SELECT name FROM organizations WHERE id = $1",
    [auth.org_id]
  );

  // Fetch org's outbound caller ID
  const phoneFrom = await queryOne<{ phone_number: string }>(
    `SELECT phone_number FROM phone_numbers
     WHERE organization_id = $1 AND is_active = true AND type = 'outbound'
     ORDER BY created_at LIMIT 1`,
    [auth.org_id]
  );

  // Build system prompt
  const instructions = await buildSystemPrompt({
    agentName: agent.name as string,
    agentPersona: (agent.persona as string) ?? "Professional insurance agent",
    agentSystemPrompt: (agent.system_prompt as string) ?? undefined,
    callType,
    orgId: auth.org_id,
    orgName: org?.name,
    leadId,
  });

  // Create call record
  const callId = randomUUID();
  await queryOne(
    `INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, phone_from, phone_to, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'outbound', 'initiated', $5, $6, false, NOW(), NOW())
     RETURNING id`,
    [
      callId,
      auth.org_id,
      agentId,
      leadId,
      phoneFrom?.phone_number ?? null,
      phoneTo,
    ]
  );

  // Create session
  const sessionId = randomUUID();
  const session = sessionManager.create({
    id: sessionId,
    org_id: auth.org_id,
    agent_id: agentId,
    lead_id: leadId,
    call_id: callId,
    direction: "outbound",
    voice: (agent.voice as string) ?? "alloy",
    phone_from: phoneFrom?.phone_number ?? null,
    phone_to: phoneTo,
    metadata: { call_type: callType, user_id: auth.sub },
  });

  // In a real implementation, this is where we'd call Twilio REST API:
  // const twilioCall = await twilioClient.calls.create({
  //   to: phoneTo,
  //   from: phoneFrom?.phone_number,
  //   url: `https://${host}/api/voice/webhook/outbound-connect?session_id=${sessionId}`,
  //   statusCallback: `https://${host}/api/voice/webhook/status`,
  // });

  return NextResponse.json(
    {
      session_id: session.id,
      call_id: callId,
      voice: session.voice,
      phone_from: phoneFrom?.phone_number ?? null,
      phone_to: phoneTo,
      instructions,
      tools: INSURANCE_TOOL_DEFINITIONS,
      vad_config: agent.vad_config ?? {
        type: "server_vad",
        silence_duration_ms: 500,
        threshold: 0.5,
        prefix_padding_ms: 300,
      },
      // Client should use these to connect via browser WebRTC
      connection_mode: "browser",
    },
    { status: 201 }
  );
}
