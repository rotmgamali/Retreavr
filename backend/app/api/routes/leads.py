
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db
from app.models.leads import Lead, LeadInteraction
from app.schemas.common import PaginatedResponse
from app.schemas.leads import (
    LeadCreate,
    LeadInteractionCreate,
    LeadInteractionResponse,
    LeadInteractionUpdate,
    LeadResponse,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("/", response_model=PaginatedResponse[LeadResponse])
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    base_filter = (Lead.organization_id == org_id, Lead.is_deleted.is_(False))

    total_result = await db.execute(select(func.count()).select_from(Lead).where(*base_filter))
    total = total_result.scalar_one()

    result = await db.execute(select(Lead).where(*base_filter).limit(limit).offset(offset))
    items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != org_id or lead.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    body: LeadCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    data = body.model_dump()
    data["organization_id"] = org_id
    lead = Lead(**data)
    db.add(lead)
    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != org_id or lead.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    LEAD_UPDATE_FIELDS = {"first_name", "last_name", "email", "phone", "insurance_type", "status", "propensity_score", "metadata_"}
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in LEAD_UPDATE_FIELDS:
            setattr(lead, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != org_id or lead.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    lead.is_deleted = True
    await db.flush()
    await db.commit()


@router.get("/{lead_id}/interactions", response_model=PaginatedResponse[LeadInteractionResponse])
async def list_lead_interactions(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    total_result = await db.execute(
        select(func.count()).select_from(LeadInteraction).where(LeadInteraction.lead_id == lead_id)
    )
    total = total_result.scalar_one()
    result = await db.execute(
        select(LeadInteraction).where(LeadInteraction.lead_id == lead_id).limit(limit).offset(offset)
    )
    return PaginatedResponse(items=result.scalars().all(), total=total, limit=limit, offset=offset)


@router.post("/{lead_id}/interactions", response_model=LeadInteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_lead_interaction(
    lead_id: uuid.UUID,
    body: LeadInteractionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    interaction = LeadInteraction(**{**body.model_dump(), "lead_id": lead_id})
    db.add(interaction)
    await db.flush()
    await db.commit()
    await db.refresh(interaction)
    return interaction
