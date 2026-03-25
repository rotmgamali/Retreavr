from __future__ import annotations

"""Scoring aggregation: per-agent averages, trends, and comparisons."""

from collections import defaultdict
from datetime import date
from statistics import mean
from typing import Optional

from app.models.ai_schemas import CallScore, SentimentLabel, SentimentResult


# Sentiment label → numeric score for averaging (-1.0 to 1.0)
_SENTIMENT_SCORE: dict[SentimentLabel, float] = {
    SentimentLabel.SATISFIED: 1.0,
    SentimentLabel.POSITIVE: 0.75,
    SentimentLabel.INTERESTED: 0.5,
    SentimentLabel.NEUTRAL: 0.0,
    SentimentLabel.CONFUSED: -0.25,
    SentimentLabel.NEGATIVE: -0.75,
    SentimentLabel.FRUSTRATED: -1.0,
}


# ── Data containers ──────────────────────────────────────────────────────────

class AgentScoreAggregate:
    """Aggregated call scores for a single agent."""

    def __init__(self, agent_id: str) -> None:
        self.agent_id = agent_id
        self._scores: list[CallScore] = []

    def add(self, score: CallScore) -> None:
        self._scores.append(score)

    @property
    def call_count(self) -> int:
        return len(self._scores)

    @property
    def avg_total_score(self) -> float:
        if not self._scores:
            return 0.0
        return mean(s.total_score for s in self._scores)

    @property
    def avg_dimension_scores(self) -> dict[str, float]:
        """Return average score per dimension name across all calls."""
        dimension_totals: dict[str, list[float]] = defaultdict(list)
        for score in self._scores:
            for dim in score.dimensions:
                dimension_totals[dim.name].append(dim.score)
        return {name: mean(vals) for name, vals in dimension_totals.items()}

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "call_count": self.call_count,
            "avg_total_score": round(self.avg_total_score, 2),
            "avg_dimension_scores": {
                k: round(v, 2) for k, v in self.avg_dimension_scores.items()
            },
        }


class ScoreTrendPoint:
    """A single data point in a score trend series."""

    def __init__(self, period: date, avg_score: float, call_count: int) -> None:
        self.period = period
        self.avg_score = avg_score
        self.call_count = call_count

    def to_dict(self) -> dict:
        return {
            "period": self.period.isoformat(),
            "avg_score": round(self.avg_score, 2),
            "call_count": self.call_count,
        }


# ── Aggregation helpers ──────────────────────────────────────────────────────

def aggregate_agent_scores(
    scores_by_agent: dict[str, list[CallScore]],
) -> dict[str, AgentScoreAggregate]:
    """
    Compute per-agent score aggregates.

    Args:
        scores_by_agent: mapping of agent_id → list of CallScore objects.

    Returns:
        mapping of agent_id → AgentScoreAggregate.
    """
    result: dict[str, AgentScoreAggregate] = {}
    for agent_id, scores in scores_by_agent.items():
        agg = AgentScoreAggregate(agent_id)
        for score in scores:
            agg.add(score)
        result[agent_id] = agg
    return result


def build_score_trend(
    dated_scores: list[tuple[date, CallScore]],
) -> list[ScoreTrendPoint]:
    """
    Build a chronological trend of average call scores.

    Args:
        dated_scores: list of (call_date, CallScore) tuples, any order.

    Returns:
        List of ScoreTrendPoint sorted ascending by date.
    """
    by_date: dict[date, list[float]] = defaultdict(list)
    for call_date, score in dated_scores:
        by_date[call_date].append(score.total_score)

    return [
        ScoreTrendPoint(
            period=d,
            avg_score=mean(values),
            call_count=len(values),
        )
        for d in sorted(by_date)
        for values in [by_date[d]]
    ]


def compare_agents(
    aggregates: dict[str, AgentScoreAggregate],
) -> list[dict]:
    """
    Rank agents by average total score, highest first.

    Args:
        aggregates: output of aggregate_agent_scores.

    Returns:
        List of agent dicts with rank, sorted descending by avg_total_score.
    """
    ranked = sorted(
        aggregates.values(),
        key=lambda a: a.avg_total_score,
        reverse=True,
    )
    return [
        {"rank": idx + 1, **agg.to_dict()}
        for idx, agg in enumerate(ranked)
    ]


def sentiment_score_numeric(label: SentimentLabel) -> float:
    """Convert a SentimentLabel to a numeric score in [-1.0, 1.0]."""
    return _SENTIMENT_SCORE.get(label, 0.0)


def aggregate_sentiment_scores(
    results: list[SentimentResult],
) -> dict:
    """
    Summarise sentiment across a collection of calls.

    Returns a dict with:
        - overall_avg: float in [-1.0, 1.0]
        - label_distribution: {label: count}
        - customer_avg: float (customer segments only)
        - agent_avg: float (agent segments only)
    """
    all_scores: list[float] = []
    customer_scores: list[float] = []
    agent_scores: list[float] = []
    label_counts: dict[str, int] = defaultdict(int)

    for result in results:
        score = sentiment_score_numeric(result.overall_sentiment)
        all_scores.append(score)
        label_counts[result.overall_sentiment.value] += 1

        for seg in result.segments:
            seg_score = sentiment_score_numeric(seg.sentiment)
            if seg.speaker == "customer":
                customer_scores.append(seg_score)
            elif seg.speaker == "agent":
                agent_scores.append(seg_score)

    return {
        "overall_avg": round(mean(all_scores), 4) if all_scores else 0.0,
        "label_distribution": dict(label_counts),
        "customer_avg": round(mean(customer_scores), 4) if customer_scores else 0.0,
        "agent_avg": round(mean(agent_scores), 4) if agent_scores else 0.0,
        "call_count": len(results),
    }
