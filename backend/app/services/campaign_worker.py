"""
Campaign Autodialer Background Worker

Processes lead lists for active campaigns by placing outbound calls
through the telephony service. Runs as a FastAPI background task or
standalone asyncio worker.

Usage:
    - Via API: POST /api/v1/campaigns/{id}/start
    - Standalone: python -m app.services.campaign_worker
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.campaigns import Campaign, CampaignLead, CampaignStatus
from app.models.leads import Lead
from app.models.voice_agents import VoiceAgent
from app.services.telephony.outbound import (
    DNCViolationError,
    RateLimitExceededError,
    initiate_call,
)
from app.services.realtime.event_bus import Event, EventType, event_bus

logger = logging.getLogger(__name__)

# Concurrency: max simultaneous calls per campaign
MAX_CONCURRENT_CALLS = 5
# Delay between initiating calls (seconds)
INTER_CALL_DELAY = 2.0
# How long to wait before retrying after a rate limit hit
RATE_LIMIT_BACKOFF = 30.0

# Track running campaigns so we can stop them
_running_campaigns: dict[uuid.UUID, asyncio.Event] = {}


async def start_campaign(campaign_id: uuid.UUID) -> None:
    """
    Main entry point: fetch campaign leads and dial through them.
    Designed to be launched via asyncio.create_task().
    """
    stop_event = asyncio.Event()
    _running_campaigns[campaign_id] = stop_event

    try:
        async with async_session_factory() as db:
            campaign = await db.get(Campaign, campaign_id)
            if not campaign:
                logger.error("Campaign %s not found", campaign_id)
                return

            if campaign.status != CampaignStatus.active:
                logger.info("Campaign %s is not active (status=%s), skipping", campaign_id, campaign.status)
                return

            # Resolve the voice agent for this campaign
            agent = await _resolve_agent(db, campaign)
            if not agent:
                logger.error("No active voice agent found for campaign %s", campaign_id)
                return

            # Fetch the org's from number
            from_number = await _resolve_from_number(db, campaign)

            # Get pending leads for this campaign
            leads = await _get_pending_leads(db, campaign_id)
            if not leads:
                logger.info("No pending leads for campaign %s", campaign_id)
                await _mark_campaign_completed(db, campaign_id)
                return

            logger.info(
                "Starting campaign %s: %d leads, agent=%s",
                campaign_id, len(leads), agent.id,
            )

            await event_bus.publish(Event(
                event_type=EventType.KPI_UPDATE,
                org_id=str(campaign.organization_id),
                payload={"campaign_id": str(campaign_id), "action": "started", "total_leads": len(leads)},
            ))

            # Process leads with concurrency control
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_CALLS)
            completed = 0
            failed = 0

            for campaign_lead, lead in leads:
                if stop_event.is_set():
                    logger.info("Campaign %s stop requested", campaign_id)
                    break

                async with semaphore:
                    success = await _dial_lead(
                        db, campaign, lead, campaign_lead, agent, from_number, stop_event,
                    )
                    if success:
                        completed += 1
                    else:
                        failed += 1

                await asyncio.sleep(INTER_CALL_DELAY)

            # Mark campaign complete
            await _mark_campaign_completed(db, campaign_id)

            await event_bus.publish(Event(
                event_type=EventType.KPI_UPDATE,
                org_id=str(campaign.organization_id),
                payload={
                    "campaign_id": str(campaign_id),
                    "action": "completed",
                    "completed": completed,
                    "failed": failed,
                },
            ))

            logger.info(
                "Campaign %s finished: completed=%d failed=%d",
                campaign_id, completed, failed,
            )
    finally:
        _running_campaigns.pop(campaign_id, None)


async def stop_campaign(campaign_id: uuid.UUID) -> bool:
    """Request a running campaign to stop gracefully."""
    event = _running_campaigns.get(campaign_id)
    if event:
        event.set()
        return True
    return False


def is_campaign_running(campaign_id: uuid.UUID) -> bool:
    return campaign_id in _running_campaigns


# ── Internal helpers ───────────────────────────────────────────────────

async def _resolve_agent(db: AsyncSession, campaign: Campaign) -> VoiceAgent | None:
    """Pick the voice agent from campaign config or the org's first active agent."""
    agent_id = (campaign.config or {}).get("voice_agent_id")
    if agent_id:
        agent = await db.get(VoiceAgent, uuid.UUID(agent_id))
        if agent and agent.status == "active":
            return agent

    result = await db.execute(
        select(VoiceAgent)
        .where(VoiceAgent.organization_id == campaign.organization_id, VoiceAgent.status == "active")
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _resolve_from_number(db: AsyncSession, campaign: Campaign) -> str:
    """Get the Twilio number for the campaign's org."""
    from app.core.config import get_settings
    from app.models.organization import Organization

    settings = get_settings()
    org = await db.get(Organization, campaign.organization_id)
    if org and org.settings:
        numbers = org.settings.get("twilio_numbers", {})
        if numbers:
            return list(numbers.values())[0] if isinstance(numbers, dict) else numbers[0]
    return settings.twilio_phone_number


async def _get_pending_leads(
    db: AsyncSession, campaign_id: uuid.UUID
) -> list[tuple[CampaignLead, Lead]]:
    """Fetch leads linked to the campaign that haven't been called yet."""
    result = await db.execute(
        select(CampaignLead, Lead)
        .join(Lead, CampaignLead.lead_id == Lead.id)
        .where(
            CampaignLead.campaign_id == campaign_id,
            CampaignLead.status == "pending",
        )
    )
    return list(result.all())


async def _dial_lead(
    db: AsyncSession,
    campaign: Campaign,
    lead: Lead,
    campaign_lead: CampaignLead,
    agent: VoiceAgent,
    from_number: str,
    stop_event: asyncio.Event,
) -> bool:
    """Attempt to place an outbound call to a single lead. Returns True on success."""
    if not lead.phone:
        await _update_lead_status(db, campaign_lead.id, "skipped")
        return False

    try:
        await initiate_call(
            db=db,
            to_number=lead.phone,
            from_number=from_number,
            agent_id=agent.id,
            organization_id=campaign.organization_id,
            lead_id=lead.id,
        )
        await _update_lead_status(db, campaign_lead.id, "called")
        return True

    except DNCViolationError:
        logger.info("Lead %s on DNC list, skipping", lead.id)
        await _update_lead_status(db, campaign_lead.id, "dnc_blocked")
        return False

    except RateLimitExceededError:
        logger.warning("Rate limit hit for org %s, backing off %.0fs", campaign.organization_id, RATE_LIMIT_BACKOFF)
        await asyncio.sleep(RATE_LIMIT_BACKOFF)
        if stop_event.is_set():
            return False
        # Retry once
        try:
            await initiate_call(
                db=db,
                to_number=lead.phone,
                from_number=from_number,
                agent_id=agent.id,
                organization_id=campaign.organization_id,
                lead_id=lead.id,
            )
            await _update_lead_status(db, campaign_lead.id, "called")
            return True
        except Exception:
            await _update_lead_status(db, campaign_lead.id, "failed")
            return False

    except Exception as exc:
        logger.error("Failed to call lead %s: %s", lead.id, exc)
        await _update_lead_status(db, campaign_lead.id, "failed")
        return False


async def _update_lead_status(db: AsyncSession, campaign_lead_id: uuid.UUID, new_status: str) -> None:
    await db.execute(
        update(CampaignLead)
        .where(CampaignLead.id == campaign_lead_id)
        .values(status=new_status, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def _mark_campaign_completed(db: AsyncSession, campaign_id: uuid.UUID) -> None:
    await db.execute(
        update(Campaign)
        .where(Campaign.id == campaign_id)
        .values(status=CampaignStatus.completed, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()
