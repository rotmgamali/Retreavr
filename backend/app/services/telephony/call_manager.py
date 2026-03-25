from __future__ import annotations

"""
Call Lifecycle Manager

State machine: initiating → ringing → in_progress → completed/failed
Handles creating/updating Call records and triggering post-call processing.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calls import Call, CallDirection, CallStatus
from app.models.leads import Lead


# ---------------------------------------------------------------------------
# State machine transitions
# ---------------------------------------------------------------------------

_VALID_TRANSITIONS: dict[str, list[str]] = {
    CallStatus.initiating: [CallStatus.ringing, CallStatus.failed, CallStatus.cancelled],
    CallStatus.ringing: [CallStatus.in_progress, CallStatus.failed, CallStatus.busy, CallStatus.no_answer, CallStatus.cancelled],
    CallStatus.in_progress: [CallStatus.completed, CallStatus.failed],
    CallStatus.completed: [],
    CallStatus.failed: [],
    CallStatus.busy: [],
    CallStatus.no_answer: [],
    CallStatus.cancelled: [],
}

# Map Twilio CallStatus values → our internal status
_TWILIO_STATUS_MAP: dict[str, str] = {
    "initiated": CallStatus.initiating,
    "queued": CallStatus.initiating,
    "ringing": CallStatus.ringing,
    "in-progress": CallStatus.in_progress,
    "completed": CallStatus.completed,
    "failed": CallStatus.failed,
    "busy": CallStatus.busy,
    "no-answer": CallStatus.no_answer,
    "canceled": CallStatus.cancelled,
}


async def create_inbound_call(
    db: AsyncSession,
    organization_id: uuid.UUID,
    call_sid: str,
    from_number: str,
    to_number: str,
    voice_agent_id: Optional[uuid.UUID] = None,
    lead_id: Optional[uuid.UUID] = None,
) -> Call:
    """Create a Call record for a new inbound call."""
    call = Call(
        organization_id=organization_id,
        twilio_sid=call_sid,
        direction=CallDirection.inbound,
        status=CallStatus.ringing,
        phone_from=from_number,
        phone_to=to_number,
        agent_id=voice_agent_id,
        lead_id=lead_id,
    )
    db.add(call)
    await db.flush()
    return call


async def create_outbound_call(
    db: AsyncSession,
    organization_id: uuid.UUID,
    to_number: str,
    from_number: str,
    voice_agent_id: Optional[uuid.UUID] = None,
    lead_id: Optional[uuid.UUID] = None,
) -> Call:
    """Create a Call record for an outbound call (before Twilio SID is available)."""
    call = Call(
        organization_id=organization_id,
        direction=CallDirection.outbound,
        status=CallStatus.initiating,
        phone_from=from_number,
        phone_to=to_number,
        agent_id=voice_agent_id,
        lead_id=lead_id,
    )
    db.add(call)
    await db.flush()
    return call


async def get_call_by_sid(db: AsyncSession, call_sid: str) -> Optional[Call]:
    result = await db.execute(select(Call).where(Call.twilio_sid == call_sid))
    return result.scalar_one_or_none()


async def get_call_by_id(db: AsyncSession, call_id: uuid.UUID) -> Optional[Call]:
    result = await db.execute(select(Call).where(Call.id == call_id))
    return result.scalar_one_or_none()


async def transition_status(
    db: AsyncSession,
    call: Call,
    new_status: str,
    duration: Optional[int] = None,
) -> Call:
    """
    Advance the call state machine.  Silently ignores invalid transitions so
    out-of-order Twilio webhooks don't raise 500s.
    """
    allowed = _VALID_TRANSITIONS.get(call.status, [])
    if new_status not in allowed:
        return call

    call.status = new_status

    if new_status == CallStatus.in_progress and call.created_at:
        # record when the call was actually answered
        call.updated_at = datetime.now(timezone.utc)

    if new_status in (CallStatus.completed, CallStatus.failed, CallStatus.busy, CallStatus.no_answer):
        if duration is not None:
            call.duration = duration

    await db.flush()
    return call


async def update_call_from_twilio_status(
    db: AsyncSession,
    call_sid: str,
    twilio_status: str,
    duration: Optional[int] = None,
) -> Optional[Call]:
    """Update call state from a Twilio status callback payload."""
    call = await get_call_by_sid(db, call_sid)
    if call is None:
        return None

    internal_status = _TWILIO_STATUS_MAP.get(twilio_status)
    if internal_status is None:
        return call

    return await transition_status(db, call, internal_status, duration)


async def attach_twilio_sid(db: AsyncSession, call: Call, call_sid: str) -> Call:
    """Attach the Twilio CallSid after an outbound call is placed."""
    call.twilio_sid = call_sid
    await db.flush()
    return call


async def lookup_lead_by_phone(db: AsyncSession, phone_number: str) -> Optional[Lead]:
    """Try to find an existing lead by phone number (normalised)."""
    normalised = _normalise_e164(phone_number)
    result = await db.execute(select(Lead).where(Lead.phone == normalised).limit(1))
    return result.scalar_one_or_none()


def _normalise_e164(phone: str) -> str:
    """Strip whitespace/dashes; keep + prefix."""
    digits = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    return digits
