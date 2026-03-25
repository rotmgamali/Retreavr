from __future__ import annotations

"""Conversion funnel analytics: stage-by-stage tracking.

Tracks the lead lifecycle through these stages:
  initiated → connected → qualified → quoted → converted

Each stage count is derived from the calls, leads, and lead_qualifications
tables. Drop-off and rate are computed between adjacent stages.
"""

from datetime import date
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_schemas import (
    ConversionFunnel,
    FunnelStage,
    FunnelStageName,
)

# Ordered funnel stages
_STAGE_ORDER = [
    FunnelStageName.INITIATED,
    FunnelStageName.CONNECTED,
    FunnelStageName.QUALIFIED,
    FunnelStageName.QUOTED,
    FunnelStageName.CONVERTED,
]


async def get_conversion_funnel(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    campaign_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    organization_id: Optional[str] = None,
) -> ConversionFunnel:
    """Build a stage-by-stage conversion funnel for a given period.

    Args:
        db: Async SQLAlchemy session.
        start_date: Inclusive start of the analysis window.
        end_date: Inclusive end of the analysis window.
        campaign_id: Optional filter by campaign.
        agent_id: Optional filter by voice agent.
        organization_id: Optional filter by org.

    Returns:
        ConversionFunnel with per-stage counts and drop-off rates.
    """
    filters = ["DATE(c.started_at) BETWEEN :start_date AND :end_date"]
    params: dict = {"start_date": start_date, "end_date": end_date}

    if campaign_id:
        filters.append("c.campaign_id = :campaign_id")
        params["campaign_id"] = campaign_id
    if agent_id:
        filters.append("c.voice_agent_id = :agent_id")
        params["agent_id"] = agent_id
    if organization_id:
        filters.append("c.organization_id = :org_id")
        params["org_id"] = organization_id

    where = " AND ".join(filters)

    sql = text(f"""
        WITH base AS (
            SELECT
                c.id            AS call_id,
                c.lead_id,
                c.status        AS call_status,
                c.duration_seconds,
                lq.is_qualified,
                lq.quote_generated,
                l.status        AS lead_status
            FROM calls c
            LEFT JOIN leads l                ON l.id = c.lead_id
            LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
                AND lq.call_id = c.id
            WHERE {where}
        )
        SELECT
            COUNT(*)                                                AS initiated,
            COUNT(*) FILTER (WHERE call_status = 'completed')      AS connected,
            COUNT(*) FILTER (WHERE is_qualified = TRUE)            AS qualified,
            COUNT(*) FILTER (WHERE quote_generated = TRUE)         AS quoted,
            COUNT(*) FILTER (WHERE lead_status   = 'converted')    AS converted,
            COALESCE(AVG(duration_seconds)
                FILTER (WHERE call_status = 'completed'), 0)       AS avg_connected_duration
        FROM base
    """)

    result = await db.execute(sql, params)
    row = result.fetchone()

    counts = {
        FunnelStageName.INITIATED: int(row.initiated or 0),
        FunnelStageName.CONNECTED: int(row.connected or 0),
        FunnelStageName.QUALIFIED: int(row.qualified or 0),
        FunnelStageName.QUOTED:    int(row.quoted or 0),
        FunnelStageName.CONVERTED: int(row.converted or 0),
    }

    avg_connected_duration = float(row.avg_connected_duration or 0)

    stages: list[FunnelStage] = []
    prev_count: Optional[int] = None

    for stage_name in _STAGE_ORDER:
        count = counts[stage_name]
        drop_off = (prev_count - count) if prev_count is not None else 0
        drop_off_rate = (drop_off / prev_count) if prev_count and prev_count > 0 else 0.0

        stages.append(FunnelStage(
            stage=stage_name,
            count=count,
            drop_off=max(drop_off, 0),
            drop_off_rate=round(max(drop_off_rate, 0.0), 4),
            avg_duration_seconds=(
                round(avg_connected_duration, 1)
                if stage_name == FunnelStageName.CONNECTED
                else None
            ),
        ))
        prev_count = count

    overall_rate = round(
        counts[FunnelStageName.CONVERTED] / max(counts[FunnelStageName.INITIATED], 1), 4
    )

    return ConversionFunnel(
        period_start=start_date,
        period_end=end_date,
        stages=stages,
        overall_conversion_rate=overall_rate,
        campaign_id=campaign_id,
        agent_id=agent_id,
    )


def build_funnel_from_counts(stage_counts: dict[str, int]) -> ConversionFunnel:
    """Build a ConversionFunnel from pre-aggregated stage count dict (no DB).

    Useful for testing and for building funnels from cached data.

    Args:
        stage_counts: Keys are stage names (initiated, connected, qualified,
                      quoted, converted), values are counts.

    Returns:
        ConversionFunnel (dates will be set to today).
    """
    from datetime import date as date_type

    today = date_type.today()
    counts = {s: stage_counts.get(s.value, 0) for s in _STAGE_ORDER}

    stages: list[FunnelStage] = []
    prev: Optional[int] = None

    for stage_name in _STAGE_ORDER:
        count = counts[stage_name]
        drop_off = (prev - count) if prev is not None else 0
        drop_off_rate = (drop_off / prev) if prev and prev > 0 else 0.0

        stages.append(FunnelStage(
            stage=stage_name,
            count=count,
            drop_off=max(drop_off, 0),
            drop_off_rate=round(max(drop_off_rate, 0.0), 4),
        ))
        prev = count

    overall_rate = round(
        counts[FunnelStageName.CONVERTED] / max(counts[FunnelStageName.INITIATED], 1), 4
    )

    return ConversionFunnel(
        period_start=today,
        period_end=today,
        stages=stages,
        overall_conversion_rate=overall_rate,
    )
