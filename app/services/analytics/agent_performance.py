from __future__ import annotations

"""Per-agent performance metrics aggregation.

Aggregates call volume, conversion rates, average duration, lead scores,
and sentiment across a date range for each voice agent.
"""

from datetime import date
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_schemas import AgentMetrics


async def get_agent_metrics(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    agent_id: Optional[str] = None,
    organization_id: Optional[str] = None,
) -> list[AgentMetrics]:
    """Fetch per-agent performance metrics for a date range.

    Args:
        db: Async SQLAlchemy session.
        start_date: Inclusive start of the analysis window.
        end_date: Inclusive end of the analysis window.
        agent_id: Filter to a single agent (optional).
        organization_id: Filter to a specific org (optional).

    Returns:
        List of AgentMetrics, one row per voice agent.
    """
    filters = ["DATE(c.started_at) BETWEEN :start_date AND :end_date"]
    params: dict = {"start_date": start_date, "end_date": end_date}

    if agent_id:
        filters.append("c.voice_agent_id = :agent_id")
        params["agent_id"] = agent_id
    if organization_id:
        filters.append("c.organization_id = :org_id")
        params["org_id"] = organization_id

    where = " AND ".join(filters)

    sql = text(f"""
        SELECT
            va.id                                                    AS agent_id,
            va.name                                                  AS agent_name,
            COUNT(c.id)                                              AS total_calls,
            COUNT(c.id) FILTER (WHERE c.status = 'completed')       AS connected_calls,
            COALESCE(AVG(c.duration_seconds)
                FILTER (WHERE c.status = 'completed'), 0)           AS avg_duration,
            COALESCE(
                COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted')::float
                / NULLIF(COUNT(c.id), 0), 0
            )                                                        AS conversion_rate,
            COALESCE(
                COUNT(DISTINCT lq.lead_id) FILTER (WHERE lq.is_qualified = TRUE)::float
                / NULLIF(COUNT(c.id), 0), 0
            )                                                        AS qualification_rate,
            COALESCE(AVG(lq.lead_score), 0)                         AS avg_lead_score,
            AVG(cs.overall_sentiment_score)                         AS sentiment_score,
            COALESCE(
                SUM(cc.openai_cost_usd + cc.twilio_cost_usd)
                / NULLIF(COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted'), 0),
                NULL
            )                                                        AS cost_per_conversion
        FROM voice_agents va
        JOIN calls c                 ON c.voice_agent_id = va.id
        LEFT JOIN leads l            ON l.id = c.lead_id
        LEFT JOIN lead_qualifications lq ON lq.lead_id = c.lead_id
            AND lq.call_id = c.id
        LEFT JOIN call_sentiments cs ON cs.call_id = c.id
        LEFT JOIN call_costs cc      ON cc.call_id = c.id
        WHERE {where}
        GROUP BY va.id, va.name
        ORDER BY total_calls DESC
    """)

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        AgentMetrics(
            agent_id=row.agent_id,
            agent_name=row.agent_name,
            period_start=start_date,
            period_end=end_date,
            total_calls=row.total_calls,
            connected_calls=row.connected_calls,
            avg_call_duration_seconds=round(float(row.avg_duration), 1),
            conversion_rate=round(float(row.conversion_rate), 4),
            qualification_rate=round(float(row.qualification_rate), 4),
            avg_lead_score=round(float(row.avg_lead_score), 3),
            sentiment_score=(
                round(float(row.sentiment_score), 3)
                if row.sentiment_score is not None else None
            ),
            cost_per_conversion=(
                round(float(row.cost_per_conversion), 4)
                if row.cost_per_conversion is not None else None
            ),
        )
        for row in rows
    ]


async def get_top_agents(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    limit: int = 5,
    organization_id: Optional[str] = None,
) -> list[AgentMetrics]:
    """Return the top-N agents by conversion rate over the given period."""
    all_metrics = await get_agent_metrics(
        db, start_date, end_date, organization_id=organization_id
    )
    return sorted(all_metrics, key=lambda m: m.conversion_rate, reverse=True)[:limit]
