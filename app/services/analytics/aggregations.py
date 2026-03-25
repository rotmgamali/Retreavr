from __future__ import annotations

"""Analytics aggregation queries for dashboard data.

Provides async functions for daily/weekly/monthly rollups over the
calls, leads, and campaign_results tables via SQLAlchemy text queries.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_schemas import DailyRollup, MonthlyRollup, WeeklyRollup


class TimeGranularity(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# ---------------------------------------------------------------------------
# In-memory helpers (no DB required)
# ---------------------------------------------------------------------------

@dataclass
class CallMetrics:
    total_calls: int
    avg_duration_seconds: float
    avg_score: float
    conversion_rate: float
    period_start: datetime
    period_end: datetime


@dataclass
class FunnelStage:
    name: str
    count: int
    conversion_from_previous: float


@dataclass
class AgentPerformanceMetrics:
    agent_id: str
    agent_name: str
    total_calls: int
    avg_score: float
    conversion_rate: float
    avg_call_duration: float
    total_revenue: float


def compute_conversion_funnel(stage_counts: dict[str, int]) -> list[FunnelStage]:
    """Compute conversion funnel from stage counts.

    Expected stages: new_lead -> contacted -> qualified -> quoted -> bound
    """
    ordered_stages = ["new_lead", "contacted", "qualified", "quoted", "bound"]
    funnel: list[FunnelStage] = []
    prev_count: Optional[int] = None

    for stage in ordered_stages:
        count = stage_counts.get(stage, 0)
        conversion = (count / prev_count * 100) if prev_count and prev_count > 0 else 100.0
        funnel.append(FunnelStage(
            name=stage,
            count=count,
            conversion_from_previous=round(conversion, 1),
        ))
        prev_count = count

    return funnel


def compute_cost_metrics(
    openai_tokens: int,
    twilio_minutes: float,
    openai_cost_per_1k_tokens: float = 0.03,
    twilio_cost_per_minute: float = 0.014,
) -> dict[str, float]:
    """Compute API cost breakdown."""
    openai_cost = (openai_tokens / 1000) * openai_cost_per_1k_tokens
    twilio_cost = twilio_minutes * twilio_cost_per_minute
    return {
        "openai_cost": round(openai_cost, 4),
        "twilio_cost": round(twilio_cost, 4),
        "total_cost": round(openai_cost + twilio_cost, 4),
        "cost_per_minute": round((openai_cost + twilio_cost) / max(twilio_minutes, 0.01), 4),
    }


# ---------------------------------------------------------------------------
# Async DB rollup queries
# ---------------------------------------------------------------------------

async def get_daily_rollups(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    organization_id: Optional[str] = None,
) -> list[DailyRollup]:
    """Fetch daily call and conversion rollups from the calls table.

    Args:
        db: Async SQLAlchemy session.
        start_date: Inclusive start of the period.
        end_date: Inclusive end of the period.
        organization_id: Filter to a specific org (optional).

    Returns:
        List of DailyRollup, one per calendar day in the range.
    """
    org_filter = "AND c.organization_id = :org_id" if organization_id else ""

    sql = text(f"""
        SELECT
            DATE(c.started_at)                            AS day,
            COUNT(*)                                      AS total_calls,
            COUNT(*) FILTER (WHERE c.status = 'completed') AS connected_calls,
            COUNT(DISTINCT lq.lead_id)
                FILTER (WHERE lq.is_qualified = TRUE)     AS qualified_leads,
            COUNT(DISTINCT l.id)
                FILTER (WHERE l.status = 'converted')     AS converted_leads,
            COALESCE(AVG(c.duration_seconds), 0)          AS avg_duration,
            COALESCE(
                SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0
            )                                             AS total_cost,
            COUNT(DISTINCT c.campaign_id)                 AS unique_campaigns
        FROM calls c
        LEFT JOIN leads l             ON l.id = c.lead_id
        LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
        LEFT JOIN call_costs cc       ON cc.call_id = c.id
        WHERE DATE(c.started_at) BETWEEN :start_date AND :end_date
        {org_filter}
        GROUP BY DATE(c.started_at)
        ORDER BY day ASC
    """)

    params: dict = {"start_date": start_date, "end_date": end_date}
    if organization_id:
        params["org_id"] = organization_id

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        DailyRollup(
            date=row.day,
            total_calls=row.total_calls,
            connected_calls=row.connected_calls,
            qualified_leads=row.qualified_leads,
            converted_leads=row.converted_leads,
            avg_call_duration_seconds=round(float(row.avg_duration), 1),
            total_cost_usd=round(float(row.total_cost), 4),
            unique_campaigns=row.unique_campaigns,
        )
        for row in rows
    ]


async def get_weekly_rollups(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    organization_id: Optional[str] = None,
) -> list[WeeklyRollup]:
    """Fetch weekly rollups grouped by ISO week."""
    org_filter = "AND c.organization_id = :org_id" if organization_id else ""

    sql = text(f"""
        SELECT
            DATE_TRUNC('week', c.started_at)::date         AS week_start,
            (DATE_TRUNC('week', c.started_at) + INTERVAL '6 days')::date AS week_end,
            COUNT(*)                                        AS total_calls,
            COUNT(*) FILTER (WHERE c.status = 'completed') AS connected_calls,
            COUNT(DISTINCT lq.lead_id)
                FILTER (WHERE lq.is_qualified = TRUE)       AS qualified_leads,
            COUNT(DISTINCT l.id)
                FILTER (WHERE l.status = 'converted')       AS converted_leads,
            COALESCE(AVG(c.duration_seconds), 0)            AS avg_duration,
            COALESCE(
                SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0
            )                                               AS total_cost
        FROM calls c
        LEFT JOIN leads l                ON l.id = c.lead_id
        LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
        LEFT JOIN call_costs cc          ON cc.call_id = c.id
        WHERE DATE(c.started_at) BETWEEN :start_date AND :end_date
        {org_filter}
        GROUP BY DATE_TRUNC('week', c.started_at)
        ORDER BY week_start ASC
    """)

    params: dict = {"start_date": start_date, "end_date": end_date}
    if organization_id:
        params["org_id"] = organization_id

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        WeeklyRollup(
            week_start=row.week_start,
            week_end=row.week_end,
            total_calls=row.total_calls,
            connected_calls=row.connected_calls,
            qualified_leads=row.qualified_leads,
            converted_leads=row.converted_leads,
            conversion_rate=round(
                row.converted_leads / max(row.total_calls, 1), 4
            ),
            avg_call_duration_seconds=round(float(row.avg_duration), 1),
            total_cost_usd=round(float(row.total_cost), 4),
        )
        for row in rows
    ]


async def get_monthly_rollups(
    db: AsyncSession,
    year: int,
    organization_id: Optional[str] = None,
) -> list[MonthlyRollup]:
    """Fetch monthly rollups for a given calendar year."""
    org_filter = "AND c.organization_id = :org_id" if organization_id else ""

    sql = text(f"""
        SELECT
            EXTRACT(YEAR  FROM c.started_at)::int AS yr,
            EXTRACT(MONTH FROM c.started_at)::int AS mo,
            COUNT(*)                                        AS total_calls,
            COUNT(*) FILTER (WHERE c.status = 'completed') AS connected_calls,
            COUNT(DISTINCT lq.lead_id)
                FILTER (WHERE lq.is_qualified = TRUE)       AS qualified_leads,
            COUNT(DISTINCT l.id)
                FILTER (WHERE l.status = 'converted')       AS converted_leads,
            COALESCE(AVG(c.duration_seconds), 0)            AS avg_duration,
            COALESCE(
                SUM(cc.openai_cost_usd + cc.twilio_cost_usd), 0
            )                                               AS total_cost,
            (
                SELECT va.id
                FROM voice_agents va
                JOIN calls c2 ON c2.voice_agent_id = va.id
                WHERE EXTRACT(YEAR FROM c2.started_at) = EXTRACT(YEAR FROM c.started_at)
                  AND EXTRACT(MONTH FROM c2.started_at) = EXTRACT(MONTH FROM c.started_at)
                GROUP BY va.id
                ORDER BY COUNT(*) DESC
                LIMIT 1
            ) AS top_agent_id
        FROM calls c
        LEFT JOIN leads l                ON l.id = c.lead_id
        LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
        LEFT JOIN call_costs cc          ON cc.call_id = c.id
        WHERE EXTRACT(YEAR FROM c.started_at) = :year
        {org_filter}
        GROUP BY yr, mo
        ORDER BY yr, mo ASC
    """)

    params: dict = {"year": year}
    if organization_id:
        params["org_id"] = organization_id

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        MonthlyRollup(
            year=row.yr,
            month=row.mo,
            total_calls=row.total_calls,
            connected_calls=row.connected_calls,
            qualified_leads=row.qualified_leads,
            converted_leads=row.converted_leads,
            conversion_rate=round(
                row.converted_leads / max(row.total_calls, 1), 4
            ),
            avg_call_duration_seconds=round(float(row.avg_duration), 1),
            total_cost_usd=round(float(row.total_cost), 4),
            top_agent_id=row.top_agent_id,
        )
        for row in rows
    ]
