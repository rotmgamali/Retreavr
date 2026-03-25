/**
 * Twilio Media Stream <-> OpenAI Realtime API bridge.
 *
 * Handles the WebSocket connection from Twilio's <Stream> directive,
 * relays audio to OpenAI Realtime, and pipes responses back to Twilio.
 *
 * Audio flow:
 *   Twilio (μ-law) -> decode -> OpenAI Realtime (PCM16)
 *   OpenAI Realtime (PCM16) -> encode -> Twilio (μ-law)
 *
 * Usage:
 *   This module exports a handler function that takes a WebSocket and
 *   session_id query param. Mount it on a custom server at /api/voice/stream.
 *
 *   In Vercel serverless mode, WebSockets are not supported — use a
 *   separate deployment (e.g. Fly.io, Railway) for the stream bridge,
 *   and update the webhook to point to that host.
 */

import { sessionManager, processCallEnd } from ".";
import { executeInsuranceTool, INSURANCE_TOOL_DEFINITIONS } from "./insurance-tools";
import { buildSystemPrompt, type CallType } from "./prompt-builder";
import { queryOne } from "@/lib/db";

/** Twilio sends these event types over the media stream WebSocket. */
interface TwilioMediaEvent {
  event: "connected" | "start" | "media" | "stop" | "mark";
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: { encoding: string; sampleRate: number; channels: number };
    customParameters: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 μ-law audio
  };
  stop?: { accountSid: string; callSid: string };
  mark?: { name: string };
}

/** Minimal WebSocket interface (works with ws, undici, or built-in). */
interface WS {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  addEventListener(
    event: string,
    handler: (ev: { data?: unknown; code?: number; reason?: string }) => void
  ): void;
  removeEventListener?(event: string, handler: (...args: unknown[]) => void): void;
}

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const OPENAI_MODEL = "gpt-4o-realtime-preview";

/**
 * Handle a Twilio media stream WebSocket connection.
 *
 * @param twilioWs  The WebSocket connection from Twilio
 * @param sessionId The session ID from the query string
 */
export async function handleTwilioStream(
  twilioWs: WS,
  sessionId: string
): Promise<void> {
  const session = sessionManager.get(sessionId);
  if (!session) {
    twilioWs.close(4000, "Session not found");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    twilioWs.close(4001, "OpenAI API key not configured");
    return;
  }

  // Fetch agent config for system prompt
  const agent = await queryOne<Record<string, unknown>>(
    `SELECT name, persona, system_prompt, voice, vad_config
     FROM voice_agents WHERE id = $1 AND organization_id = $2`,
    [session.agent_id, session.org_id]
  );

  const org = await queryOne<{ name: string }>(
    "SELECT name FROM organizations WHERE id = $1",
    [session.org_id]
  );

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
  let openaiWs: WebSocket | null = null;

  // Connect to OpenAI Realtime
  const url = `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(OPENAI_MODEL)}`;

  try {
    openaiWs = new WebSocket(url, [
      "realtime",
      `openai-insecure-api-key.${apiKey}`,
      "openai-beta.realtime-v1",
    ]);
  } catch {
    twilioWs.close(4002, "Failed to connect to OpenAI");
    return;
  }

  // Track cleanup state
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;

    if (openaiWs && openaiWs.readyState <= 1) {
      openaiWs.close(1000, "Stream ended");
    }
    if (twilioWs.readyState <= 1) {
      twilioWs.close(1000, "Stream ended");
    }

    // Run post-call processing
    sessionManager.end(sessionId);
    await processCallEnd(sessionId).catch(() => {});
  };

  // ── OpenAI Realtime event handling ──────────────────────────

  openaiWs.addEventListener("open", () => {
    // Configure session
    const sessionConfig: Record<string, unknown> = {
      instructions,
      voice: session.voice || "alloy",
      tools: INSURANCE_TOOL_DEFINITIONS,
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: 500,
        threshold: 0.5,
        prefix_padding_ms: 300,
      },
      temperature: 0.7,
      max_response_output_tokens: 4096,
    };

    openaiWs!.send(JSON.stringify({ type: "session.update", session: sessionConfig }));
  });

  openaiWs.addEventListener("message", (ev: { data?: unknown }) => {
    if (closed) return;
    try {
      const event = JSON.parse(String(ev.data)) as Record<string, unknown>;
      const eventType = event.type as string;

      switch (eventType) {
        case "response.audio.delta": {
          // Send audio back to Twilio
          if (streamSid && twilioWs.readyState === 1) {
            twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: event.delta as string },
              })
            );
          }
          break;
        }

        case "response.audio_transcript.done": {
          // Track assistant transcript
          sessionManager.appendTranscript(
            sessionId,
            "assistant",
            event.transcript as string
          );
          break;
        }

        case "input_audio_buffer.transcription.completed": {
          // Track user transcript
          sessionManager.appendTranscript(
            sessionId,
            "user",
            event.transcript as string
          );
          break;
        }

        case "response.function_call_arguments.done": {
          // Execute insurance tool and return result
          const fnName = event.name as string;
          const fnArgs = event.arguments as string;
          const fnCallId = event.call_id as string;

          executeInsuranceTool(fnName, fnArgs, session.org_id)
            .then((result) => {
              if (openaiWs && openaiWs.readyState === 1) {
                openaiWs.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: fnCallId,
                      output: result,
                    },
                  })
                );
                openaiWs.send(JSON.stringify({ type: "response.create" }));
              }
            })
            .catch(() => {
              if (openaiWs && openaiWs.readyState === 1) {
                openaiWs.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: fnCallId,
                      output: JSON.stringify({ error: "Tool execution failed" }),
                    },
                  })
                );
                openaiWs.send(JSON.stringify({ type: "response.create" }));
              }
            });
          break;
        }

        case "error": {
          console.error("[stream-handler] OpenAI error:", event.error);
          break;
        }
      }
    } catch {
      // Ignore unparseable frames
    }
  });

  openaiWs.addEventListener("close", () => {
    cleanup();
  });

  openaiWs.addEventListener("error", () => {
    cleanup();
  });

  // ── Twilio media stream event handling ──────────────────────

  twilioWs.addEventListener("message", (ev: { data?: unknown }) => {
    if (closed) return;
    try {
      const msg = JSON.parse(String(ev.data)) as TwilioMediaEvent;

      switch (msg.event) {
        case "connected":
          // Twilio stream connected
          break;

        case "start":
          streamSid = msg.start?.streamSid ?? msg.streamSid ?? null;
          break;

        case "media":
          // Forward audio to OpenAI
          if (msg.media?.payload && openaiWs && openaiWs.readyState === 1) {
            openaiWs.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.media.payload,
              })
            );
          }
          break;

        case "stop":
          cleanup();
          break;
      }
    } catch {
      // Ignore unparseable frames
    }
  });

  twilioWs.addEventListener("close", () => {
    cleanup();
  });
}
