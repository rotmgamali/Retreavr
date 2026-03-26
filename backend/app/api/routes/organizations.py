
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, require_role
from app.models.organization import Organization
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.organizations import OrganizationCreate, OrganizationResponse, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])

_SUPERADMIN_ONLY_FIELDS = {"is_active", "subscription_tier"}


def _is_superadmin(user: User) -> bool:
    return user.role == "superadmin"


def _assert_org_access(current_user: User, org_id: uuid.UUID) -> None:
    """Raise 403 if user does not belong to the org and is not superadmin."""
    if not _is_superadmin(current_user) and current_user.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.get("/", response_model=PaginatedResponse[OrganizationResponse])
async def list_organizations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: int = 20,
    offset: int = 0,
):
    if _is_superadmin(current_user):
        total_result = await db.execute(select(func.count()).select_from(Organization))
        total = total_result.scalar_one()
        result = await db.execute(select(Organization).limit(limit).offset(offset))
        items = result.scalars().all()
    else:
        # Regular users see only their own organisation
        total_result = await db.execute(
            select(func.count())
            .select_from(Organization)
            .where(Organization.id == current_user.organization_id)
        )
        total = total_result.scalar_one()
        result = await db.execute(
            select(Organization)
            .where(Organization.id == current_user.organization_id)
            .limit(limit)
            .offset(offset)
        )
        items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    _assert_org_access(current_user, org_id)
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role(["superadmin"]))],
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
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    _assert_org_access(current_user, org_id)

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    updates = body.model_dump(exclude_unset=True)

    # Non-superadmins cannot modify protected fields
    if not _is_superadmin(current_user):
        for field in _SUPERADMIN_ONLY_FIELDS:
            updates.pop(field, None)

    # Explicit allowlist to prevent mass assignment of unintended fields
    allowed = {"name", "slug", "settings", "is_active", "subscription_tier"}
    for field, value in updates.items():
        if field in allowed:
            setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return org


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    _assert_org_access(current_user, org_id)

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    org.is_active = False
    await db.flush()
