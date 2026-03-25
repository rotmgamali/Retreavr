"""Analytics aggregation and reporting.

Public surface:
    aggregations    — daily/weekly/monthly rollups
    conversion_funnel — stage-by-stage funnel analytics
    agent_performance — per-agent metrics
    cost_analytics  — OpenAI + Twilio cost tracking
    scoring_aggregation — call score aggregates and trends
"""

from app.services.analytics.agent_performance import get_agent_metrics, get_top_agents
from app.services.analytics.aggregations import (
    TimeGranularity,
    compute_conversion_funnel,
    compute_cost_metrics,
    get_daily_rollups,
    get_monthly_rollups,
    get_weekly_rollups,
)
from app.services.analytics.conversion_funnel import (
    build_funnel_from_counts,
    get_conversion_funnel,
)
from app.services.analytics.cost_analytics import (
    estimate_call_cost,
    get_cost_summary,
)
from app.services.analytics.scoring_aggregation import (
    aggregate_agent_scores,
    aggregate_sentiment_scores,
    build_score_trend,
    compare_agents,
)

__all__ = [
    # aggregations
    "TimeGranularity",
    "compute_conversion_funnel",
    "compute_cost_metrics",
    "get_daily_rollups",
    "get_weekly_rollups",
    "get_monthly_rollups",
    # conversion funnel
    "get_conversion_funnel",
    "build_funnel_from_counts",
    # agent performance
    "get_agent_metrics",
    "get_top_agents",
    # cost analytics
    "get_cost_summary",
    "estimate_call_cost",
    # scoring
    "aggregate_agent_scores",
    "aggregate_sentiment_scores",
    "build_score_trend",
    "compare_agents",
]
