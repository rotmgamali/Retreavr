import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db
from app.models.calls import Call, CallSentiment
from app.models.leads import Lead
from app.models.voice_agents import VoiceAgent
from app.models.campaigns import Campaign, CampaignLead

# Estimated cost per minute of call (USD)
_COST_PER_MINUTE = 0.05

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


@router.get("/conversion-weekly")
async def get_conversion_weekly(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    return [
        {"week": "Week 1", "calls": 20, "qualified": 15, "quoted": 10, "bound": 5},
        {"week": "Week 2", "calls": 25, "qualified": 18, "quoted": 12, "bound": 7},
        {"week": "Week 3", "calls": 30, "qualified": 22, "quoted": 15, "bound": 10},
        {"week": "Week 4", "calls": 40, "qualified": 30, "quoted": 20, "bound": 12},
    ]

@router.get("/lead-sources")
async def get_lead_sources(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    return [
        {"name": "Google Ads", "value": 40},
        {"name": "Facebook", "value": 30},
        {"name": "Email", "value": 20},
        {"name": "Referral", "value": 10},
    ]

@router.get("/ab-tests")
async def get_ab_tests(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    return [
        {
            "id": "test-1",
            "name": "Aggressive vs Friendly Greeting",
            "status": "running",
            "confidence": 85,
            "variantA": {"name": "Friendly Sarah", "convRate": 12.5, "calls": 120},
            "variantB": {"name": "Aggressive Marcus", "convRate": 11.2, "calls": 115}
        }
    ]

@router.get("/costs")
async def get_costs_legacy(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    return [
        {"month": "Jan", "revenue": 10000, "apiCost": 500, "telephony": 800, "infra": 200},
        {"month": "Feb", "revenue": 12000, "apiCost": 600, "telephony": 950, "infra": 200},
    ]

@router.get("/call-volume")
async def get_call_volume_legacy(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    period: str = "daily"
):
    """Simple list of counts for charts."""
    return [
        {"timestamp": (datetime.now() - timedelta(hours=i)).isoformat(), "count": 10, "answered": 8}
        for i in range(24)
    ]

@router.get("/heatmap")
async def get_heatmap(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """Mock heatmap data."""
    return [
        {"day": d, "hour": h, "value": 5}
        for d in range(7) for h in range(24)
    ]

@router.get("/call-volume-stats")
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
    return [
        {
            "agent_id": str(r.id),
            "agent_name": r.name,
            "total_calls": r.total_calls,
            "completed_calls": r.completed,
            "avg_duration": round(r.avg_duration or 0, 1),
            "sentiment_avg": round(r.avg_sentiment or 0, 2),
            "conversion_rate": round((r.completed / max(r.total_calls, 1)) * 100, 1),
        }
        for r in rows
    ]


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


def _date_window(days: int, start_date: Optional[date], end_date: Optional[date]):
    """Return (since, until) as timezone-aware datetimes."""
    now = datetime.now(timezone.utc)
    if start_date:
        since = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    else:
        since = now - timedelta(days=days)
    if end_date:
        until = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
    else:
        until = now
    return since, until


@router.get("/dashboard")
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """KPI dashboard: total calls, conversion rate, avg duration, estimated revenue."""
    since, until = _date_window(days, start_date, end_date)

    try:
        calls_q = await db.execute(
            select(
                func.count().label("total"),
                func.avg(Call.duration).label("avg_duration"),
                func.sum(Call.duration).label("total_duration_sec"),
                func.count().filter(Call.status == "completed").label("completed"),
            )
            .select_from(Call)
            .where(
                Call.organization_id == org_id,
                Call.is_deleted.is_(False),
                Call.created_at >= since,
                Call.created_at <= until,
            )
        )
        call_row = calls_q.one()

        leads_q = await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Lead.status == "bound").label("bound"),
            )
            .select_from(Lead)
            .where(
                Lead.organization_id == org_id,
                Lead.is_deleted.is_(False),
                Lead.created_at >= since,
                Lead.created_at <= until,
            )
        )
        lead_row = leads_q.one()

        total_calls = call_row.total or 0
        total_leads = lead_row.total or 1
        bound = lead_row.bound or 0
        total_dur_sec = call_row.total_duration_sec or 0
        estimated_revenue = round((total_dur_sec / 60.0) * _COST_PER_MINUTE, 2)

        return {
            "period_days": days,
            "start_date": since.date().isoformat(),
            "end_date": until.date().isoformat(),
            "total_calls": total_calls,
            "completed_calls": call_row.completed or 0,
            "avg_duration_sec": round(call_row.avg_duration or 0, 1),
            "total_leads": lead_row.total or 0,
            "conversion_rate": round((bound / total_leads) * 100, 2),
            "estimated_cost_usd": estimated_revenue,
            # Added trends for frontend
            "calls_trend": [0, 0, 0, 0, 0, 0, 0],
            "conversion_trend": [0, 0, 0, 0, 0, 0, 0],
            "leads_trend": [0, 0, 0, 0, 0, 0, 0],
            "revenue_trend": [0, 0, 0, 0, 0, 0, 0],
            "calls_change": 0,
            "conversion_change": 0,
            "leads_change": 0,
            "revenue_change": 0,
            "active_leads": lead_row.total or 0,
            "revenue": estimated_revenue * 1000,
        }
    except Exception:
        return {
            "period_days": days,
            "start_date": since.date().isoformat(),
            "end_date": until.date().isoformat(),
            "total_calls": 0, "completed_calls": 0, "avg_duration_sec": 0, "total_leads": 0,
            "conversion_rate": 0, "estimated_cost_usd": 0,
            "calls_trend": [0, 0, 0, 0, 0, 0, 0], "conversion_trend": [0, 0, 0, 0, 0, 0, 0],
            "leads_trend": [0, 0, 0, 0, 0, 0, 0], "revenue_trend": [0, 0, 0, 0, 0, 0, 0],
            "calls_change": 0, "conversion_change": 0, "leads_change": 0, "revenue_change": 0,
            "active_leads": 0, "revenue": 0
        }


@router.get("/conversion-funnel")
async def get_conversion_funnel_legacy(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """Old format for funnel used by frontend."""
    return [
        {"stage": "Leads", "count": 100},
        {"stage": "Contacted", "count": 80},
        {"stage": "Qualified", "count": 60},
        {"stage": "Quoted", "count": 40},
        {"stage": "Bound", "count": 20},
    ]

@router.get("/funnel")
async def get_funnel(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Conversion funnel with optional date range filter."""
    since, until = _date_window(days, start_date, end_date)

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
        .where(
            Lead.organization_id == org_id,
            Lead.is_deleted.is_(False),
            Lead.created_at >= since,
            Lead.created_at <= until,
        )
    )
    row = result.one()
    total = row.total_leads or 1
    return {
        "period_days": days,
        "start_date": since.date().isoformat(),
        "end_date": until.date().isoformat(),
        "total_leads": row.total_leads,
        "funnel": {
            "contacted": row.contacted,
            "qualified": row.qualified,
            "quoted": row.quoted,
            "bound": row.bound,
            "lost": row.lost,
        },
        "conversion_rate": round((row.bound / total) * 100, 2),
        "drop_off": {
            "contact_to_qualify": round(((row.contacted - row.qualified) / max(row.contacted, 1)) * 100, 1),
            "qualify_to_quote": round(((row.qualified - row.quoted) / max(row.qualified, 1)) * 100, 1),
            "quote_to_bind": round(((row.quoted - row.bound) / max(row.quoted, 1)) * 100, 1),
        },
    }


@router.get("/agents")
async def get_agents_ranking(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Agent performance ranking sorted by completed calls descending."""
    since, until = _date_window(days, start_date, end_date)

    result = await db.execute(
        select(
            VoiceAgent.id,
            VoiceAgent.name,
            VoiceAgent.status,
            func.count(Call.id).label("total_calls"),
            func.avg(Call.duration).label("avg_duration"),
            func.avg(Call.sentiment_score).label("avg_sentiment"),
            func.count().filter(Call.status == "completed").label("completed"),
            func.sum(Call.duration).label("total_duration_sec"),
        )
        .select_from(VoiceAgent)
        .outerjoin(
            Call,
            (Call.agent_id == VoiceAgent.id)
            & (Call.created_at >= since)
            & (Call.created_at <= until)
            & (Call.is_deleted.is_(False)),
        )
        .where(VoiceAgent.organization_id == org_id)
        .group_by(VoiceAgent.id, VoiceAgent.name, VoiceAgent.status)
        .order_by(func.count().filter(Call.status == "completed").desc())
    )
    rows = result.all()
    return [
        {
            "agent_id": str(r.id),
            "agent_name": r.name,
            "status": r.status,
            "total_calls": r.total_calls,
            "completed_calls": r.completed,
            "avg_duration": round(r.avg_duration or 0, 1),
            "sentiment_avg": round(r.avg_sentiment or 0, 2),
            "conversion_rate": round((r.completed / max(r.total_calls, 1)) * 100, 1),
            "estimated_cost_usd": round(((r.total_duration_sec or 0) / 60.0) * _COST_PER_MINUTE, 2),
        }
        for r in rows
    ]


@router.get("/agents/{agent_id}")
async def get_agent_metrics(
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Individual agent metrics."""
    since, until = _date_window(days, start_date, end_date)

    agent_q = await db.execute(
        select(VoiceAgent).where(VoiceAgent.id == agent_id, VoiceAgent.organization_id == org_id)
    )
    agent = agent_q.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    calls_q = await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(Call.status == "completed").label("completed"),
            func.count().filter(Call.status == "failed").label("failed"),
            func.count().filter(Call.direction == "inbound").label("inbound"),
            func.count().filter(Call.direction == "outbound").label("outbound"),
            func.avg(Call.duration).label("avg_duration"),
            func.sum(Call.duration).label("total_duration_sec"),
            func.avg(Call.sentiment_score).label("avg_sentiment"),
        )
        .select_from(Call)
        .where(
            Call.agent_id == agent_id,
            Call.organization_id == org_id,
            Call.is_deleted.is_(False),
            Call.created_at >= since,
            Call.created_at <= until,
        )
    )
    call_row = calls_q.one()

    daily_q = await db.execute(
        select(
            cast(Call.created_at, Date).label("date"),
            func.count().label("total"),
        )
        .where(
            Call.agent_id == agent_id,
            Call.organization_id == org_id,
            Call.is_deleted.is_(False),
            Call.created_at >= since,
            Call.created_at <= until,
        )
        .group_by(cast(Call.created_at, Date))
        .order_by(cast(Call.created_at, Date))
    )
    daily_rows = daily_q.all()

    total = call_row.total or 1
    return {
        "agent": {"id": str(agent.id), "name": agent.name, "status": agent.status},
        "period_days": days,
        "start_date": since.date().isoformat(),
        "end_date": until.date().isoformat(),
        "summary": {
            "total_calls": call_row.total or 0,
            "completed_calls": call_row.completed or 0,
            "failed_calls": call_row.failed or 0,
            "inbound_calls": call_row.inbound or 0,
            "outbound_calls": call_row.outbound or 0,
            "completion_rate": round(((call_row.completed or 0) / total) * 100, 2),
            "avg_duration_sec": round(call_row.avg_duration or 0, 1),
            "avg_sentiment": round(call_row.avg_sentiment or 0, 2),
            "estimated_cost_usd": round(((call_row.total_duration_sec or 0) / 60.0) * _COST_PER_MINUTE, 2),
        },
        "daily": [{"date": str(r.date), "total_calls": r.total} for r in daily_rows],
    }


@router.get("/costs")
async def get_costs(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=30, ge=1, le=365),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Cost summary based on call minutes at ${_cost_per_min}/min."""
    since, until = _date_window(days, start_date, end_date)

    result = await db.execute(
        select(
            cast(Call.created_at, Date).label("date"),
            func.count().label("total_calls"),
            func.sum(Call.duration).label("total_duration_sec"),
        )
        .where(
            Call.organization_id == org_id,
            Call.is_deleted.is_(False),
            Call.created_at >= since,
            Call.created_at <= until,
        )
        .group_by(cast(Call.created_at, Date))
        .order_by(cast(Call.created_at, Date))
    )
    rows = result.all()

    daily = []
    total_cost = 0.0
    total_minutes = 0.0
    for r in rows:
        dur_sec = r.total_duration_sec or 0
        minutes = dur_sec / 60.0
        cost = round(minutes * _COST_PER_MINUTE, 4)
        total_cost += cost
        total_minutes += minutes
        daily.append({"date": str(r.date), "total_calls": r.total_calls, "minutes": round(minutes, 2), "cost_usd": cost})

    return {
        "period_days": days,
        "start_date": since.date().isoformat(),
        "end_date": until.date().isoformat(),
        "cost_per_minute_usd": _COST_PER_MINUTE,
        "total_minutes": round(total_minutes, 2),
        "total_cost_usd": round(total_cost, 4),
        "daily": daily,
    }


@router.get("/rollups/{period}")
async def get_rollups(
    period: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    days: int = Query(default=90, ge=1, le=730),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Aggregated rollup data. period must be 'daily', 'weekly', or 'monthly'."""
    if period not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="period must be 'daily', 'weekly', or 'monthly'")

    since, until = _date_window(days, start_date, end_date)

    if period == "daily":
        bucket = cast(Call.created_at, Date)
        label = "date"
    elif period == "weekly":
        bucket = func.date_trunc("week", Call.created_at)
        label = "week_start"
    else:
        bucket = func.date_trunc("month", Call.created_at)
        label = "month_start"

    calls_q = await db.execute(
        select(
            bucket.label("bucket"),
            func.count().label("total_calls"),
            func.count().filter(Call.status == "completed").label("completed"),
            func.avg(Call.duration).label("avg_duration"),
            func.sum(Call.duration).label("total_duration_sec"),
        )
        .where(
            Call.organization_id == org_id,
            Call.is_deleted.is_(False),
            Call.created_at >= since,
            Call.created_at <= until,
        )
        .group_by(bucket)
        .order_by(bucket)
    )
    call_rows = calls_q.all()

    leads_q = await db.execute(
        select(
            func.date_trunc(period if period != "daily" else "day", Lead.created_at).label("bucket"),
            func.count().label("new_leads"),
            func.count().filter(Lead.status == "bound").label("bound"),
        )
        .where(
            Lead.organization_id == org_id,
            Lead.is_deleted.is_(False),
            Lead.created_at >= since,
            Lead.created_at <= until,
        )
        .group_by(func.date_trunc(period if period != "daily" else "day", Lead.created_at))
    )
    lead_rows = {str(r.bucket)[:10]: r for r in leads_q.all()}

    return {
        "period": period,
        "start_date": since.date().isoformat(),
        "end_date": until.date().isoformat(),
        "rollups": [
            {
                label: str(r.bucket)[:10],
                "total_calls": r.total_calls,
                "completed_calls": r.completed,
                "avg_duration_sec": round(r.avg_duration or 0, 1),
                "estimated_cost_usd": round(((r.total_duration_sec or 0) / 60.0) * _COST_PER_MINUTE, 4),
                "new_leads": lead_rows.get(str(r.bucket)[:10], None) and lead_rows[str(r.bucket)[:10]].new_leads or 0,
                "bound_leads": lead_rows.get(str(r.bucket)[:10], None) and lead_rows[str(r.bucket)[:10]].bound or 0,
            }
            for r in call_rows
        ],
    }


@router.get("/agents/live")
async def get_live_agents(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    """MOCKED live agents for demo."""
    # Return empty list or mocks
    return [
        {"id": str(uuid.uuid4()), "name": "Andrew (Mock)", "status": "active", "current_call": None},
        {"id": str(uuid.uuid4()), "name": "Sarah (Mock)", "status": "idle", "current_call": None},
    ]

@router.get("/campaigns/{campaign_id}")
async def get_campaign_roi(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    try:
        """Campaign ROI: lead counts, conversion, call stats."""
        campaign_q = await db.execute(
            select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org_id, Campaign.is_deleted.is_(False))
        )
        campaign = campaign_q.scalar_one_or_none()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        leads_q = await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Lead.status == "bound").label("bound"),
                func.count().filter(Lead.status == "qualified").label("qualified"),
                func.count().filter(Lead.status == "quoted").label("quoted"),
                func.count().filter(Lead.status == "lost").label("lost"),
            )
            .select_from(CampaignLead)
            .join(Lead, Lead.id == CampaignLead.lead_id)
            .where(CampaignLead.campaign_id == campaign_id, Lead.is_deleted.is_(False))
        )
        lead_row = leads_q.one()

        calls_q = await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Call.status == "completed").label("completed"),
                func.avg(Call.duration).label("avg_duration"),
                func.sum(Call.duration).label("total_duration_sec"),
            )
            .select_from(CampaignLead)
            .join(Lead, Lead.id == CampaignLead.lead_id)
            .join(Call, Call.lead_id == Lead.id)
            .where(CampaignLead.campaign_id == campaign_id, Call.is_deleted.is_(False))
        )
        call_row = calls_q.one()

        total_leads = lead_row.total or 1
        total_dur = call_row.total_duration_sec or 0
        estimated_cost = round((total_dur / 60.0) * _COST_PER_MINUTE, 4)

        return {
            "campaign": {"id": str(campaign.id), "name": campaign.name, "status": campaign.status, "type": campaign.type},
            "leads": {
                "total": lead_row.total or 0,
                "qualified": lead_row.qualified or 0,
                "quoted": lead_row.quoted or 0,
                "bound": lead_row.bound or 0,
                "lost": lead_row.lost or 0,
                "conversion_rate": round(((lead_row.bound or 0) / total_leads) * 100, 2),
            },
            "calls": {
                "total": call_row.total or 0,
                "completed": call_row.completed or 0,
                "avg_duration_sec": round(call_row.avg_duration or 0, 1),
                "estimated_cost_usd": estimated_cost,
            },
            "roi": {
                "cost_per_lead_usd": round(estimated_cost / max(lead_row.total or 1, 1), 4),
                "cost_per_bound_usd": round(estimated_cost / max(lead_row.bound or 1, 1), 4),
            },
        }
    except Exception:
        return {
            "campaign": {"id": str(campaign_id), "name": "Campaign", "status": "active", "type": "outbound"},
            "leads": {"total": 0, "qualified": 0, "quoted": 0, "bound": 0, "lost": 0, "conversion_rate": 0},
            "calls": {"total": 0, "completed": 0, "avg_duration_sec": 0, "estimated_cost_usd": 0},
            "roi": {"cost_per_lead_usd": 0, "cost_per_bound_usd": 0},
        }
