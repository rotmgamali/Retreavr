"""Unit tests for lead auto-qualification scoring."""

from datetime import datetime, timedelta

import pytest

from app.models.ai_schemas import ExtractedInsuranceData, InsuranceType, LeadScore
from app.services.ai.lead_scoring import score_lead


def _data(**kwargs) -> ExtractedInsuranceData:
    return ExtractedInsuranceData(**kwargs)


def test_score_lead_returns_lead_score():
    data = _data(policy_type=InsuranceType.AUTO)
    result = score_lead("lead-001", data)
    assert isinstance(result, LeadScore)
    assert result.lead_id == "lead-001"
    assert 0.0 <= result.score <= 1.0


def test_score_hot_lead():
    """Full data + near renewal should produce a hot lead (>= 0.7)."""
    renewal = (datetime.utcnow() + timedelta(days=15)).strftime("%Y-%m-%d")
    data = _data(
        policy_type=InsuranceType.HOME,
        coverage_amount=600000,
        deductible=2500,
        current_carrier="Allstate",
        renewal_date=renewal,
        age=45,
        zip_code="10001",
    )
    result = score_lead("lead-hot", data)
    assert result.score >= 0.7
    assert "Hot lead" in result.recommendation


def test_score_cold_lead():
    """No data should produce a cold lead (< 0.4)."""
    result = score_lead("lead-cold", _data())
    assert result.score < 0.4
    assert "Cold lead" in result.recommendation


def test_score_warm_lead():
    """Partial data should yield a warm lead (0.4-0.7)."""
    data = _data(
        policy_type=InsuranceType.AUTO,
        current_carrier="Progressive",
        age=30,
        zip_code="90210",
    )
    result = score_lead("lead-warm", data)
    assert 0.4 <= result.score < 0.7
    assert "Warm lead" in result.recommendation


def test_near_renewal_within_30_days_maxes_factor():
    renewal = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d")
    data = _data(renewal_date=renewal)
    result = score_lead("lead-r30", data)
    assert result.factors["near_renewal"] == 1.0


def test_near_renewal_31_to_60_days_partial():
    renewal = (datetime.utcnow() + timedelta(days=45)).strftime("%Y-%m-%d")
    data = _data(renewal_date=renewal)
    result = score_lead("lead-r60", data)
    assert result.factors["near_renewal"] == 0.7


def test_near_renewal_61_to_90_days():
    renewal = (datetime.utcnow() + timedelta(days=75)).strftime("%Y-%m-%d")
    data = _data(renewal_date=renewal)
    result = score_lead("lead-r90", data)
    assert result.factors["near_renewal"] == 0.4


def test_high_coverage_tiers():
    assert score_lead("l", _data(coverage_amount=600000)).factors["high_coverage"] == 1.0
    assert score_lead("l", _data(coverage_amount=300000)).factors["high_coverage"] == 0.7
    assert score_lead("l", _data(coverage_amount=150000)).factors["high_coverage"] == 0.4
    assert score_lead("l", _data(coverage_amount=50000)).factors["high_coverage"] == 0.0


def test_data_completeness_all_fields():
    renewal = (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%d")
    data = _data(
        policy_type=InsuranceType.LIFE,
        coverage_amount=250000,
        deductible=500,
        current_carrier="MetLife",
        renewal_date=renewal,
        age=38,
        zip_code="60601",
    )
    result = score_lead("lead-full", data)
    assert result.factors["data_completeness"] == 1.0


def test_invalid_renewal_date_does_not_raise():
    data = _data(renewal_date="not-a-date")
    result = score_lead("lead-bad-date", data)
    assert result.factors["near_renewal"] == 0.0


def test_score_factors_sum_to_at_most_one():
    """Weighted factor sum must never exceed 1.0."""
    renewal = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d")
    data = _data(
        policy_type=InsuranceType.AUTO,
        coverage_amount=1000000,
        deductible=500,
        current_carrier="USAA",
        renewal_date=renewal,
        age=50,
        zip_code="20001",
    )
    result = score_lead("lead-max", data)
    assert result.score <= 1.0
