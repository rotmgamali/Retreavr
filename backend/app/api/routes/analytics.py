import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db
from app.models.calls import Call, CallSentiment
from app.models.leads import Lead
from app.models.voice_agents import VoiceAgent
from app.models.campaigns import Campaign

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/conversion")
async def get_conversion_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
):
    """Lead conversion funnel metrics."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.count().label("total_leads"),
            func.count().filter(Lead.status == "contacted").label("contacted"),
            func.count().filter(Lead.status == "qualified").label("qualified"),
            func.count().filter(Lead.status == "quoted").label("quoted"),
            func.count().filter(Lead.status == "bound").label("bound"),
            func.count().filter(Lead.status == "lost").label("lost"),
        )
        .select_from(Lead)
        .where(Lead.organization_id == org_id, Lead.is_deleted.is_(False), Lead.created_at >= since)
    )
    row = result.one()
    total = row.total_leads or 1
    return {
        "period_days": days,
        "total_leads": row.total_leads,
        "funnel": {
            "contacted": row.contacted,
            "qualified": row.qualified,
            "quoted": row.quoted,
            "bound": row.bound,
            "lost": row.lost,
        },
        "conversion_rate": round((row.bound / total) * 100, 2) if total else 0,
    }


@router.get("/call-volume")
async def get_call_volume(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
):
    """Call volume grouped by day."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            cast(Call.created_at, Date).label("date"),
            func.count().label("total"),
            func.count().filter(Call.direction == "inbound").label("inbound"),
            func.count().filter(Call.direction == "outbound").label("outbound"),
            func.avg(Call.duration).label("avg_duration"),
        )
        .where(Call.organization_id == org_id, Call.is_deleted.is_(False), Call.created_at >= since)
        .group_by(cast(Call.created_at, Date))
        .order_by(cast(Call.created_at, Date))
    )
    rows = result.all()
    return {
        "period_days": days,
        "daily": [
            {
                "date": str(r.date),
                "total": r.total,
                "inbound": r.inbound,
                "outbound": r.outbound,
                "avg_duration_sec": round(r.avg_duration or 0, 1),
            }
            for r in rows
        ],
        "total_calls": sum(r.total for r in rows),
    }


@router.get("/agent-performance")
async def get_agent_performance(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
):
    """Per-voice-agent performance metrics."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            VoiceAgent.id,
            VoiceAgent.name,
            func.count(Call.id).label("total_calls"),
            func.avg(Call.duration).label("avg_duration"),
            func.avg(Call.sentiment_score).label("avg_sentiment"),
            func.count().filter(Call.status == "completed").label("completed"),
        )
        .select_from(VoiceAgent)
        .outerjoin(Call, (Call.agent_id == VoiceAgent.id) & (Call.created_at >= since) & (Call.is_deleted.is_(False)))
        .where(VoiceAgent.organization_id == org_id)
        .group_by(VoiceAgent.id, VoiceAgent.name)
    )
    rows = result.all()
    return {
        "period_days": days,
        "agents": [
            {
                "id": str(r.id),
                "name": r.name,
                "total_calls": r.total_calls,
                "completed_calls": r.completed,
                "avg_duration_sec": round(r.avg_duration or 0, 1),
                "avg_sentiment": round(r.avg_sentiment or 0, 2),
            }
            for r in rows
        ],
    }


@router.get("/overview")
async def get_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """High-level KPI snapshot."""
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    leads_q = await db.execute(
        select(func.count()).select_from(Lead).where(Lead.organization_id == org_id, Lead.is_deleted.is_(False))
    )
    total_leads = leads_q.scalar_one()

    calls_q = await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(Call.created_at >= month_ago).label("this_month"),
        )
        .select_from(Call)
        .where(Call.organization_id == org_id, Call.is_deleted.is_(False))
    )
    call_row = calls_q.one()

    agents_q = await db.execute(
        select(func.count()).select_from(VoiceAgent).where(VoiceAgent.organization_id == org_id, VoiceAgent.status == "active")
    )
    active_agents = agents_q.scalar_one()

    campaigns_q = await db.execute(
        select(func.count()).select_from(Campaign).where(Campaign.organization_id == org_id, Campaign.status == "active", Campaign.is_deleted.is_(False))
    )
    active_campaigns = campaigns_q.scalar_one()

    return {
        "total_leads": total_leads,
        "total_calls": call_row.total,
        "calls_this_month": call_row.this_month,
        "active_agents": active_agents,
        "active_campaigns": active_campaigns,
    }
