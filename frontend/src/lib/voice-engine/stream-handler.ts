/**
 * Twilio Media Stream <-> OpenAI Realtime API bridge.
 */

import { sessionManager } from "./session-manager";
import { processCallEnd } from "./call-processor";
import { executeInsuranceTool, INSURANCE_TOOL_DEFINITIONS } from "./insurance-tools";
import { buildSystemPrompt, type CallType } from "./prompt-builder";
import { queryOne } from "@/lib/db";

interface TwilioMediaEvent {
  event: "connected" | "start" | "media" | "stop" | "mark";
  streamSid?: string;
  start?: {
    streamSid: string;
    customParameters: Record<string, string>;
  };
  media?: { payload: string };
}

interface MinWS {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  addEventListener(
    event: string,
    handler: (ev: { data?: unknown; code?: number }) => void
  ): void;
}

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const OPENAI_MODEL = "gpt-4o-realtime-preview";

export async function handleTwilioStream(twilioWs: MinWS, sessionId: string): Promise<void> {
  const session = sessionManager.get(sessionId);
  if (!session) { twilioWs.close(4000, "Session not found"); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { twilioWs.close(4001, "OpenAI API key not configured"); return; }

  const [agent, org] = await Promise.all([
    queryOne<Record<string, unknown>>(
      `SELECT name, persona, system_prompt, voice FROM voice_agents WHERE id = $1 AND organization_id = $2`,
      [session.agent_id, session.org_id]
    ),
    queryOne<{ name: string }>("SELECT name FROM organizations WHERE id = $1", [session.org_id]),
  ]);

  const instructions = await buildSystemPrompt({
    agentName: (agent?.name as string) ?? "Insurance Agent",
    agentPersona: (agent?.persona as string) ?? "Professional insurance agent",
    agentSystemPrompt: (agent?.system_prompt as string) ?? undefined,
    callType: (session.direction === "inbound" ? "inbound_support" : "outbound_sales") as CallType,
    orgId: session.org_id,
    orgName: org?.name,
    leadId: session.lead_id,
  });

  let streamSid: string | null = null;
  let closed = false;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS = (typeof WebSocket !== "undefined" ? WebSocket : require("ws").WebSocket) as typeof WebSocket;
  let openaiWs: MinWS | null = null;

  try {
    openaiWs = new WS(
      `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(OPENAI_MODEL)}`,
      ["realtime", `openai-insecure-api-key.${apiKey}`, "openai-beta.realtime-v1"]
    ) as unknown as MinWS;
  } catch {
    twilioWs.close(4002, "Failed to connect to OpenAI");
    return;
  }

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (openaiWs && openaiWs.readyState <= 1) openaiWs.close(1000, "Stream ended");
    if (twilioWs.readyState <= 1) twilioWs.close(1000, "Stream ended");
    sessionManager.end(sessionId);
    await processCallEnd(sessionId).catch(() => {});
  };

  openaiWs.addEventListener("open", () => {
    sessionManager.activate(sessionId);
    openaiWs!.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions,
        voice: session.voice ?? "alloy",
        tools: INSURANCE_TOOL_DEFINITIONS,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", silence_duration_ms: 500, threshold: 0.5 },
        temperature: 0.7,
      },
    }));
  });

  openaiWs.addEventListener("message", (ev: { data?: unknown }) => {
    if (closed) return;
    try {
      const event = JSON.parse(String(ev.data)) as Record<string, unknown>;
      switch (event.type as string) {
        case "response.audio.delta":
          if (streamSid && twilioWs.readyState === 1)
            twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload: event.delta } }));
          break;
        case "response.audio_transcript.done":
          sessionManager.appendTranscript(sessionId, "assistant", String(event.transcript ?? ""));
          break;
        case "input_audio_buffer.transcription.completed":
          sessionManager.appendTranscript(sessionId, "user", String(event.transcript ?? ""));
          break;
        case "response.function_call_arguments.done": {
          const fnName = event.name as string;
          const fnArgs = event.arguments as string;
          const fnCallId = event.call_id as string;
          executeInsuranceTool(fnName, fnArgs, session.org_id).then((result) => {
            if (openaiWs && openaiWs.readyState === 1) {
              openaiWs.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: fnCallId, output: result } }));
              openaiWs.send(JSON.stringify({ type: "response.create" }));
            }
          }).catch(() => {});
          break;
        }
      }
    } catch { /* ignore unparseable frames */ }
  });

  openaiWs.addEventListener("close", () => { cleanup(); });
  openaiWs.addEventListener("error", () => { cleanup(); });

  twilioWs.addEventListener("message", (ev: { data?: unknown }) => {
    if (closed) return;
    try {
      const msg = JSON.parse(String(ev.data)) as TwilioMediaEvent;
      switch (msg.event) {
        case "start": streamSid = msg.start?.streamSid ?? msg.streamSid ?? null; break;
        case "media":
          if (msg.media?.payload && openaiWs && openaiWs.readyState === 1)
            openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: msg.media.payload }));
          break;
        case "stop": cleanup(); break;
      }
    } catch { /* ignore unparseable frames */ }
  });

  twilioWs.addEventListener("close", () => { cleanup(); });
}
