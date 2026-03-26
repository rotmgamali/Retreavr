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
