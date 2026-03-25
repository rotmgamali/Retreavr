"""OpenAI Realtime API WebSocket client for voice conversations."""

from __future__ import annotations

import asyncio
import audioop
import base64
import json
import logging
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import websockets
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from websockets.exceptions import ConnectionClosed, WebSocketException

from app.core.config import get_settings

logger = logging.getLogger(__name__)

REALTIME_API_URL = "wss://api.openai.com/v1/realtime"
REALTIME_MODEL = "gpt-4o-realtime-preview-2024-10-01"

# Audio constants
TWILIO_SAMPLE_RATE = 8000   # μ-law 8kHz from Twilio
OPENAI_SAMPLE_RATE = 24000  # PCM 16-bit 24kHz for OpenAI
AUDIO_CHANNELS = 1


class RealtimeEventType(str, Enum):
    # Server → client
    SESSION_CREATED = "session.created"
    SESSION_UPDATED = "session.updated"
    RESPONSE_AUDIO_DELTA = "response.audio.delta"
    RESPONSE_AUDIO_TRANSCRIPT_DELTA = "response.audio_transcript.delta"
    RESPONSE_DONE = "response.done"
    INPUT_AUDIO_BUFFER_SPEECH_STARTED = "input_audio_buffer.speech_started"
    INPUT_AUDIO_BUFFER_SPEECH_STOPPED = "input_audio_buffer.speech_stopped"
    RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE = "response.function_call_arguments.done"
    ERROR = "error"
    # Client → server
    SESSION_UPDATE = "session.update"
    INPUT_AUDIO_BUFFER_APPEND = "input_audio_buffer.append"
    INPUT_AUDIO_BUFFER_COMMIT = "input_audio_buffer.commit"
    RESPONSE_CREATE = "response.create"
    CONVERSATION_ITEM_CREATE = "conversation.item.create"


@dataclass
class VADConfig:
    type: str = "server_vad"
    threshold: float = 0.5
    prefix_padding_ms: int = 300
    silence_duration_ms: int = 500


@dataclass
class SessionConfig:
    voice: str = "alloy"
    system_prompt: str = ""
    vad: VADConfig = field(default_factory=VADConfig)
    tools: list[dict[str, Any]] = field(default_factory=list)
    temperature: float = 0.8
    max_response_output_tokens: int | str = "inf"


EventHandler = Callable[[dict[str, Any]], None]


def ulaw_to_pcm24k(ulaw_bytes: bytes) -> bytes:
    """Convert Twilio μ-law 8kHz audio to PCM 16-bit 24kHz for OpenAI."""
    # μ-law → linear PCM 16-bit at 8kHz
    pcm_8k = audioop.ulaw2lin(ulaw_bytes, 2)
    # Resample 8kHz → 24kHz (3x upsample)
    pcm_24k, _ = audioop.ratecv(pcm_8k, 2, AUDIO_CHANNELS, TWILIO_SAMPLE_RATE, OPENAI_SAMPLE_RATE, None)
    return pcm_24k


def pcm24k_to_ulaw(pcm_bytes: bytes) -> bytes:
    """Convert OpenAI PCM 16-bit 24kHz audio to Twilio μ-law 8kHz."""
    # Resample 24kHz → 8kHz
    pcm_8k, _ = audioop.ratecv(pcm_bytes, 2, AUDIO_CHANNELS, OPENAI_SAMPLE_RATE, TWILIO_SAMPLE_RATE, None)
    # Linear PCM → μ-law
    return audioop.lin2ulaw(pcm_8k, 2)


class RealtimeClient:
    """WebSocket client for the OpenAI Realtime API.

    Manages a single bidirectional audio session. Audio flows:
        Twilio (μ-law 8kHz) → ulaw_to_pcm24k → OpenAI (PCM 16-bit 24kHz)
        OpenAI (PCM 16-bit 24kHz) → pcm24k_to_ulaw → Twilio (μ-law 8kHz)
    """

    def __init__(self, session_id: str, config: SessionConfig) -> None:
        self.session_id = session_id
        self.config = config
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._event_handlers: dict[str, list[EventHandler]] = {}
        self._connected = asyncio.Event()
        self._closed = False
        self._send_lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    @retry(
        retry=retry_if_exception_type((WebSocketException, ConnectionError, OSError)),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    async def connect(self) -> None:
        """Open the WebSocket connection and start the receive loop."""
        settings = get_settings()
        url = f"{REALTIME_API_URL}?model={REALTIME_MODEL}"
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "OpenAI-Beta": "realtime=v1",
        }
        logger.info("Connecting to OpenAI Realtime API (session=%s)", self.session_id)
        self._ws = await websockets.connect(url, additional_headers=headers)
        self._closed = False
        self._connected.set()
        asyncio.create_task(self._receive_loop())

    async def close(self) -> None:
        """Close the WebSocket connection gracefully."""
        self._closed = True
        self._connected.clear()
        if self._ws and not self._ws.closed:
            await self._ws.close()
            logger.info("Realtime session closed (session=%s)", self.session_id)

    # ------------------------------------------------------------------
    # Sending events
    # ------------------------------------------------------------------

    async def _send(self, event: dict[str, Any]) -> None:
        if not self._ws or self._ws.closed:
            raise ConnectionError("WebSocket not connected")
        async with self._send_lock:
            await self._ws.send(json.dumps(event))

    async def configure_session(self) -> None:
        """Send session.update with voice, VAD, system prompt, and tools."""
        vad = self.config.vad
        await self._send({
            "type": RealtimeEventType.SESSION_UPDATE,
            "session": {
                "modalities": ["text", "audio"],
                "instructions": self.config.system_prompt,
                "voice": self.config.voice,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": {
                    "type": vad.type,
                    "threshold": vad.threshold,
                    "prefix_padding_ms": vad.prefix_padding_ms,
                    "silence_duration_ms": vad.silence_duration_ms,
                },
                "tools": self.config.tools,
                "tool_choice": "auto",
                "temperature": self.config.temperature,
                "max_response_output_tokens": self.config.max_response_output_tokens,
            },
        })

    async def append_audio(self, ulaw_bytes: bytes) -> None:
        """Accept raw μ-law 8kHz bytes from Twilio and forward to OpenAI."""
        pcm_bytes = ulaw_to_pcm24k(ulaw_bytes)
        encoded = base64.b64encode(pcm_bytes).decode("utf-8")
        await self._send({
            "type": RealtimeEventType.INPUT_AUDIO_BUFFER_APPEND,
            "audio": encoded,
        })

    async def commit_audio(self) -> None:
        """Commit the audio buffer (manual VAD mode)."""
        await self._send({"type": RealtimeEventType.INPUT_AUDIO_BUFFER_COMMIT})

    async def request_response(self) -> None:
        """Trigger a model response (manual turn mode)."""
        await self._send({"type": RealtimeEventType.RESPONSE_CREATE})

    async def send_function_result(self, call_id: str, result: str) -> None:
        """Send a tool/function call result back to the model."""
        await self._send({
            "type": RealtimeEventType.CONVERSATION_ITEM_CREATE,
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": result,
            },
        })
        await self.request_response()

    # ------------------------------------------------------------------
    # Receiving events
    # ------------------------------------------------------------------

    async def _receive_loop(self) -> None:
        """Continuously read from the WebSocket and dispatch events."""
        try:
            async for raw in self._ws:
                if self._closed:
                    break
                try:
                    event = json.loads(raw)
                    await self._dispatch(event)
                except json.JSONDecodeError:
                    logger.warning("Received non-JSON from Realtime API (session=%s)", self.session_id)
        except ConnectionClosed as exc:
            logger.info("Realtime WebSocket closed (session=%s, code=%s)", self.session_id, exc.code)
        except Exception:
            logger.exception("Unexpected error in Realtime receive loop (session=%s)", self.session_id)
        finally:
            self._connected.clear()

    async def _dispatch(self, event: dict[str, Any]) -> None:
        event_type = event.get("type", "")
        handlers = self._event_handlers.get(event_type, []) + self._event_handlers.get("*", [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception:
                logger.exception(
                    "Error in event handler for %s (session=%s)", event_type, self.session_id
                )

    # ------------------------------------------------------------------
    # Event handler registration
    # ------------------------------------------------------------------

    def on(self, event_type: str, handler: EventHandler) -> None:
        """Register a handler for a specific event type (or '*' for all)."""
        self._event_handlers.setdefault(event_type, []).append(handler)

    def off(self, event_type: str, handler: EventHandler) -> None:
        handlers = self._event_handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def audio_chunks(self) -> AsyncGenerator[bytes, None]:
        """Yield PCM 24kHz audio chunks decoded from response.audio.delta events."""
        queue: asyncio.Queue[bytes | None] = asyncio.Queue()

        async def _on_audio(event: dict[str, Any]) -> None:
            delta = event.get("delta", "")
            if delta:
                queue.put_nowait(base64.b64decode(delta))

        async def _on_done(_: dict[str, Any]) -> None:
            queue.put_nowait(None)

        self.on(RealtimeEventType.RESPONSE_AUDIO_DELTA, _on_audio)
        self.on(RealtimeEventType.RESPONSE_DONE, _on_done)
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            self.off(RealtimeEventType.RESPONSE_AUDIO_DELTA, _on_audio)
            self.off(RealtimeEventType.RESPONSE_DONE, _on_done)

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and not self._ws.closed and not self._closed
