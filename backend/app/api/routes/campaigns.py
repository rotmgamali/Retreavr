
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db, require_role
from app.models.campaigns import Campaign, CampaignStatus
from app.models.user import User
from app.schemas.campaigns import CampaignCreate, CampaignResponse, CampaignUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=PaginatedResponse[CampaignResponse])
async def list_campaigns(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    limit: int = 20,
    offset: int = 0,
):
    base_filter = (Campaign.organization_id == org_id, Campaign.is_deleted.is_(False))

    total_result = await db.execute(select(func.count()).select_from(Campaign).where(*base_filter))
    total = total_result.scalar_one()

    result = await db.execute(select(Campaign).where(*base_filter).limit(limit).offset(offset))
    return PaginatedResponse(items=result.scalars().all(), total=total, limit=limit, offset=offset)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    data = body.model_dump()
    data["organization_id"] = org_id
    campaign = Campaign(**data)
    db.add(campaign)
    await db.flush()
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    campaign.is_deleted = True
    await db.flush()
    await db.commit()


# ── Campaign autodialer controls ───────────────────────────────────────

@router.post("/{campaign_id}/start", status_code=status.HTTP_202_ACCEPTED)
async def start_campaign(
    campaign_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    """Start the autodialer for a campaign. Processes leads in the background."""
    from app.services.campaign_worker import is_campaign_running, start_campaign as run_campaign

    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if is_campaign_running(campaign_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign is already running")

    # Mark active
    campaign.status = CampaignStatus.active
    await db.flush()
    await db.commit()

    # Launch in background
    background_tasks.add_task(run_campaign, campaign_id)

    return {"status": "started", "campaign_id": str(campaign_id)}


@router.post("/{campaign_id}/stop", status_code=status.HTTP_200_OK)
async def stop_campaign_endpoint(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    """Stop a running campaign autodialer."""
    from app.services.campaign_worker import stop_campaign

    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    stopped = await stop_campaign(campaign_id)
    if not stopped:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign is not running")

    campaign.status = CampaignStatus.paused
    await db.flush()
    await db.commit()

    return {"status": "stopped", "campaign_id": str(campaign_id)}


@router.get("/{campaign_id}/status")
async def campaign_status(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """Check whether a campaign's autodialer is currently running."""
    from app.services.campaign_worker import is_campaign_running

    campaign = await db.get(Campaign, campaign_id)
    if not campaign or campaign.organization_id != org_id or campaign.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    return {
        "campaign_id": str(campaign_id),
        "db_status": campaign.status,
        "autodialer_running": is_campaign_running(campaign_id),
    }
