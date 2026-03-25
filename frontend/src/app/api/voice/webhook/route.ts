import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { queryOne } from "@/lib/db";
import {
  sessionManager,
  buildSystemPrompt,
} from "@/lib/voice-engine";

/**
 * POST /api/voice/webhook — Twilio webhook handler for inbound calls.
 *
 * When Twilio receives a call to your number, it POSTs here.
 * We create a session and return TwiML that connects to the
 * OpenAI Realtime API via Twilio's <Stream>.
 */
export async function POST(req: NextRequest) {
  // Parse Twilio's form-encoded body
  const formData = await req.formData();
  const callSid = formData.get("CallSid") as string;
  const from = formData.get("From") as string;
  const to = formData.get("To") as string;
  const callerCity = formData.get("CallerCity") as string | null;
  const callerState = formData.get("CallerState") as string | null;

  // Look up which org owns this phone number
  const phoneConfig = await queryOne<{
    organization_id: string;
    agent_id: string;
  }>(
    `SELECT organization_id, default_agent_id as agent_id
     FROM phone_numbers
     WHERE phone_number = $1 AND is_active = true
     LIMIT 1`,
    [to]
  );

  if (!phoneConfig) {
    // No org mapped to this number — return a polite rejection
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, this number is not currently in service. Please try again later.</Say>
  <Hangup/>
</Response>`,
      {
        headers: { "Content-Type": "text/xml" },
      }
    );
  }

  // Fetch agent config
  const agent = await queryOne<Record<string, unknown>>(
    `SELECT id, name, persona, system_prompt, voice, vad_config
     FROM voice_agents WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [phoneConfig.agent_id, phoneConfig.organization_id]
  );

  if (!agent) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>All agents are currently unavailable. Please call back later.</Say>
  <Hangup/>
</Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Try to match the caller to an existing lead
  const lead = await queryOne<{ id: string }>(
    `SELECT id FROM leads
     WHERE organization_id = $1 AND phone = $2
     ORDER BY updated_at DESC LIMIT 1`,
    [phoneConfig.organization_id, from]
  );

  // Build system prompt
  const org = await queryOne<{ name: string }>(
    "SELECT name FROM organizations WHERE id = $1",
    [phoneConfig.organization_id]
  );

  // Build the system prompt — stored in session metadata for the stream handler
  const instructions = await buildSystemPrompt({
    agentName: agent.name as string,
    agentPersona: (agent.persona as string) ?? "Professional insurance agent",
    agentSystemPrompt: (agent.system_prompt as string) ?? undefined,
    callType: "inbound_support",
    orgId: phoneConfig.organization_id,
    orgName: org?.name,
    leadId: lead?.id,
  });

  // Create call record
  const callId = randomUUID();
  await queryOne(
    `INSERT INTO calls (id, organization_id, agent_id, lead_id, direction, status, phone_from, phone_to, twilio_sid, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'inbound', 'in-progress', $5, $6, $7, false, NOW(), NOW())
     RETURNING id`,
    [
      callId,
      phoneConfig.organization_id,
      phoneConfig.agent_id,
      lead?.id ?? null,
      from,
      to,
      callSid,
    ]
  );

  // Create session
  const sessionId = randomUUID();
  sessionManager.create({
    id: sessionId,
    org_id: phoneConfig.organization_id,
    agent_id: phoneConfig.agent_id,
    lead_id: lead?.id ?? null,
    call_id: callId,
    direction: "inbound",
    voice: (agent.voice as string) ?? "alloy",
    phone_from: from,
    phone_to: to,
    metadata: {
      twilio_sid: callSid,
      caller_city: callerCity,
      caller_state: callerState,
      instructions,
    },
  });
  sessionManager.activate(sessionId);

  // Build the WebSocket URL for Twilio's <Stream> to connect to
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "ws" : "wss";
  const streamUrl = `${protocol}://${host}/api/voice/stream?session_id=${sessionId}`;

  // Return TwiML that connects the call audio to our WebSocket
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="session_id" value="${sessionId}" />
      <Parameter name="call_id" value="${callId}" />
    </Stream>
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
