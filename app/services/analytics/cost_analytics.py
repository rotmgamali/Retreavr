from __future__ import annotations

"""API cost tracking: OpenAI tokens and Twilio minutes.

Aggregates per-call API costs from the call_costs table into daily
CostRecord summaries, with configurable price-per-unit overrides.
"""

from datetime import date
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_schemas import CostRecord, CostSummary

# Default pricing (overridable via function args)
_OPENAI_INPUT_COST_PER_1K = 0.01    # GPT-4o input $/1K tokens
_OPENAI_OUTPUT_COST_PER_1K = 0.03   # GPT-4o output $/1K tokens
_TWILIO_COST_PER_MINUTE = 0.014     # Twilio Programmable Voice $/min


async def get_cost_summary(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    organization_id: Optional[str] = None,
    openai_input_cost_per_1k: float = _OPENAI_INPUT_COST_PER_1K,
    openai_output_cost_per_1k: float = _OPENAI_OUTPUT_COST_PER_1K,
    twilio_cost_per_minute: float = _TWILIO_COST_PER_MINUTE,
) -> CostSummary:
    """Aggregate daily API costs for the given period.

    Reads from the call_costs table which is expected to have columns:
      call_id, date, openai_tokens_input, openai_tokens_output,
      openai_cost_usd, twilio_minutes, twilio_cost_usd

    Falls back to computing costs from token/minute counts when pre-computed
    cost columns are zero (supports both pre-computed and raw-count schemas).

    Args:
        db: Async SQLAlchemy session.
        start_date: Inclusive start of the period.
        end_date: Inclusive end of the period.
        organization_id: Optional org filter.
        openai_input_cost_per_1k: Cost per 1K input tokens in USD.
        openai_output_cost_per_1k: Cost per 1K output tokens in USD.
        twilio_cost_per_minute: Cost per Twilio minute in USD.

    Returns:
        CostSummary with a CostRecord per day plus period totals.
    """
    org_filter = "AND c.organization_id = :org_id" if organization_id else ""
    params: dict = {
        "start_date": start_date,
        "end_date": end_date,
        "inp_cost": openai_input_cost_per_1k / 1000.0,
        "out_cost": openai_output_cost_per_1k / 1000.0,
        "twilio_cost": twilio_cost_per_minute,
    }
    if organization_id:
        params["org_id"] = organization_id

    sql = text(f"""
        SELECT
            DATE(c.started_at)                                      AS day,
            COALESCE(SUM(cc.openai_tokens_input),  0)::bigint       AS tokens_in,
            COALESCE(SUM(cc.openai_tokens_output), 0)::bigint       AS tokens_out,
            COALESCE(SUM(
                CASE WHEN cc.openai_cost_usd > 0
                     THEN cc.openai_cost_usd
                     ELSE (cc.openai_tokens_input  * :inp_cost
                         + cc.openai_tokens_output * :out_cost)
                END
            ), 0)                                                    AS openai_cost,
            COALESCE(SUM(cc.twilio_minutes), 0)                     AS twilio_minutes,
            COALESCE(SUM(
                CASE WHEN cc.twilio_cost_usd > 0
                     THEN cc.twilio_cost_usd
                     ELSE cc.twilio_minutes * :twilio_cost
                END
            ), 0)                                                    AS twilio_cost,
            COUNT(DISTINCT c.id)                                     AS calls_count
        FROM calls c
        JOIN call_costs cc ON cc.call_id = c.id
        WHERE DATE(c.started_at) BETWEEN :start_date AND :end_date
        {org_filter}
        GROUP BY DATE(c.started_at)
        ORDER BY day ASC
    """)

    result = await db.execute(sql, params)
    rows = result.fetchall()

    records: list[CostRecord] = []
    for row in rows:
        openai_cost = round(float(row.openai_cost), 4)
        twilio_cost = round(float(row.twilio_cost), 4)
        total = round(openai_cost + twilio_cost, 4)
        calls = int(row.calls_count)

        records.append(CostRecord(
            date=row.day,
            openai_tokens_input=int(row.tokens_in),
            openai_tokens_output=int(row.tokens_out),
            openai_cost_usd=openai_cost,
            twilio_minutes=round(float(row.twilio_minutes), 2),
            twilio_cost_usd=twilio_cost,
            total_cost_usd=total,
            calls_count=calls,
            cost_per_call=round(total / calls, 4) if calls > 0 else None,
        ))

    total_openai = round(sum(r.openai_cost_usd for r in records), 4)
    total_twilio = round(sum(r.twilio_cost_usd for r in records), 4)
    total_cost = round(total_openai + total_twilio, 4)
    total_calls = sum(r.calls_count for r in records)

    return CostSummary(
        period_start=start_date,
        period_end=end_date,
        records=records,
        total_openai_cost_usd=total_openai,
        total_twilio_cost_usd=total_twilio,
        total_cost_usd=total_cost,
        total_calls=total_calls,
        avg_cost_per_call=(
            round(total_cost / total_calls, 4) if total_calls > 0 else None
        ),
    )


def estimate_call_cost(
    openai_tokens_input: int,
    openai_tokens_output: int,
    twilio_minutes: float,
    openai_input_cost_per_1k: float = _OPENAI_INPUT_COST_PER_1K,
    openai_output_cost_per_1k: float = _OPENAI_OUTPUT_COST_PER_1K,
    twilio_cost_per_minute: float = _TWILIO_COST_PER_MINUTE,
) -> dict[str, float]:
    """Estimate cost for a single call given token and minute counts.

    Useful for real-time cost projection during an active call.

    Returns:
        Dict with openai_cost, twilio_cost, total_cost (all in USD).
    """
    openai_cost = (
        openai_tokens_input * openai_input_cost_per_1k / 1000
        + openai_tokens_output * openai_output_cost_per_1k / 1000
    )
    twilio_cost = twilio_minutes * twilio_cost_per_minute
    return {
        "openai_cost_usd": round(openai_cost, 6),
        "twilio_cost_usd": round(twilio_cost, 6),
        "total_cost_usd": round(openai_cost + twilio_cost, 6),
    }
