"""Tests for analytics aggregation helpers (no-DB, in-memory paths)."""

import pytest
from datetime import date

from app.services.analytics.aggregations import (
    compute_conversion_funnel,
    compute_cost_metrics,
    FunnelStage,
)
from app.services.analytics.conversion_funnel import build_funnel_from_counts
from app.services.analytics.cost_analytics import estimate_call_cost
from app.models.analytics_schemas import FunnelStageName


# ---------------------------------------------------------------------------
# aggregations.compute_conversion_funnel
# ---------------------------------------------------------------------------

def test_compute_conversion_funnel_all_stages():
    counts = {
        "new_lead": 100,
        "contacted": 80,
        "qualified": 40,
        "quoted": 20,
        "bound": 10,
    }
    funnel = compute_conversion_funnel(counts)
    assert len(funnel) == 5
    assert funnel[0].name == "new_lead"
    assert funnel[0].count == 100
    assert funnel[0].conversion_from_previous == 100.0


def test_compute_conversion_funnel_drop_off_rate():
    counts = {"new_lead": 100, "contacted": 50, "qualified": 0, "quoted": 0, "bound": 0}
    funnel = compute_conversion_funnel(counts)
    contacted = next(f for f in funnel if f.name == "contacted")
    assert contacted.conversion_from_previous == pytest.approx(50.0, abs=0.1)


def test_compute_conversion_funnel_missing_stages():
    """Missing stages default to 0 without raising."""
    funnel = compute_conversion_funnel({})
    assert all(f.count == 0 for f in funnel)


# ---------------------------------------------------------------------------
# aggregations.compute_cost_metrics
# ---------------------------------------------------------------------------

def test_compute_cost_metrics_basic():
    result = compute_cost_metrics(openai_tokens=1000, twilio_minutes=10.0)
    assert result["openai_cost"] == pytest.approx(0.03, abs=0.001)
    assert result["twilio_cost"] == pytest.approx(0.14, abs=0.001)
    assert result["total_cost"] == pytest.approx(0.17, abs=0.001)


def test_compute_cost_metrics_zero_twilio():
    result = compute_cost_metrics(openai_tokens=0, twilio_minutes=0.0)
    assert result["total_cost"] == 0.0
    # cost_per_minute uses max(minutes, 0.01) to avoid divide-by-zero
    assert result["cost_per_minute"] >= 0.0


# ---------------------------------------------------------------------------
# conversion_funnel.build_funnel_from_counts
# ---------------------------------------------------------------------------

def test_build_funnel_from_counts_stages():
    funnel = build_funnel_from_counts({
        "initiated": 200,
        "connected": 150,
        "qualified": 80,
        "quoted": 40,
        "converted": 20,
    })
    assert len(funnel.stages) == 5
    assert funnel.stages[0].stage == FunnelStageName.INITIATED
    assert funnel.stages[0].count == 200


def test_build_funnel_overall_conversion_rate():
    funnel = build_funnel_from_counts({
        "initiated": 100,
        "connected": 80,
        "qualified": 40,
        "quoted": 20,
        "converted": 10,
    })
    assert funnel.overall_conversion_rate == pytest.approx(0.1, abs=0.001)


def test_build_funnel_drop_off():
    funnel = build_funnel_from_counts({
        "initiated": 100,
        "connected": 60,
        "qualified": 30,
        "quoted": 10,
        "converted": 5,
    })
    connected_stage = funnel.stages[1]
    assert connected_stage.drop_off == 40
    assert connected_stage.drop_off_rate == pytest.approx(0.4, abs=0.001)


def test_build_funnel_zero_initiated():
    """Zero initiated → overall conversion rate should be 0 (no divide-by-zero)."""
    funnel = build_funnel_from_counts({})
    assert funnel.overall_conversion_rate == 0.0


# ---------------------------------------------------------------------------
# cost_analytics.estimate_call_cost
# ---------------------------------------------------------------------------

def test_estimate_call_cost_basic():
    result = estimate_call_cost(
        openai_tokens_input=500,
        openai_tokens_output=500,
        twilio_minutes=5.0,
    )
    assert result["openai_cost_usd"] > 0
    assert result["twilio_cost_usd"] > 0
    assert result["total_cost_usd"] == pytest.approx(
        result["openai_cost_usd"] + result["twilio_cost_usd"], abs=1e-8
    )


def test_estimate_call_cost_zero():
    result = estimate_call_cost(0, 0, 0.0)
    assert result["total_cost_usd"] == 0.0


def test_estimate_call_cost_custom_pricing():
    result = estimate_call_cost(
        openai_tokens_input=1000,
        openai_tokens_output=0,
        twilio_minutes=0.0,
        openai_input_cost_per_1k=0.10,
    )
    assert result["openai_cost_usd"] == pytest.approx(0.10, abs=1e-6)
