"""
Autodialer Service

Handles the automated processing of outbound campaigns by iterating through
CampaignLead records and placing calls via the Outbound Telephony service.
"""
import asyncio
import logging
import uuid
from typing import List

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaigns import Campaign, CampaignLead, CampaignStatus
from app.models.leads import Lead
from app.services.telephony.outbound import initiate_call, RateLimitExceededError, DNCViolationError

logger = logging.getLogger(__name__)

async def run_campaign_dialer(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    organization_id: uuid.UUID,
    batch_size: int = 5,
    delay_seconds: int = 2,
):
    """
    Background worker to process a campaign.
    Iterates through 'pending' leads and initiates calls.
    """
    logger.info("Starting autodialer for campaign: %s", campaign_id)

    # 1. Fetch the campaign and its voice agent
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.status != CampaignStatus.active:
        logger.warning("Campaign %s not found or not active", campaign_id)
        return

    agent_id = campaign.config.get("agent_id") if campaign.config else None
    from_number = campaign.config.get("from_number") if campaign.config else None

    if not agent_id or not from_number:
        logger.error("Campaign %s missing agent_id or from_number in config", campaign_id)
        return

    # 2. Fetch all pending leads for this campaign
    result = await db.execute(
        select(CampaignLead, Lead)
        .join(Lead, CampaignLead.lead_id == Lead.id)
        .where(
            CampaignLead.campaign_id == campaign_id,
            CampaignLead.status == "pending"
        )
    )
    leads_to_dial = result.all()

    if not leads_to_dial:
        logger.info("No pending leads for campaign %s", campaign_id)
        # Update campaign status to completed if no leads left
        campaign.status = CampaignStatus.completed
        await db.commit()
        return

    for cp_lead, lead in leads_to_dial:
        # Re-check campaign status (it might have been paused)
        await db.refresh(campaign)
        if campaign.status != CampaignStatus.active:
            logger.info("Campaign %s was paused/stopped. Aborting dialer loop.", campaign_id)
            break

        logger.info("Dialing lead %s (%s)", lead.id, lead.phone)
        
        try:
            # Place the call
            await initiate_call(
                db=db,
                to_number=lead.phone,
                from_number=from_number,
                agent_id=uuid.UUID(str(agent_id)),
                organization_id=organization_id,
                lead_id=lead.id,
            )
            # Update status
            cp_lead.status = "called"
            
        except DNCViolationError:
            logger.warning("Lead %s is on DNC list. Skipping.", lead.id)
            cp_lead.status = "skipped_dnc"
        except RateLimitExceededError:
            logger.warning("Organization %s hit rate limit. Waiting for 30s.", organization_id)
            await asyncio.sleep(30)
            continue # Retry the same lead
        except Exception as e:
            logger.exception("Failed to dial lead %s: %s", lead.id, e)
            cp_lead.status = "failed"

        await db.commit()
        
        # Batching delay to avoid overwhelming the system
        await asyncio.sleep(delay_seconds)

    logger.info("Autodialer finished processing batch for campaign %s", campaign_id)
