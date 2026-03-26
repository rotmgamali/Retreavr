
"""
Twilio Webhook Handlers

Endpoints in this module are intentionally excluded from the global API prefix
and JWT authentication.  They are validated via Twilio request signatures instead.

Routes:
  POST /twilio/voice/inbound      - Incoming call webhook
  POST /twilio/voice/status       - Call status callback
  POST /twilio/voice/fallback     - Error fallback TwiML
  POST /twilio/voice/outbound/{call_id} - TwiML for outbound calls
  POST /twilio/recording/status   - Recording status callback
  WS   /ws/twilio/media/{call_sid} - Media Streams bridge
"""
import asyncio
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import Connect, Dial, VoiceResponse

from app.core.config import get_settings
from app.core.database import get_db
from app.models.calls import Call
from app.models.organization import Organization
from app.models.voice_agents import VoiceAgent
from app.services.telephony.call_manager import (
    create_inbound_call,
    get_call_by_id,
    get_call_by_sid,
    lookup_lead_by_phone,
    update_call_from_twilio_status,
)
from app.services.telephony.media_bridge import TwilioOpenAIBridge
from app.services.telephony.recording import (
    store_twilio_recording_url,
    fetch_and_upload_twilio_recording,
)
from app.services.post_call_processor import run_post_call_processing
from app.core.database import async_session

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["twilio"])


# ---------------------------------------------------------------------------
# Twilio signature validation dependency
# ---------------------------------------------------------------------------

async def verify_twilio_signature(request: Request) -> None:
    """
    Validates that the incoming request was signed by Twilio.
    Raises HTTP 403 if the signature is invalid.
    Skipped when twilio_auth_token is not configured (dev mode).
    """
    if not settings.twilio_auth_token:
        return  # dev / test mode – skip validation

    validator = RequestValidator(settings.twilio_auth_token)
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)

    # For POST requests, Twilio signs the full form body params
    form_data = await request.form()
    params = dict(form_data)

    if not validator.validate(url, params, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


# ---------------------------------------------------------------------------
# Helper: find the org + voice agent for a Twilio phone number
# ---------------------------------------------------------------------------

async def _resolve_org_and_agent(
    db: AsyncSession,
    to_number: str,
) -> tuple[Optional[Organization], Optional[VoiceAgent]]:
    """
    Look up the Organization and active VoiceAgent configured for `to_number`.
    The phone number is matched against organization settings["twilio_numbers"][to_number].
    Falls back to the first active agent for that org if no explicit mapping.
    """
    # Find org by matching to_number in their settings
    result = await db.execute(select(Organization).where(Organization.is_active.is_(True)))
    orgs = result.scalars().all()

    for org in orgs:
        configured_numbers: dict = (org.settings or {}).get("twilio_numbers", {})
        if to_number in configured_numbers or to_number.lstrip("+") in configured_numbers:
            agent_id_str = configured_numbers.get(to_number) or configured_numbers.get(to_number.lstrip("+"))
            if agent_id_str:
                agent_result = await db.execute(
                    select(VoiceAgent).where(
                        VoiceAgent.id == uuid.UUID(str(agent_id_str)),
                        VoiceAgent.status == "active",
                    )
                )
                agent = agent_result.scalar_one_or_none()
                return org, agent
            # org found but no explicit agent mapping – use first active agent
            first_agent = await db.execute(
                select(VoiceAgent).where(
                    VoiceAgent.organization_id == org.id,
                    VoiceAgent.status == "active",
                ).limit(1)
            )
            return org, first_agent.scalar_one_or_none()

    return None, None


def _twiml_media_stream(call_sid: str, base_url: str) -> str:
    """Return TwiML that opens a Media Stream WebSocket."""
    response = VoiceResponse()
    connect = Connect()
    stream_url = f"{base_url}/ws/twilio/media/{call_sid}"
    connect.stream(url=stream_url)
    response.append(connect)
    return str(response)


def _twiml_error_fallback() -> str:
    response = VoiceResponse()
    response.say(
        "We're sorry, but we encountered a technical problem. Please try again later.",
        voice="Polly.Joanna",
    )
    response.hangup()
    return str(response)


# ---------------------------------------------------------------------------
# POST /twilio/voice/inbound
# ---------------------------------------------------------------------------

@router.post("/twilio/voice/inbound")
async def twilio_voice_inbound(
    request: Request,
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    CallStatus: str = Form(default="ringing"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_twilio_signature),
):
    """
    Handles an incoming Twilio call.

    1. Resolves org + voice agent from the dialled number.
    2. Creates a Call record.
    3. Returns TwiML to open a Media Stream WebSocket.
    """
    logger.info("Inbound call: sid=%s from=%s to=%s", CallSid, From, To)

    org, agent = await _resolve_org_and_agent(db, To)

    if org is None:
        logger.warning("No org found for number %s – returning fallback TwiML", To)
        return Response(content=_twiml_error_fallback(), media_type="application/xml")

    lead = await lookup_lead_by_phone(db, From)
    call = await create_inbound_call(
        db=db,
        organization_id=org.id,
        call_sid=CallSid,
        from_number=From,
        to_number=To,
        voice_agent_id=agent.id if agent else None,
        lead_id=lead.id if lead else None,
    )
    await db.commit()

    base_url = str(request.base_url).rstrip("/")
    twiml = _twiml_media_stream(CallSid, base_url)
    return Response(content=twiml, media_type="application/xml")


# ---------------------------------------------------------------------------
# POST /twilio/voice/outbound/{call_id}
# ---------------------------------------------------------------------------

@router.post("/twilio/voice/outbound/{call_id}")
async def twilio_voice_outbound(
    request: Request,
    call_id: uuid.UUID,
    CallSid: str = Form(...),
    CallStatus: str = Form(default="ringing"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_twilio_signature),
):
    """
    TwiML endpoint called by Twilio when an outbound call connects.
    Returns Media Streams TwiML so the bridge can take over.
    """
    logger.info("Outbound call connected: call_id=%s sid=%s", call_id, CallSid)
    base_url = str(request.base_url).rstrip("/")
    twiml = _twiml_media_stream(CallSid, base_url)
    return Response(content=twiml, media_type="application/xml")


# ---------------------------------------------------------------------------
# POST /twilio/voice/status
# ---------------------------------------------------------------------------

@router.post("/twilio/voice/status")
async def twilio_voice_status(
    request: Request,
    CallSid: str = Form(...),
    CallStatus: str = Form(...),
    CallDuration: Optional[str] = Form(default=None),
    RecordingUrl: Optional[str] = Form(default=None),
    RecordingDuration: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_twilio_signature),
):
    """
    Handles Twilio call status callbacks and updates the Call record.
    Also stores the recording URL if Twilio provides one.
    """
    logger.info("Status callback: sid=%s status=%s", CallSid, CallStatus)

    duration = int(CallDuration) if CallDuration else None
    call = await update_call_from_twilio_status(db, CallSid, CallStatus, duration)

    if call and RecordingUrl:
        rec_duration = int(RecordingDuration) if RecordingDuration else None
        await store_twilio_recording_url(db, call, RecordingUrl, rec_duration)

    await db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# POST /twilio/voice/fallback
# ---------------------------------------------------------------------------

@router.post("/twilio/voice/fallback")
async def twilio_voice_fallback(
    request: Request,
    CallSid: str = Form(default=""),
    ErrorCode: str = Form(default=""),
    ErrorUrl: str = Form(default=""),
    _: None = Depends(verify_twilio_signature),
):
    """
    Error fallback – Twilio calls this if the primary webhook fails.
    Returns safe TwiML to gracefully end the call.
    """
    logger.error(
        "Twilio fallback triggered: sid=%s error_code=%s error_url=%s",
        CallSid, ErrorCode, ErrorUrl,
    )
    twiml = _twiml_error_fallback()
    return Response(content=twiml, media_type="application/xml")


# ---------------------------------------------------------------------------
# POST /twilio/recording/status
# ---------------------------------------------------------------------------

@router.post("/twilio/recording/status")
async def twilio_recording_status(
    request: Request,
    CallSid: str = Form(...),
    RecordingSid: str = Form(default=""),
    RecordingUrl: str = Form(default=""),
    RecordingStatus: str = Form(default=""),
    RecordingDuration: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_twilio_signature),
):
    """
    Handles Twilio recording status callbacks.
    Stores the recording URL once it's available.
    """
    if RecordingStatus == "completed" and RecordingUrl:
        call = await get_call_by_sid(db, CallSid)
        if call:
            duration = int(RecordingDuration) if RecordingDuration else None
            # Store Twilio URL as fallback
            await store_twilio_recording_url(db, call, RecordingUrl, duration)
            await db.commit()
            # Attempt to download from Twilio and upload to S3/R2 for long-term storage
            try:
                await fetch_and_upload_twilio_recording(
                    db, call, RecordingUrl, RecordingSid, duration,
                )
                await db.commit()
            except Exception as exc:
                logger.warning("S3 upload failed for recording %s: %s (Twilio URL saved as fallback)", RecordingSid, exc)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# WS /ws/twilio/media/{call_sid}
# ---------------------------------------------------------------------------

@router.websocket("/ws/twilio/media/{call_sid}")
async def twilio_media_stream(
    websocket: WebSocket,
    call_sid: str,
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint that bridges Twilio Media Streams to OpenAI Realtime.
    """
    await websocket.accept()
    logger.info("Media stream WebSocket accepted: call_sid=%s", call_sid)

    call = await get_call_by_sid(db, call_sid)
    if call is None:
        logger.warning("No call record for sid=%s – closing WS", call_sid)
        await websocket.close(code=1008)
        return

    # Fetch the voice agent's system prompt and voice setting
    system_prompt = "You are a helpful insurance agent assistant."
    voice = "alloy"
    if call.agent_id:
        result = await db.execute(select(VoiceAgent).where(VoiceAgent.id == call.agent_id))
        agent = result.scalar_one_or_none()
        if agent:
            system_prompt = agent.system_prompt or system_prompt
            voice = agent.voice or voice

    bridge = TwilioOpenAIBridge(
        call_sid=call_sid,
        call_id=call.id,
        organization_id=call.organization_id,
        system_prompt=system_prompt,
        voice=voice,
    )
    transcript = None
    try:
        transcript = await bridge.run(websocket)
    except WebSocketDisconnect:
        logger.info("Media stream WS disconnected: call_sid=%s", call_sid)
    except Exception as exc:
        logger.exception("Media stream error for call_sid=%s: %s", call_sid, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

        # Save transcript and trigger post-call processing as background task
        if transcript is not None:
            transcript_text = transcript.as_text()
            call_db_id = call.id

            async def _post_call_bg() -> None:
                try:
                    async with async_session() as bg_db:
                        await transcript.save_to_db(bg_db, call_db_id)
                        await run_post_call_processing(call_db_id, transcript_text, bg_db)
                        await bg_db.commit()
                except Exception:
                    logger.exception("Post-call processing failed for call_sid=%s", call_sid)

            asyncio.create_task(_post_call_bg())
