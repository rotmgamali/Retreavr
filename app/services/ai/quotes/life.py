from __future__ import annotations

"""Life insurance quote calculator."""

from app.models.ai_schemas import InsuranceType, PremiumBreakdown, QuoteRequest, QuoteResult
from app.services.ai.quotes.rate_tables import (
    LIFE_BASE_RATES,
    LIFE_HEALTH_CLASS_FACTORS,
    LIFE_NO_TOBACCO_FACTOR,
    LIFE_TERM_FACTORS,
    LIFE_TOBACCO_FACTOR,
    RATE_TABLE_VERSION,
)


def _get_life_age_bracket(age: int) -> str:
    if age < 20:
        return "20-29"
    elif age <= 29:
        return "20-29"
    elif age <= 39:
        return "30-39"
    elif age <= 49:
        return "40-49"
    elif age <= 59:
        return "50-59"
    elif age <= 69:
        return "60-69"
    return "70+"


def calculate_life_quote(request: QuoteRequest) -> QuoteResult:
    """Calculate life insurance premium."""
    age = request.age or 35
    gender = request.gender or "male"
    coverage = request.coverage_amount or 500000
    term = request.term_years or 20

    age_bracket = _get_life_age_bracket(age)
    rate_key = (age_bracket, gender)
    base_rate = LIFE_BASE_RATES.get(rate_key, LIFE_BASE_RATES[("40-49", "male")])
    base = (coverage / 1000) * base_rate

    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    # Tobacco
    tobacco = request.tobacco_status or False
    t_factor = LIFE_TOBACCO_FACTOR if tobacco else LIFE_NO_TOBACCO_FACTOR
    if tobacco:
        adjustments["tobacco_surcharge"] = base * (t_factor - 1)

    # Health class
    health = request.health_class or "standard"
    hc_factor = LIFE_HEALTH_CLASS_FACTORS.get(health, 1.0)
    if hc_factor > 1.0:
        adjustments["health_class"] = base * (hc_factor - 1)
    elif hc_factor < 1.0:
        discounts["health_class"] = base * (1 - hc_factor)

    # Term length
    closest_term = min(LIFE_TERM_FACTORS.keys(), key=lambda x: abs(x - term))
    term_factor = LIFE_TERM_FACTORS[closest_term]
    if term_factor > 1.0:
        adjustments["long_term"] = base * (term_factor - 1)
    elif term_factor < 1.0:
        discounts["short_term"] = base * (1 - term_factor)

    annual = base * t_factor * hc_factor * term_factor
    annual = round(annual, 2)

    return QuoteResult(
        insurance_type=InsuranceType.LIFE,
        monthly_premium=round(annual / 12, 2),
        annual_premium=annual,
        breakdown=PremiumBreakdown(
            base_premium=round(base, 2),
            adjustments=adjustments,
            discounts=discounts,
            total_premium=annual,
        ),
        coverage_details={
            "age_bracket": age_bracket,
            "gender": gender,
            "coverage_amount": str(coverage),
            "term_years": str(closest_term),
            "tobacco": str(tobacco),
            "health_class": health,
        },
        rate_table_version=RATE_TABLE_VERSION,
    )
