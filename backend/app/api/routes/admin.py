"""
Admin API routes — superadmin only.

Provides tenant management, user creation, and cross-org analytics.
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.calls import Call
from app.models.campaigns import Campaign
from app.models.leads import Lead
from app.models.organization import Organization
from app.models.user import User
from app.models.voice_agents import VoiceAgent
from app.services.auth import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])
superadmin = Depends(require_role(["superadmin"]))


# ── Schemas ───────────────────────────────────────────────────────────


class TenantCreate(BaseModel):
    name: str
    subscription_tier: str = "starter"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_tier: Optional[str] = None


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "admin"
    organization_id: uuid.UUID


# ── Tenant endpoints ─────────────────────────────────────────────────


@router.get("/tenants")
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
):
    query = select(Organization)
    count_query = select(func.count()).select_from(Organization)

    if search:
        query = query.where(Organization.name.ilike(f"%{search}%"))
        count_query = count_query.where(Organization.name.ilike(f"%{search}%"))
    if status_filter == "active":
        query = query.where(Organization.is_active.is_(True))
        count_query = count_query.where(Organization.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.where(Organization.is_active.is_(False))
        count_query = count_query.where(Organization.is_active.is_(False))

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(
        query.order_by(Organization.created_at.desc()).limit(limit).offset(offset)
    )
    orgs = result.scalars().all()

    items = []
    for org in orgs:
        user_count = (await db.execute(
            select(func.count()).select_from(User).where(User.organization_id == org.id)
        )).scalar_one()
        agent_count = (await db.execute(
            select(func.count()).select_from(VoiceAgent).where(VoiceAgent.organization_id == org.id)
        )).scalar_one()
        call_count = (await db.execute(
            select(func.count()).select_from(Call).where(Call.organization_id == org.id)
        )).scalar_one()
        lead_count = (await db.execute(
            select(func.count()).select_from(Lead).where(Lead.organization_id == org.id)
        )).scalar_one()

        items.append({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "subscription_tier": org.subscription_tier,
            "is_active": org.is_active,
            "created_at": org.created_at.isoformat(),
            "updated_at": org.updated_at.isoformat(),
            "user_count": user_count,
            "agent_count": agent_count,
            "call_count": call_count,
            "lead_count": lead_count,
        })

    return {"items": items, "total": total}


@router.post("/tenants", status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    slug = body.name.lower().replace(" ", "-").replace("'", "")
    existing = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    org = Organization(
        name=body.name,
        slug=slug,
        subscription_tier=body.subscription_tier,
        settings={"onboarding_completed": False},
    )
    db.add(org)
    await db.flush()
    await db.commit()
    await db.refresh(org)
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "subscription_tier": org.subscription_tier,
        "is_active": org.is_active,
        "created_at": org.created_at.isoformat(),
    }


@router.get("/tenants/{org_id}")
async def get_tenant(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_count = (await db.execute(
        select(func.count()).select_from(User).where(User.organization_id == org.id)
    )).scalar_one()
    agent_count = (await db.execute(
        select(func.count()).select_from(VoiceAgent).where(VoiceAgent.organization_id == org.id)
    )).scalar_one()
    call_count = (await db.execute(
        select(func.count()).select_from(Call).where(Call.organization_id == org.id)
    )).scalar_one()
    lead_count = (await db.execute(
        select(func.count()).select_from(Lead).where(Lead.organization_id == org.id)
    )).scalar_one()

    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "subscription_tier": org.subscription_tier,
        "is_active": org.is_active,
        "settings": org.settings,
        "created_at": org.created_at.isoformat(),
        "updated_at": org.updated_at.isoformat(),
        "user_count": user_count,
        "agent_count": agent_count,
        "call_count": call_count,
        "lead_count": lead_count,
    }


@router.patch("/tenants/{org_id}")
async def update_tenant(
    org_id: uuid.UUID,
    body: TenantUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tenant not found")

    TENANT_UPDATE_FIELDS = {"name", "is_active", "subscription_tier"}
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in TENANT_UPDATE_FIELDS:
            setattr(org, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(org)
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "subscription_tier": org.subscription_tier,
        "is_active": org.is_active,
        "updated_at": org.updated_at.isoformat(),
    }


# ── Tenant sub-resources ─────────────────────────────────────────────


@router.get("/tenants/{org_id}/users")
async def list_tenant_users(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    result = await db.execute(
        select(User).where(User.organization_id == org_id).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ]
    }


@router.post("/tenants/{org_id}/users", status_code=status.HTTP_201_CREATED)
async def create_tenant_user(
    org_id: uuid.UUID,
    body: AdminUserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tenant not found")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    user = User(
        organization_id=org_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "organization_id": str(org_id),
    }


@router.get("/tenants/{org_id}/agents")
async def list_tenant_agents(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    result = await db.execute(
        select(VoiceAgent).where(VoiceAgent.organization_id == org_id)
    )
    agents = result.scalars().all()
    return {
        "items": [
            {
                "id": str(a.id),
                "name": a.name,
                "status": a.status,
                "voice": a.voice,
                "created_at": a.created_at.isoformat(),
            }
            for a in agents
        ]
    }


@router.get("/tenants/{org_id}/calls")
async def list_tenant_calls(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    limit: int = 20,
):
    result = await db.execute(
        select(Call)
        .where(Call.organization_id == org_id)
        .order_by(Call.created_at.desc())
        .limit(limit)
    )
    calls = result.scalars().all()
    return {
        "items": [
            {
                "id": str(c.id),
                "direction": c.direction,
                "status": c.status,
                "duration_seconds": c.duration,
                "phone_from": c.phone_from,
                "phone_to": c.phone_to,
                "created_at": c.created_at.isoformat(),
            }
            for c in calls
        ]
    }


# ── All voice agents ──────────────────────────────────────────────────


@router.get("/voice-agents")
async def list_all_voice_agents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    limit: int = 50,
    offset: int = 0,
):
    total_result = await db.execute(select(func.count()).select_from(VoiceAgent))
    total = total_result.scalar_one()

    result = await db.execute(
        select(VoiceAgent, Organization.name.label("org_name"), Organization.slug.label("org_slug"))
        .outerjoin(Organization, VoiceAgent.organization_id == Organization.id)
        .order_by(VoiceAgent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()
    return {
        "items": [
            {
                "id": str(row.VoiceAgent.id),
                "name": row.VoiceAgent.name,
                "voice": row.VoiceAgent.voice,
                "status": row.VoiceAgent.status,
                "system_prompt": row.VoiceAgent.system_prompt or "",
                "organization_id": str(row.VoiceAgent.organization_id),
                "organization_name": row.org_name or "Unknown",
                "organization_slug": row.org_slug or "",
                "created_at": row.VoiceAgent.created_at.isoformat(),
            }
            for row in rows
        ],
        "total": total,
    }


# ── All users ─────────────────────────────────────────────────────────


@router.get("/users")
async def list_all_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    result = await db.execute(
        select(User, Organization.name.label("org_name"))
        .outerjoin(Organization, User.organization_id == Organization.id)
        .order_by(User.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": str(row.User.id),
            "email": row.User.email,
            "first_name": row.User.first_name,
            "last_name": row.User.last_name,
            "role": row.User.role,
            "is_active": row.User.is_active,
            "organization_id": str(row.User.organization_id),
            "organization_name": row.org_name or "Unknown",
            "created_at": row.User.created_at.isoformat(),
        }
        for row in rows
    ]


# ── Overview / Analytics ──────────────────────────────────────────────


@router.get("/overview")
async def admin_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    total_tenants = (await db.execute(select(func.count()).select_from(Organization))).scalar_one()
    active_tenants = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.is_active.is_(True))
    )).scalar_one()
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_calls = (await db.execute(select(func.count()).select_from(Call))).scalar_one()
    total_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar_one()
    total_agents = (await db.execute(select(func.count()).select_from(VoiceAgent))).scalar_one()
    total_campaigns = (await db.execute(select(func.count()).select_from(Campaign))).scalar_one()

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "inactive_tenants": total_tenants - active_tenants,
        "trial_tenants": 0,
        "total_users": total_users,
        "total_calls": total_calls,
        "total_leads": total_leads,
        "total_agents": total_agents,
        "total_campaigns": total_campaigns,
        "mrr": 0,
        "calls_today": 0,
        "calls_this_week": 0,
        "calls_this_month": total_calls,
    }


@router.get("/analytics")
async def admin_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
):
    total_calls = (await db.execute(select(func.count()).select_from(Call))).scalar_one()
    total_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar_one()
    avg_duration = (await db.execute(
        select(func.avg(Call.duration)).where(Call.duration.isnot(None))
    )).scalar_one()

    return {
        "total_calls": total_calls,
        "total_leads": total_leads,
        "avg_call_duration": round(float(avg_duration or 0), 1),
        "conversion_rate": 0,
        "call_volume": [],
        "top_agents": [],
    }


# ── Platform Settings ────────────────────────────────────────────────

DEFAULT_PLATFORM_SETTINGS = {
    "feature_flags": {
        "ai-summaries": True,
        "sentiment-analysis": True,
        "multi-agent": False,
        "custom-voices": False,
        "webhooks": True,
        "api-access": True,
        "beta-dashboard": False,
    },
    "max_tenants_limit": 500,
    "support_email": "support@retrevr.ai",
}


@router.get("/settings")
async def get_platform_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
):
    org = await db.get(Organization, current_user.organization_id)
    if not org:
        return DEFAULT_PLATFORM_SETTINGS
    stored = (org.settings or {}).get("platform_settings")
    if not stored:
        return DEFAULT_PLATFORM_SETTINGS
    return {**DEFAULT_PLATFORM_SETTINGS, **stored}


@router.patch("/settings")
async def update_platform_settings(
    body: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
):
    org = await db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    settings = dict(org.settings or {})
    existing = settings.get("platform_settings", {})
    existing.update(body)
    settings["platform_settings"] = existing
    org.settings = settings
    await db.flush()
    await db.commit()
    return {**DEFAULT_PLATFORM_SETTINGS, **existing}
