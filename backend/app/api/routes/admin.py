"""
Admin API routes — superadmin only.

Provides tenant management, user management, cross-org analytics, and audit logging.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import case, cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.calls import Call
from app.models.campaigns import Campaign
from app.models.leads import Lead
from app.models.organization import Organization
from app.models.system import AuditLog
from app.models.user import User
from app.models.voice_agents import VoiceAgent
from app.services.auth import hash_password
from app.services.redis import check_admin_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
superadmin = Depends(require_role(["superadmin"]))

# Hard cap on pagination to prevent memory exhaustion
MAX_PAGE_LIMIT = 200

TIER_MRR = {
    "starter": 99,
    "pro": 299,
    "enterprise": 999,
}

VALID_TIERS = {"trial", "starter", "pro", "enterprise"}
VALID_ROLES = {"superadmin", "admin", "manager", "agent", "viewer"}


# ── Helpers ──────────────────────────────────────────────────────────


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_LIMIT))


async def _audit(
    db: AsyncSession,
    *,
    user: User,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """Write an audit log entry for an admin action."""
    entry = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Rate limit dependency ────────────────────────────────────────────


async def _check_admin_rate(request: Request) -> None:
    ip = _client_ip(request)
    allowed = await check_admin_rate_limit(ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many admin requests. Try again shortly.",
        )


admin_rate_limit = Depends(_check_admin_rate)


# ── Schemas ──────────────────────────────────────────────────────────


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    subscription_tier: str = "starter"


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    subscription_tier: Optional[str] = None


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: str = "admin"
    organization_id: uuid.UUID


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class PlatformSettingsUpdate(BaseModel):
    feature_flags: Optional[dict[str, bool]] = None
    max_tenants_limit: Optional[int] = Field(default=None, ge=1, le=10000)
    support_email: Optional[str] = Field(default=None, max_length=255)
    security: Optional[dict[str, bool]] = None
    notifications: Optional[dict[str, bool]] = None


# ── Tenant endpoints ─────────────────────────────────────────────────


@router.get("/tenants")
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
):
    limit = _clamp_limit(limit)
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
    elif status_filter == "trial":
        query = query.where(Organization.subscription_tier == "trial")
        count_query = count_query.where(Organization.subscription_tier == "trial")

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
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    if body.subscription_tier not in VALID_TIERS:
        raise HTTPException(status_code=422, detail=f"Invalid tier. Must be one of: {sorted(VALID_TIERS)}")

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

    await _audit(db, user=current_user, action="tenant.create", resource_type="organization",
                 resource_id=str(org.id), details={"name": body.name, "tier": body.subscription_tier},
                 ip_address=_client_ip(request))

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
    _rl: Annotated[None, admin_rate_limit],
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
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tenant not found")

    updates = body.model_dump(exclude_unset=True)

    if "subscription_tier" in updates and updates["subscription_tier"] not in VALID_TIERS:
        raise HTTPException(status_code=422, detail=f"Invalid tier. Must be one of: {sorted(VALID_TIERS)}")

    TENANT_UPDATE_FIELDS = {"name", "is_active", "subscription_tier"}
    changes = {}
    for field, value in updates.items():
        if field in TENANT_UPDATE_FIELDS:
            changes[field] = {"from": getattr(org, field), "to": value}
            setattr(org, field, value)

    await _audit(db, user=current_user, action="tenant.update", resource_type="organization",
                 resource_id=str(org_id), details=changes, ip_address=_client_ip(request))

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
    _rl: Annotated[None, admin_rate_limit],
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
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {sorted(VALID_ROLES)}")

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

    await _audit(db, user=current_user, action="user.create", resource_type="user",
                 resource_id=str(user.id), details={"email": body.email, "role": body.role, "org_id": str(org_id)},
                 ip_address=_client_ip(request))

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
    _rl: Annotated[None, admin_rate_limit],
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
    _rl: Annotated[None, admin_rate_limit],
    limit: int = 20,
):
    limit = _clamp_limit(limit)
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
    _rl: Annotated[None, admin_rate_limit],
    limit: int = 50,
    offset: int = 0,
):
    limit = _clamp_limit(limit)
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
    _rl: Annotated[None, admin_rate_limit],
    limit: int = 100,
    offset: int = 0,
):
    limit = _clamp_limit(limit)
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    result = await db.execute(
        select(User, Organization.name.label("org_name"))
        .outerjoin(Organization, User.organization_id == Organization.id)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()
    return {
        "items": [
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
        ],
        "total": total,
    }


# ── User management ─────────────────────────────────────────────────


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_unset=True)
    if "role" in updates and updates["role"] not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {sorted(VALID_ROLES)}")

    # Prevent demoting yourself
    if user.id == current_user.id and "role" in updates and updates["role"] != current_user.role:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    changes = {}
    for field, value in updates.items():
        changes[field] = {"from": getattr(user, field), "to": value}
        setattr(user, field, value)

    await _audit(db, user=current_user, action="user.update", resource_type="user",
                 resource_id=str(user_id), details=changes, ip_address=_client_ip(request))

    await db.flush()
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "organization_id": str(user.organization_id),
    }


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: uuid.UUID,
    body: AdminPasswordReset,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)

    await _audit(db, user=current_user, action="user.password_reset", resource_type="user",
                 resource_id=str(user_id), details={"target_email": user.email},
                 ip_address=_client_ip(request))

    await db.flush()
    await db.commit()


# ── Overview / Analytics ──────────────────────────────────────────────


@router.get("/overview")
async def admin_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    total_tenants = (await db.execute(select(func.count()).select_from(Organization))).scalar_one()
    active_tenants = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.is_active.is_(True))
    )).scalar_one()
    trial_tenants = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.subscription_tier == "trial")
    )).scalar_one()
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_calls = (await db.execute(select(func.count()).select_from(Call))).scalar_one()
    total_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar_one()
    total_agents = (await db.execute(select(func.count()).select_from(VoiceAgent))).scalar_one()
    total_campaigns = (await db.execute(select(func.count()).select_from(Campaign))).scalar_one()

    calls_today = (await db.execute(
        select(func.count()).select_from(Call).where(Call.created_at >= today_start)
    )).scalar_one()
    calls_this_week = (await db.execute(
        select(func.count()).select_from(Call).where(Call.created_at >= week_start)
    )).scalar_one()
    calls_this_month = (await db.execute(
        select(func.count()).select_from(Call).where(Call.created_at >= month_start)
    )).scalar_one()

    # Calculate real MRR from active tenants with paid tiers
    mrr_result = await db.execute(
        select(
            func.sum(
                case(
                    (Organization.subscription_tier == "starter", TIER_MRR["starter"]),
                    (Organization.subscription_tier == "pro", TIER_MRR["pro"]),
                    (Organization.subscription_tier == "enterprise", TIER_MRR["enterprise"]),
                    else_=0,
                )
            )
        ).where(Organization.is_active.is_(True))
    )
    mrr = mrr_result.scalar_one() or 0

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "inactive_tenants": total_tenants - active_tenants,
        "trial_tenants": trial_tenants,
        "total_users": total_users,
        "total_calls": total_calls,
        "total_leads": total_leads,
        "total_agents": total_agents,
        "total_campaigns": total_campaigns,
        "mrr": int(mrr),
        "calls_today": calls_today,
        "calls_this_week": calls_this_week,
        "calls_this_month": calls_this_month,
    }


@router.get("/analytics")
async def admin_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total_calls = (await db.execute(select(func.count()).select_from(Call))).scalar_one()
    total_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar_one()
    avg_duration = (await db.execute(
        select(func.avg(Call.duration)).where(Call.duration.isnot(None))
    )).scalar_one()

    # Conversion rate: leads that reached 'bound' status / total leads
    converted = (await db.execute(
        select(func.count()).select_from(Lead).where(Lead.status == "bound")
    )).scalar_one()
    conversion_rate = round((converted / total_leads * 100) if total_leads > 0 else 0, 1)

    # Daily call volume (last 30 days)
    daily_calls_result = await db.execute(
        select(
            cast(Call.created_at, Date).label("date"),
            func.count().label("count"),
        )
        .where(Call.created_at >= thirty_days_ago)
        .group_by(cast(Call.created_at, Date))
        .order_by(cast(Call.created_at, Date))
    )
    daily_call_volume = [
        {"date": row.date.isoformat(), "count": row.count}
        for row in daily_calls_result.all()
    ]

    # Tenant growth (last 12 months)
    twelve_months_ago = now - timedelta(days=365)
    tenant_growth_result = await db.execute(
        select(
            func.date_trunc("month", Organization.created_at).label("month"),
            func.count().label("count"),
        )
        .where(Organization.created_at >= twelve_months_ago)
        .group_by(func.date_trunc("month", Organization.created_at))
        .order_by(func.date_trunc("month", Organization.created_at))
    )
    tenant_growth = [
        {"month": row.month.strftime("%Y-%m"), "count": row.count}
        for row in tenant_growth_result.all()
    ]

    # Calls by status breakdown
    calls_by_status_result = await db.execute(
        select(Call.status, func.count().label("count"))
        .group_by(Call.status)
        .order_by(func.count().desc())
    )
    calls_by_status = [
        {"status": row.status, "count": row.count}
        for row in calls_by_status_result.all()
    ]

    # Tier distribution
    tier_result = await db.execute(
        select(Organization.subscription_tier, func.count().label("count"))
        .where(Organization.is_active.is_(True))
        .group_by(Organization.subscription_tier)
    )
    tier_distribution = [
        {"tier": row.subscription_tier, "count": row.count}
        for row in tier_result.all()
    ]

    # Top tenants by call volume
    top_by_calls_result = await db.execute(
        select(Organization.id, Organization.name, func.count(Call.id).label("call_count"))
        .join(Call, Call.organization_id == Organization.id)
        .group_by(Organization.id, Organization.name)
        .order_by(func.count(Call.id).desc())
        .limit(10)
    )
    top_tenants_by_calls = [
        {"id": str(row.id), "name": row.name, "call_count": row.call_count}
        for row in top_by_calls_result.all()
    ]

    # Top tenants by conversion rate
    top_by_conversion_result = await db.execute(
        select(
            Organization.id,
            Organization.name,
            func.count(Lead.id).label("total_leads"),
            func.sum(case((Lead.status == "bound", 1), else_=0)).label("converted"),
        )
        .join(Lead, Lead.organization_id == Organization.id)
        .group_by(Organization.id, Organization.name)
        .having(func.count(Lead.id) >= 5)  # minimum sample size
        .order_by(
            (func.sum(case((Lead.status == "bound", 1), else_=0)) * 100.0 / func.count(Lead.id)).desc()
        )
        .limit(10)
    )
    top_tenants_by_conversion = [
        {
            "id": str(row.id),
            "name": row.name,
            "total_leads": row.total_leads,
            "converted": int(row.converted or 0),
            "conversion_rate": round((int(row.converted or 0) / row.total_leads * 100) if row.total_leads > 0 else 0, 1),
        }
        for row in top_by_conversion_result.all()
    ]

    return {
        "total_calls": total_calls,
        "total_leads": total_leads,
        "avg_call_duration": round(float(avg_duration or 0), 1),
        "conversion_rate": conversion_rate,
        "daily_call_volume": daily_call_volume,
        "tenant_growth": tenant_growth,
        "calls_by_status": calls_by_status,
        "tier_distribution": tier_distribution,
        "top_tenants_by_calls": top_tenants_by_calls,
        "top_tenants_by_conversion": top_tenants_by_conversion,
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
    "security": {
        "enforce_mfa": False,
        "ip_allowlist": False,
        "audit_log_retention": True,
    },
    "notifications": {
        "new_tenant_signup": True,
        "tenant_suspension": True,
        "platform_errors": True,
        "weekly_report": False,
    },
}


@router.get("/settings")
async def get_platform_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    org = await db.get(Organization, current_user.organization_id)
    if not org:
        return DEFAULT_PLATFORM_SETTINGS
    stored = (org.settings or {}).get("platform_settings")
    if not stored:
        return DEFAULT_PLATFORM_SETTINGS
    # Deep-merge: merge each sub-dict
    merged = {}
    for key, default_val in DEFAULT_PLATFORM_SETTINGS.items():
        if isinstance(default_val, dict):
            merged[key] = {**default_val, **(stored.get(key) or {})}
        else:
            merged[key] = stored.get(key, default_val)
    return merged


@router.patch("/settings")
async def update_platform_settings(
    body: PlatformSettingsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
):
    org = await db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    settings = dict(org.settings or {})
    existing = settings.get("platform_settings", {})

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(existing.get(key), dict):
            existing[key] = {**existing.get(key, {}), **value}
        else:
            existing[key] = value

    settings["platform_settings"] = existing
    org.settings = settings

    await _audit(db, user=current_user, action="settings.update", resource_type="platform_settings",
                 details=updates, ip_address=_client_ip(request))

    await db.flush()
    await db.commit()

    # Return the merged result
    merged = {}
    for key, default_val in DEFAULT_PLATFORM_SETTINGS.items():
        if isinstance(default_val, dict):
            merged[key] = {**default_val, **(existing.get(key) or {})}
        else:
            merged[key] = existing.get(key, default_val)
    return merged


# ── Audit Logs ────────────────────────────────────────────────────────


@router.get("/audit-logs")
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, superadmin],
    _rl: Annotated[None, admin_rate_limit],
    limit: int = 50,
    offset: int = 0,
):
    limit = _clamp_limit(limit)
    total = (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one()

    result = await db.execute(
        select(AuditLog, User.email.label("user_email"))
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()
    return {
        "items": [
            {
                "id": str(row.AuditLog.id),
                "action": row.AuditLog.action,
                "resource_type": row.AuditLog.resource_type,
                "resource_id": row.AuditLog.resource_id,
                "details": row.AuditLog.details,
                "user_email": row.user_email,
                "ip_address": row.AuditLog.ip_address,
                "created_at": row.AuditLog.created_at.isoformat(),
            }
            for row in rows
        ],
        "total": total,
    }
