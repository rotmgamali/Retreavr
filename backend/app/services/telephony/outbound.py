from __future__ import annotations

"""
Outbound Calling Service

Handles placing outbound calls through Twilio, DNC list checks,
and per-org rate limiting.
"""
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client as TwilioClient

from app.core.config import get_settings
from app.models.calls import Call
from app.services.telephony.call_manager import (
    attach_twilio_sid,
    create_outbound_call,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# In-memory rate limiting (org-level, per process).
# Replace with Redis for multi-instance deployments.
# ---------------------------------------------------------------------------
import time
from collections import defaultdict

from app.services.redis import check_rate_limit_redis

# In-memory fallback (single-instance only, used when Redis is unavailable)
_rate_counters: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW_SECONDS = 60
_MAX_CALLS_PER_WINDOW = 10  # per org per minute


def _check_rate_limit_local(org_id: str) -> bool:
    """In-memory fallback rate limiter for single-instance deployments."""
    now = time.monotonic()
    window_start = now - _RATE_WINDOW_SECONDS
    _rate_counters[org_id] = [t for t in _rate_counters[org_id] if t > window_start]
    if len(_rate_counters[org_id]) >= _MAX_CALLS_PER_WINDOW:
        return False
    _rate_counters[org_id].append(now)
    return True


async def _check_rate_limit(org_id: str) -> bool:
    """Check rate limit via Redis first, fallback to in-memory."""
    redis_ok = await check_rate_limit_redis(org_id, _RATE_WINDOW_SECONDS, _MAX_CALLS_PER_WINDOW)
    if not redis_ok:
        return False
    return _check_rate_limit_local(org_id)


# ---------------------------------------------------------------------------
# DNC list helpers (stored in org settings JSON field)
# ---------------------------------------------------------------------------

def _normalise_number(phone: str) -> str:
    return phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")


async def is_on_dnc_list(db: AsyncSession, org_id: uuid.UUID, phone_number: str) -> bool:
    """
    Check whether a number is on the organisation's DNC list.
    The DNC list is stored in organizations.settings["dnc_list"] as a list of E.164 strings.
    """
    from app.models.organization import Organization

    result = await db.execute(
        select(Organization.settings).where(Organization.id == org_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return False

    dnc_list: list[str] = row.get("dnc_list", []) if row else []
    normalised = _normalise_number(phone_number)
    return any(_normalise_number(n) == normalised for n in dnc_list)


# ---------------------------------------------------------------------------
# Outbound call initiation
# ---------------------------------------------------------------------------

class DNCViolationError(Exception):
    """Raised when attempting to call a number on the DNC list."""


class RateLimitExceededError(Exception):
    """Raised when an org exceeds the per-minute call rate limit."""


def _get_twilio_client() -> TwilioClient:
    return TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)


async def initiate_call(
    db: AsyncSession,
    to_number: str,
    from_number: str,
    agent_id: uuid.UUID,
    organization_id: uuid.UUID,
    lead_id: Optional[uuid.UUID] = None,
    twiml_url: Optional[str] = None,
) -> Call:
    """
    Place an outbound call via Twilio.

    1. DNC list check
    2. Rate limit check
    3. Create Call record (status=initiating)
    4. Call Twilio REST API
    5. Attach CallSid to the Call record

    `twiml_url` should be the URL Twilio will fetch when the call connects –
    typically your /twilio/voice/inbound or a dedicated outbound TwiML endpoint.
    If not provided, falls back to settings.twilio_phone_number as the status
    callback URL pattern.
    """
    # 1. DNC check
    if await is_on_dnc_list(db, organization_id, to_number):
        raise DNCViolationError(f"Number {to_number} is on the DNC list for org {organization_id}")

    # 2. Rate limit (Redis-backed with in-memory fallback)
    if not await _check_rate_limit(str(organization_id)):
        raise RateLimitExceededError(f"Org {organization_id} exceeded outbound call rate limit")

    # 3. Create pending Call record
    call = await create_outbound_call(
        db=db,
        organization_id=organization_id,
        to_number=to_number,
        from_number=from_number,
        voice_agent_id=agent_id,
        lead_id=lead_id,
    )
    await db.commit()

    # 4. Place the call via Twilio
    if twiml_url is None:
        # Build a sensible default: the inbound webhook that handles media streams
        base_url = settings.twilio_webhook_base_url if hasattr(settings, "twilio_webhook_base_url") else ""
        twiml_url = f"{base_url}/twilio/voice/outbound/{call.id}"

    client = _get_twilio_client()
    twilio_call = client.calls.create(
        to=to_number,
        from_=from_number,
        url=twiml_url,
        status_callback=f"{twiml_url.rstrip('/outbound/' + str(call.id))}/twilio/voice/status",
        status_callback_method="POST",
        record=True,
    )

    # 5. Attach the CallSid
    call = await attach_twilio_sid(db, call, twilio_call.sid)
    await db.commit()

    logger.info(
        "Outbound call placed: call_id=%s twilio_sid=%s to=%s",
        call.id, twilio_call.sid, to_number,
    )
    return call
