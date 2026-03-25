"""
Media Streams Bridge

Bridges Twilio Media Streams (μ-law 8 kHz) ↔ OpenAI Realtime (PCM 16-bit 24 kHz).

WebSocket endpoint: WS /ws/twilio/media/{call_sid}

Audio conversion is done with audioop (stdlib) – no ffmpeg required.
"""
import audioop
import base64
import json
import logging
from typing import Optional

import websockets
from websockets.asyncio.client import ClientConnection

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Twilio sends μ-law at 8 kHz mono; OpenAI Realtime expects PCM 16-bit 24 kHz.
_TWILIO_SAMPLE_RATE = 8_000
_OPENAI_SAMPLE_RATE = 24_000
_UPSAMPLE_FACTOR = _OPENAI_SAMPLE_RATE // _TWILIO_SAMPLE_RATE  # 3

_OPENAI_WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"


# ---------------------------------------------------------------------------
# Audio conversion helpers
# ---------------------------------------------------------------------------

def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    """Decode μ-law 8 kHz → PCM 16-bit 8 kHz."""
    return audioop.ulaw2lin(mulaw_bytes, 2)


def pcm16_upsample(pcm_8k: bytes) -> bytes:
    """Upsample PCM 16-bit from 8 kHz to 24 kHz (3×) using audioop.ratecv."""
    upsampled, _ = audioop.ratecv(
        pcm_8k,
        2,               # sample width in bytes (16-bit)
        1,               # mono
        _TWILIO_SAMPLE_RATE,
        _OPENAI_SAMPLE_RATE,
        None,
    )
    return upsampled


def pcm16_to_mulaw(pcm_24k: bytes) -> bytes:
    """Downsample PCM 16-bit 24 kHz → PCM 16-bit 8 kHz, then encode μ-law."""
    downsampled, _ = audioop.ratecv(
        pcm_24k,
        2,
        1,
        _OPENAI_SAMPLE_RATE,
        _TWILIO_SAMPLE_RATE,
        None,
    )
    return audioop.lin2ulaw(downsampled, 2)


def twilio_media_to_openai_audio(payload_b64: str) -> bytes:
    """Convert base64-encoded Twilio μ-law audio to PCM16 24 kHz bytes."""
    mulaw = base64.b64decode(payload_b64)
    pcm_8k = mulaw_to_pcm16(mulaw)
    return pcm16_upsample(pcm_8k)


def openai_audio_to_twilio_media(pcm_24k_bytes: bytes) -> str:
    """Convert PCM16 24 kHz bytes to base64-encoded μ-law for Twilio."""
    mulaw = pcm16_to_mulaw(pcm_24k_bytes)
    return base64.b64encode(mulaw).decode("utf-8")


# ---------------------------------------------------------------------------
# OpenAI Realtime session helpers
# ---------------------------------------------------------------------------

def build_openai_session_update(system_prompt: str, voice: str = "alloy") -> dict:
    return {
        "type": "session.update",
        "session": {
            "modalities": ["audio", "text"],
            "instructions": system_prompt,
            "voice": voice,
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {"model": "whisper-1"},
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 500,
            },
        },
    }


# ---------------------------------------------------------------------------
# Bridge
# ---------------------------------------------------------------------------

class TwilioOpenAIBridge:
    """
    Manages bidirectional audio bridging between a single Twilio Media Stream
    WebSocket connection and the OpenAI Realtime API WebSocket.

    Usage (inside a FastAPI WebSocket handler):

        bridge = TwilioOpenAIBridge(call_sid, system_prompt, voice)
        await bridge.run(twilio_ws)
    """

    def __init__(self, call_sid: str, system_prompt: str, voice: str = "alloy"):
        self.call_sid = call_sid
        self.system_prompt = system_prompt
        self.voice = voice
        self._stream_sid: Optional[str] = None
        self._openai_ws: Optional[ClientConnection] = None

    async def run(self, twilio_ws) -> None:
        """
        Main bridge loop.  `twilio_ws` is a FastAPI WebSocket object.
        Opens a connection to OpenAI Realtime and routes audio bidirectionally.
        """
        openai_headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "OpenAI-Beta": "realtime=v1",
        }

        async with websockets.connect(_OPENAI_WS_URL, additional_headers=openai_headers) as openai_ws:
            self._openai_ws = openai_ws

            # Configure the session
            await openai_ws.send(json.dumps(build_openai_session_update(self.system_prompt, self.voice)))

            import asyncio
            await asyncio.gather(
                self._forward_twilio_to_openai(twilio_ws, openai_ws),
                self._forward_openai_to_twilio(twilio_ws, openai_ws),
            )

    async def _forward_twilio_to_openai(self, twilio_ws, openai_ws) -> None:
        """Read Twilio Media Stream events → send audio to OpenAI."""
        from starlette.websockets import WebSocketDisconnect

        try:
            while True:
                raw = await twilio_ws.receive_text()
                msg = json.loads(raw)
                event = msg.get("event")

                if event == "connected":
                    logger.debug("[bridge %s] Twilio stream connected", self.call_sid)

                elif event == "start":
                    self._stream_sid = msg.get("streamSid") or msg.get("start", {}).get("streamSid")
                    logger.info("[bridge %s] stream started sid=%s", self.call_sid, self._stream_sid)

                elif event == "media":
                    payload = msg.get("media", {}).get("payload", "")
                    if payload:
                        pcm_24k = twilio_media_to_openai_audio(payload)
                        openai_msg = {
                            "type": "input_audio_buffer.append",
                            "audio": base64.b64encode(pcm_24k).decode("utf-8"),
                        }
                        await openai_ws.send(json.dumps(openai_msg))

                elif event == "stop":
                    logger.info("[bridge %s] Twilio stream stopped", self.call_sid)
                    await openai_ws.close()
                    break

        except WebSocketDisconnect:
            logger.info("[bridge %s] Twilio WebSocket disconnected", self.call_sid)
            try:
                await openai_ws.close()
            except Exception:
                pass

    async def _forward_openai_to_twilio(self, twilio_ws, openai_ws) -> None:
        """Read OpenAI Realtime events → stream audio back to Twilio."""
        try:
            async for raw in openai_ws:
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "response.audio.delta":
                    delta_b64 = msg.get("delta", "")
                    if delta_b64 and self._stream_sid:
                        pcm_24k = base64.b64decode(delta_b64)
                        mulaw_b64 = openai_audio_to_twilio_media(pcm_24k)
                        twilio_msg = {
                            "event": "media",
                            "streamSid": self._stream_sid,
                            "media": {"payload": mulaw_b64},
                        }
                        await twilio_ws.send_text(json.dumps(twilio_msg))

                elif msg_type == "response.audio.done":
                    # Optionally send a mark event so Twilio can signal playback complete
                    if self._stream_sid:
                        mark_msg = {
                            "event": "mark",
                            "streamSid": self._stream_sid,
                            "mark": {"name": "audio_done"},
                        }
                        await twilio_ws.send_text(json.dumps(mark_msg))

                elif msg_type in ("error", "session.error"):
                    logger.error("[bridge %s] OpenAI error: %s", self.call_sid, msg)

        except Exception as exc:
            logger.warning("[bridge %s] OpenAI WS closed: %s", self.call_sid, exc)
