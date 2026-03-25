"""Voice Session Manager — manages OpenAI Realtime API sessions per call."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.services.voice.realtime_client import RealtimeClient, SessionConfig, VADConfig
from app.services.voice.tools import ToolExecutor, build_tool_definitions
from app.services.voice.transcript import TranscriptCapture

logger = logging.getLogger(__name__)


@dataclass
class VoiceSession:
    """Represents one active voice call session."""

    call_sid: str  # Twilio call SID
    call_db_id: UUID | None
    client: RealtimeClient
    transcript: TranscriptCapture
    tool_executor: ToolExecutor
    created_at: float = field(default_factory=lambda: asyncio.get_event_loop().time())


class VoiceSessionManager:
    """Central registry for active voice sessions.

    Responsibilities:
    - Create/configure a RealtimeClient per incoming call
    - Wire up transcript capture and function calling
    - Clean up on disconnect
    - Provide lookup by call_sid

    Usage::

        manager = VoiceSessionManager()

        # On Twilio call start
        session = await manager.create_session(
            call_sid="CA...",
            call_db_id=uuid,
            agent_config={
                "voice": "nova",
                "system_prompt": "You are an insurance agent...",
                "vad": {"threshold": 0.5},
            },
        )

        # Stream audio from Twilio into the session
        await session.client.append_audio(ulaw_bytes)

        # On Twilio call end
        await manager.close_session(call_sid="CA...", db_session=db)
    """

    def __init__(self) -> None:
        self._sessions: dict[str, VoiceSession] = {}
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        call_sid: str,
        call_db_id: UUID | None = None,
        agent_config: dict[str, Any] | None = None,
    ) -> VoiceSession:
        """Initialise and connect an OpenAI Realtime session for a call."""
        async with self._lock:
            if call_sid in self._sessions:
                logger.warning("Session already exists for %s — returning existing", call_sid)
                return self._sessions[call_sid]

            cfg = agent_config or {}
            vad_cfg_data = cfg.get("vad") or {}
            vad = VADConfig(
                threshold=float(vad_cfg_data.get("threshold", 0.5)),
                prefix_padding_ms=int(vad_cfg_data.get("prefix_padding_ms", 300)),
                silence_duration_ms=int(vad_cfg_data.get("silence_duration_ms", 500)),
            )
            tool_defs = build_tool_definitions()
            session_config = SessionConfig(
                voice=cfg.get("voice", "alloy"),
                system_prompt=cfg.get("system_prompt", ""),
                vad=vad,
                tools=tool_defs,
            )

            client = RealtimeClient(session_id=call_sid, config=session_config)
            transcript = TranscriptCapture(call_sid=call_sid)
            tool_executor = ToolExecutor(call_sid=call_sid)

            # Wire up event handlers
            self._wire_handlers(client, transcript, tool_executor)

            # Connect to OpenAI
            await client.connect()

            # Apply session configuration
            await client.configure_session()

            session = VoiceSession(
                call_sid=call_sid,
                call_db_id=call_db_id,
                client=client,
                transcript=transcript,
                tool_executor=tool_executor,
            )
            self._sessions[call_sid] = session
            logger.info("Voice session created (call_sid=%s)", call_sid)
            return session

    async def close_session(self, call_sid: str, db_session: Any | None = None) -> None:
        """Tear down the session, persist transcript, and release resources."""
        async with self._lock:
            session = self._sessions.pop(call_sid, None)

        if not session:
            logger.warning("No session found for %s", call_sid)
            return

        await session.client.close()

        if db_session and session.call_db_id:
            await session.transcript.save_to_db(
                db=db_session,
                call_id=session.call_db_id,
            )

            # Fire post-call processing (extraction + lead scoring) as a background task
            transcript_text = session.transcript.as_text()
            if transcript_text:
                asyncio.create_task(
                    self._run_post_call_processing(
                        call_db_id=session.call_db_id,
                        transcript_text=transcript_text,
                    )
                )

        logger.info("Voice session closed (call_sid=%s)", call_sid)

    @staticmethod
    async def _run_post_call_processing(call_db_id: Any, transcript_text: str) -> None:
        """Run extraction and lead scoring in a background task with its own DB session."""
        from app.core.database import async_session
        from app.services.post_call_processor import run_post_call_processing

        try:
            async with async_session() as db:
                await run_post_call_processing(
                    call_db_id=call_db_id,
                    transcript_text=transcript_text,
                    db=db,
                )
                await db.commit()
        except Exception:
            logger.exception("Post-call processing failed for call %s", call_db_id)

    def get_session(self, call_sid: str) -> VoiceSession | None:
        return self._sessions.get(call_sid)

    @property
    def active_count(self) -> int:
        return len(self._sessions)

    # ------------------------------------------------------------------
    # Internal wiring
    # ------------------------------------------------------------------

    def _wire_handlers(
        self,
        client: RealtimeClient,
        transcript: TranscriptCapture,
        tool_executor: ToolExecutor,
    ) -> None:
        """Attach event handlers for transcript and function calling."""
        from app.services.voice.realtime_client import RealtimeEventType

        # Transcript capture
        client.on(RealtimeEventType.RESPONSE_AUDIO_TRANSCRIPT_DELTA, transcript.on_transcript_delta)
        client.on(RealtimeEventType.RESPONSE_DONE, transcript.on_response_done)
        client.on(RealtimeEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED, transcript.on_speech_started)

        # Function calling
        async def handle_function_call(event: dict[str, Any]) -> None:
            call_id: str = event.get("call_id", "")
            name: str = event.get("name", "")
            arguments_str: str = event.get("arguments", "{}")
            result = await tool_executor.execute(name=name, arguments_str=arguments_str)
            await client.send_function_result(call_id=call_id, result=result)

        client.on(RealtimeEventType.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE, handle_function_call)

        # Error logging
        async def handle_error(event: dict[str, Any]) -> None:
            logger.error(
                "Realtime API error (call_sid=%s): %s",
                client.session_id,
                event.get("error", {}),
            )

        client.on(RealtimeEventType.ERROR, handle_error)


# Module-level singleton used by FastAPI route handlers
voice_session_manager = VoiceSessionManager()
