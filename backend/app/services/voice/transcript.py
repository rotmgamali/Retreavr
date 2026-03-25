"""Real-time transcript capture for OpenAI Realtime API voice sessions.

Collects audio_transcript.delta events, assembles speaker-labelled turns,
and persists the completed transcript to the database on call completion.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


@dataclass
class TranscriptTurn:
    """A single speaker turn in the conversation."""

    speaker: str          # "agent" or "user"
    text: str = ""
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "speaker": self.speaker,
            "text": self.text,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class TranscriptCapture:
    """Captures and assembles a full conversation transcript.

    Intended usage:
    - ``on_transcript_delta`` is registered as a handler for
      ``response.audio_transcript.delta`` events.
    - ``on_response_done`` is registered for ``response.done`` to finalise the
      current agent turn.
    - ``on_speech_started`` is registered for
      ``input_audio_buffer.speech_started`` to start a user turn.
    - ``save_to_db`` is called when the call ends.
    """

    def __init__(self, call_sid: str) -> None:
        self.call_sid = call_sid
        self._turns: list[TranscriptTurn] = []
        self._current_agent_turn: TranscriptTurn | None = None
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Event handlers (async-compatible for client.on() registration)
    # ------------------------------------------------------------------

    async def on_transcript_delta(self, event: dict[str, Any]) -> None:
        """Append a transcript delta to the current agent turn."""
        delta: str = event.get("delta", "")
        if not delta:
            return
        async with self._lock:
            if self._current_agent_turn is None:
                self._current_agent_turn = TranscriptTurn(speaker="agent")
            self._current_agent_turn.text += delta

    async def on_response_done(self, event: dict[str, Any]) -> None:
        """Finalise the current agent turn when the model response is complete."""
        async with self._lock:
            if self._current_agent_turn and self._current_agent_turn.text:
                self._current_agent_turn.ended_at = datetime.now(timezone.utc)
                self._turns.append(self._current_agent_turn)
                logger.debug(
                    "Agent turn recorded (call_sid=%s, len=%d)",
                    self.call_sid,
                    len(self._current_agent_turn.text),
                )
                self._current_agent_turn = None

    async def on_speech_started(self, event: dict[str, Any]) -> None:
        """Record a user speech turn start (transcript filled from ASR output)."""
        async with self._lock:
            # Finalise any in-progress agent turn first
            if self._current_agent_turn and self._current_agent_turn.text:
                self._current_agent_turn.ended_at = datetime.now(timezone.utc)
                self._turns.append(self._current_agent_turn)
                self._current_agent_turn = None
            # Start a new user turn (text will be filled by Whisper ASR in response.done)
            self._turns.append(TranscriptTurn(speaker="user"))

    # ------------------------------------------------------------------
    # Read access
    # ------------------------------------------------------------------

    @property
    def turns(self) -> list[TranscriptTurn]:
        return list(self._turns)

    def as_text(self) -> str:
        """Return the full transcript as plain text with speaker labels."""
        lines: list[str] = []
        for turn in self._turns:
            if turn.text:
                label = "Agent" if turn.speaker == "agent" else "Customer"
                lines.append(f"{label}: {turn.text.strip()}")
        return "\n".join(lines)

    def as_dict_list(self) -> list[dict[str, Any]]:
        return [t.to_dict() for t in self._turns if t.text]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def save_to_db(self, db: Any, call_id: UUID) -> None:
        """Upsert a CallTranscript record for the completed call.

        Parameters
        ----------
        db:
            An async SQLAlchemy session (``AsyncSession``).
        call_id:
            Primary key of the Call row to attach the transcript to.
        """
        from sqlalchemy import select

        from app.models.calls import CallTranscript

        text = self.as_text()
        if not text:
            logger.info("No transcript to save (call_sid=%s)", self.call_sid)
            return

        try:
            result = await db.execute(
                select(CallTranscript).where(CallTranscript.call_id == call_id)
            )
            existing: CallTranscript | None = result.scalar_one_or_none()

            if existing:
                existing.transcript = text
            else:
                db.add(CallTranscript(call_id=call_id, transcript=text))

            await db.commit()
            logger.info(
                "Transcript saved (call_sid=%s, call_id=%s, chars=%d)",
                self.call_sid,
                call_id,
                len(text),
            )
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to save transcript (call_sid=%s, call_id=%s)", self.call_sid, call_id
            )
            raise
