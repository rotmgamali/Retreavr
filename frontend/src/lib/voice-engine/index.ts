/**
 * Voice Engine — barrel export.
 */

export { RealtimeClient } from "./realtime-client";
export type {
  RealtimeVoice,
  VADConfig,
  RealtimeToolDefinition,
  RealtimeSessionConfig,
  RealtimeEvent,
  RealtimeClientCallbacks,
} from "./realtime-client";

export { sessionManager } from "./session-manager";
export type {
  VoiceSession,
  SessionStatus,
  TranscriptLine,
} from "./session-manager";

export {
  INSURANCE_TOOL_DEFINITIONS,
  executeInsuranceTool,
} from "./insurance-tools";

export { buildSystemPrompt } from "./prompt-builder";
export type { CallType, PromptContext } from "./prompt-builder";

export { processCallEnd } from "./call-processor";

export { handleTwilioStream } from "./stream-handler";
