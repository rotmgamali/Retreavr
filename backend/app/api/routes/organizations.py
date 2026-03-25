
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.organizations import OrganizationCreate, OrganizationResponse, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/", response_model=PaginatedResponse[OrganizationResponse])
async def list_organizations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: int = 20,
    offset: int = 0,
):
    total_result = await db.execute(select(func.count()).select_from(Organization))
    total = total_result.scalar_one()

    result = await db.execute(select(Organization).limit(limit).offset(offset))
    items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = Organization(**body.model_dump())
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    body: OrganizationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return org


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    org.is_active = False
    await db.flush()
