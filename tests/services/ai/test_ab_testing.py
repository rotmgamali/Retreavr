"""Tests for the A/B testing framework."""

import pytest

from app.services.ai.ab_testing import (
    assign_variant,
    calculate_conversion_rate_ci,
    calculate_significance,
    create_test,
    get_winning_variant,
    record_result,
)
from app.models.ai_schemas import ABTest, ABTestResult, ABTestVariant


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VARIANT_DEFS = [
    {"name": "control",   "prompt_template": "You are a helpful agent.",    "weight": 0.5},
    {"name": "treatment", "prompt_template": "You are an expert advisor.",  "weight": 0.5},
]


@pytest.fixture()
def fresh_test() -> ABTest:
    return create_test("Greeting Test", "Test opening greeting variants", VARIANT_DEFS)


# ---------------------------------------------------------------------------
# create_test
# ---------------------------------------------------------------------------

def test_create_test_returns_abtest(fresh_test):
    assert fresh_test.id
    assert fresh_test.name == "Greeting Test"
    assert len(fresh_test.variants) == 2
    assert fresh_test.status == "running"


def test_create_test_weights_normalized():
    test = create_test("W", "d", [
        {"name": "a", "prompt_template": "a", "weight": 2.0},
        {"name": "b", "prompt_template": "b", "weight": 2.0},
    ])
    total = sum(v.weight for v in test.variants)
    assert abs(total - 1.0) < 1e-6


def test_create_test_requires_two_variants():
    with pytest.raises(ValueError, match="at least 2 variants"):
        create_test("Bad", "d", [{"name": "only", "prompt_template": "x"}])


def test_create_test_initialises_empty_results(fresh_test):
    for result in fresh_test.results:
        assert result.total_trials == 0
        assert result.conversions == 0


# ---------------------------------------------------------------------------
# assign_variant
# ---------------------------------------------------------------------------

def test_assign_variant_returns_valid_variant(fresh_test):
    variant = assign_variant(fresh_test)
    variant_ids = {v.id for v in fresh_test.variants}
    assert variant.id in variant_ids


def test_assign_variant_raises_for_non_running_test(fresh_test):
    stopped = fresh_test.model_copy(update={"status": "completed"})
    with pytest.raises(ValueError, match="status 'completed'"):
        assign_variant(stopped)


def test_assign_variant_respects_weights():
    """Heavily skewed weights should produce mostly the heavy variant."""
    test = create_test("Skew", "d", [
        {"name": "heavy", "prompt_template": "h", "weight": 0.99},
        {"name": "light", "prompt_template": "l", "weight": 0.01},
    ])
    selections = [assign_variant(test).name for _ in range(300)]
    heavy_frac = selections.count("heavy") / len(selections)
    assert heavy_frac > 0.90


# ---------------------------------------------------------------------------
# record_result
# ---------------------------------------------------------------------------

def test_record_result_increments_trials(fresh_test):
    vid = fresh_test.variants[0].id
    updated = record_result(fresh_test, vid, converted=True)
    result = next(r for r in updated.results if r.variant_id == vid)
    assert result.total_trials == 1
    assert result.conversions == 1


def test_record_result_no_conversion(fresh_test):
    vid = fresh_test.variants[0].id
    updated = record_result(fresh_test, vid, converted=False)
    result = next(r for r in updated.results if r.variant_id == vid)
    assert result.conversions == 0
    assert result.total_trials == 1
    assert result.conversion_rate == 0.0


def test_record_result_rolling_duration(fresh_test):
    vid = fresh_test.variants[0].id
    t = record_result(fresh_test, vid, converted=False, call_duration_seconds=60.0)
    t = record_result(t,           vid, converted=False, call_duration_seconds=120.0)
    result = next(r for r in t.results if r.variant_id == vid)
    assert result.avg_call_duration == pytest.approx(90.0, abs=0.1)


def test_record_result_qualification_rate(fresh_test):
    vid = fresh_test.variants[0].id
    t = record_result(fresh_test, vid, converted=False, qualified=True)
    t = record_result(t,           vid, converted=False, qualified=False)
    result = next(r for r in t.results if r.variant_id == vid)
    assert result.avg_qualification_rate == pytest.approx(0.5, abs=0.01)


# ---------------------------------------------------------------------------
# calculate_significance
# ---------------------------------------------------------------------------

def test_significance_not_significant_with_few_trials():
    results = [
        ABTestResult(variant_id="a", conversions=5,  total_trials=10, conversion_rate=0.5),
        ABTestResult(variant_id="b", conversions=3,  total_trials=10, conversion_rate=0.3),
    ]
    is_sig, p = calculate_significance(results)
    # Not significant — too few trials
    assert not is_sig


def test_significance_detects_large_difference():
    """A 50% vs 5% conversion rate over 200 trials each should be significant."""
    results = [
        ABTestResult(variant_id="a", conversions=100, total_trials=200, conversion_rate=0.5),
        ABTestResult(variant_id="b", conversions=10,  total_trials=200, conversion_rate=0.05),
    ]
    is_sig, p = calculate_significance(results)
    assert is_sig
    assert p < 0.05


def test_significance_needs_at_least_two_variants():
    results = [ABTestResult(variant_id="a", conversions=10, total_trials=100, conversion_rate=0.1)]
    is_sig, p = calculate_significance(results)
    assert not is_sig
    assert p == 1.0


# ---------------------------------------------------------------------------
# calculate_conversion_rate_ci
# ---------------------------------------------------------------------------

def test_ci_zero_trials():
    rate, lo, hi = calculate_conversion_rate_ci(0, 0)
    assert rate == 0.0
    assert lo == 0.0
    assert hi == 0.0


def test_ci_bounds_are_within_zero_one():
    rate, lo, hi = calculate_conversion_rate_ci(50, 100)
    assert 0.0 <= lo <= rate <= hi <= 1.0


def test_ci_50_percent_rate():
    rate, lo, hi = calculate_conversion_rate_ci(50, 100)
    assert rate == pytest.approx(0.5, abs=0.01)
    assert lo < 0.5 < hi


# ---------------------------------------------------------------------------
# get_winning_variant
# ---------------------------------------------------------------------------

def test_get_winning_variant_returns_none_when_not_significant(fresh_test):
    assert get_winning_variant(fresh_test) is None


def test_get_winning_variant_returns_best_when_significant(fresh_test):
    v_a = fresh_test.variants[0]
    v_b = fresh_test.variants[1]
    updated = fresh_test.model_copy(update={
        "is_significant": True,
        "results": [
            ABTestResult(variant_id=v_a.id, conversions=90, total_trials=100, conversion_rate=0.9),
            ABTestResult(variant_id=v_b.id, conversions=10, total_trials=100, conversion_rate=0.1),
        ],
    })
    winner = get_winning_variant(updated)
    assert winner is not None
    assert winner.id == v_a.id
