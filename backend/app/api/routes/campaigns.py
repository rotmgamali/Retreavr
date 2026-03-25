
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db
from app.models.campaigns import Campaign
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
