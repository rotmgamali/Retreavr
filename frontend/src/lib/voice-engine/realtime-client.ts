/**
 * OpenAI Realtime API WebSocket client for voice conversations.
 *
 * Connects to wss://api.openai.com/v1/realtime and manages the full
 * lifecycle of a voice session: audio streaming, VAD, tool calls,
 * and response playback.
 */

export type RealtimeVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

export interface VADConfig {
  /** "server_vad" lets OpenAI detect speech boundaries. */
  type: "server_vad";
  /** Silence duration (ms) before end-of-turn. Default 500. */
  silence_duration_ms?: number;
  /** Audio level threshold (0-1). Default 0.5. */
  threshold?: number;
  /** Minimum speech duration (ms) to count as speech. Default 200. */
  prefix_padding_ms?: number;
}

export interface RealtimeToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RealtimeSessionConfig {
  model?: string;
  voice?: RealtimeVoice;
  instructions?: string;
  tools?: RealtimeToolDefinition[];
  input_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  output_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  input_audio_transcription?: { model: string };
  turn_detection?: VADConfig | null;
  temperature?: number;
  max_response_output_tokens?: number | "inf";
}

export type RealtimeEvent =
  | { type: "session.created"; session: Record<string, unknown> }
  | { type: "session.updated"; session: Record<string, unknown> }
  | { type: "input_audio_buffer.speech_started" }
  | { type: "input_audio_buffer.speech_stopped" }
  | { type: "input_audio_buffer.committed" }
  | { type: "conversation.item.created"; item: Record<string, unknown> }
  | {
      type: "response.audio.delta";
      delta: string;
      response_id: string;
      item_id: string;
    }
  | { type: "response.audio.done"; response_id: string; item_id: string }
  | {
      type: "response.audio_transcript.delta";
      delta: string;
      response_id: string;
      item_id: string;
    }
  | {
      type: "response.audio_transcript.done";
      transcript: string;
      response_id: string;
      item_id: string;
    }
  | {
      type: "response.function_call_arguments.delta";
      delta: string;
      call_id: string;
      name: string;
    }
  | {
      type: "response.function_call_arguments.done";
      arguments: string;
      call_id: string;
      name: string;
    }
  | { type: "response.done"; response: Record<string, unknown> }
  | {
      type: "input_audio_buffer.transcription.completed";
      transcript: string;
    }
  | { type: "error"; error: { message: string; type: string; code?: string } }
  | { type: string; [key: string]: unknown };

export interface RealtimeClientCallbacks {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: RealtimeEvent) => void;
  onAudioDelta?: (base64Audio: string) => void;
  onTranscriptDelta?: (delta: string, role: "assistant") => void;
  onTranscriptDone?: (transcript: string, role: "assistant") => void;
  onInputTranscript?: (transcript: string) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onFunctionCall?: (
    name: string,
    args: string,
    callId: string
  ) => Promise<string>;
  onResponseDone?: (response: Record<string, unknown>) => void;
}

const REALTIME_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_MODEL = "gpt-4o-realtime-preview";

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private config: RealtimeSessionConfig;
  private callbacks: RealtimeClientCallbacks;
  private _connected = false;
  private _sessionId: string | null = null;
  private autoEndTimer: ReturnType<typeof setTimeout> | null = null;
  private maxDurationMs: number;

  constructor(opts: {
    apiKey: string;
    config: RealtimeSessionConfig;
    callbacks: RealtimeClientCallbacks;
    /** Max call duration in minutes. Default 20. */
    maxDurationMinutes?: number;
  }) {
    this.apiKey = opts.apiKey;
    this.config = {
      model: DEFAULT_MODEL,
      voice: "alloy",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: 500,
        threshold: 0.5,
        prefix_padding_ms: 300,
      },
      temperature: 0.7,
      max_response_output_tokens: 4096,
      ...opts.config,
    };
    this.callbacks = opts.callbacks;
    this.maxDurationMs = (opts.maxDurationMinutes ?? 20) * 60 * 1000;
  }

  get connected(): boolean {
    return this._connected;
  }
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** Open the WebSocket and configure the session. */
  connect(): void {
    const model = this.config.model ?? DEFAULT_MODEL;
    const url = `${REALTIME_URL}?model=${encodeURIComponent(model)}`;

    this.ws = new WebSocket(url, [
      "realtime",
      `openai-insecure-api-key.${this.apiKey}`,
      "openai-beta.realtime-v1",
    ]);

    this.ws.onopen = () => {
      this._connected = true;
      this.callbacks.onOpen?.();
      this.updateSession();
      // Auto-end after max duration
      this.autoEndTimer = setTimeout(() => this.disconnect(), this.maxDurationMs);
    };

    this.ws.onclose = (e) => {
      this._connected = false;
      this.clearAutoEnd();
      this.callbacks.onClose?.(e.code, e.reason);
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.(new Error("WebSocket error"));
    };

    this.ws.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(
          typeof e.data === "string" ? e.data : ""
        );
        this.handleEvent(event);
      } catch {
        // ignore unparseable frames
      }
    };
  }

  /** Gracefully close the connection. */
  disconnect(): void {
    this.clearAutoEnd();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this._connected = false;
  }

  /** Send raw event to the server. */
  send(event: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(event));
  }

  /** Push a chunk of PCM16 audio (base64-encoded) into the input buffer. */
  appendAudio(base64Audio: string): void {
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Audio,
    });
  }

  /** Manually commit the current audio buffer (useful if VAD is off). */
  commitAudio(): void {
    this.send({ type: "input_audio_buffer.commit" });
  }

  /** Clear pending input audio. */
  clearAudio(): void {
    this.send({ type: "input_audio_buffer.clear" });
  }

  /** Interrupt in-progress response (barge-in). */
  cancelResponse(): void {
    this.send({ type: "response.cancel" });
  }

  /** Send a text message as user input. */
  sendText(text: string): void {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    this.send({ type: "response.create" });
  }

  /** Submit function call result back to the model. */
  submitFunctionResult(callId: string, result: string): void {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: result,
      },
    });
    this.send({ type: "response.create" });
  }

  /** Update the session configuration on the fly. */
  updateSession(overrides?: Partial<RealtimeSessionConfig>): void {
    const session: Record<string, unknown> = {};
    const merged = { ...this.config, ...overrides };

    if (merged.instructions) session.instructions = merged.instructions;
    if (merged.voice) session.voice = merged.voice;
    if (merged.tools) session.tools = merged.tools;
    if (merged.input_audio_format)
      session.input_audio_format = merged.input_audio_format;
    if (merged.output_audio_format)
      session.output_audio_format = merged.output_audio_format;
    if (merged.input_audio_transcription)
      session.input_audio_transcription = merged.input_audio_transcription;
    if (merged.turn_detection !== undefined)
      session.turn_detection = merged.turn_detection;
    if (merged.temperature !== undefined)
      session.temperature = merged.temperature;
    if (merged.max_response_output_tokens !== undefined)
      session.max_response_output_tokens = merged.max_response_output_tokens;

    this.send({ type: "session.update", session });
    if (overrides) Object.assign(this.config, overrides);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private clearAutoEnd(): void {
    if (this.autoEndTimer) {
      clearTimeout(this.autoEndTimer);
      this.autoEndTimer = null;
    }
  }

  private async handleEvent(event: RealtimeEvent): Promise<void> {
    this.callbacks.onEvent?.(event);

    const e = event as Record<string, unknown>;

    switch (event.type) {
      case "session.created": {
        const session = e.session as Record<string, unknown> | undefined;
        this._sessionId = (session?.id as string) ?? null;
        break;
      }

      case "input_audio_buffer.speech_started":
        this.callbacks.onSpeechStarted?.();
        break;

      case "input_audio_buffer.speech_stopped":
        this.callbacks.onSpeechStopped?.();
        break;

      case "response.audio.delta":
        this.callbacks.onAudioDelta?.(e.delta as string);
        break;

      case "response.audio_transcript.delta":
        this.callbacks.onTranscriptDelta?.(e.delta as string, "assistant");
        break;

      case "response.audio_transcript.done":
        this.callbacks.onTranscriptDone?.(e.transcript as string, "assistant");
        break;

      case "input_audio_buffer.transcription.completed":
        this.callbacks.onInputTranscript?.(e.transcript as string);
        break;

      case "response.function_call_arguments.done":
        if (this.callbacks.onFunctionCall) {
          const fnName = e.name as string;
          const fnArgs = e.arguments as string;
          const fnCallId = e.call_id as string;
          try {
            const result = await this.callbacks.onFunctionCall(
              fnName,
              fnArgs,
              fnCallId
            );
            this.submitFunctionResult(fnCallId, result);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Function call failed";
            this.submitFunctionResult(
              fnCallId,
              JSON.stringify({ error: msg })
            );
          }
        }
        break;

      case "response.done":
        this.callbacks.onResponseDone?.(
          e.response as Record<string, unknown>
        );
        break;

      case "error":
        this.callbacks.onError?.(
          new Error(
            ((e.error as Record<string, unknown>)?.message as string) ??
              "Unknown error"
          )
        );
        break;
    }
  }
}
