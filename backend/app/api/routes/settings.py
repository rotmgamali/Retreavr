import uuid
from typing import Annotated, Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db, require_role
from app.models.organization import Organization
from app.models.system import Integration, NotificationRule
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


# --- Pydantic schemas ---

class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    subscription_tier: Optional[str] = None


class IntegrationCreate(BaseModel):
    name: str
    provider: str
    config: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class IntegrationResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider: str
    config: Optional[Dict[str, Any]] = None
    is_active: bool

    model_config = {"from_attributes": True}


class NotificationRuleCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None


class NotificationRuleUpdate(BaseModel):
    name: Optional[str] = None
    trigger_event: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class NotificationRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    trigger_event: str
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
    is_active: bool

    model_config = {"from_attributes": True}


# --- Organization settings ---

@router.get("/organization")
async def get_org_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "settings": org.settings,
        "subscription_tier": org.subscription_tier,
    }


@router.patch("/organization")
async def update_org_settings(
    body: OrgSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "settings": org.settings,
        "subscription_tier": org.subscription_tier,
    }


# --- Integrations ---

@router.get("/integrations", response_model=list[IntegrationResponse])
async def list_integrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    result = await db.execute(
        select(Integration).where(Integration.organization_id == org_id)
    )
    return result.scalars().all()


@router.post("/integrations", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    body: IntegrationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    integration = Integration(**body.model_dump(), organization_id=org_id)
    db.add(integration)
    await db.flush()
    await db.refresh(integration)
    return integration


@router.patch("/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: uuid.UUID,
    body: IntegrationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    integration = await db.get(Integration, integration_id)
    if not integration or integration.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(integration, field, value)

    await db.flush()
    await db.refresh(integration)
    return integration


# --- Notification rules ---

@router.get("/notifications", response_model=list[NotificationRuleResponse])
async def list_notification_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.organization_id == org_id)
    )
    return result.scalars().all()


@router.post("/notifications", response_model=NotificationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_rule(
    body: NotificationRuleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    rule = NotificationRule(**body.model_dump(), organization_id=org_id)
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.patch("/notifications/{rule_id}", response_model=NotificationRuleResponse)
async def update_notification_rule(
    rule_id: uuid.UUID,
    body: NotificationRuleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    _: Annotated[User, Depends(require_role(["admin", "superadmin"]))],
):
    rule = await db.get(NotificationRule, rule_id)
    if not rule or rule.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification rule not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.flush()
    await db.refresh(rule)
    return rule
