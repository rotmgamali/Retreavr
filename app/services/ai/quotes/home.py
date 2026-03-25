from __future__ import annotations

"""Home insurance quote calculator."""

from app.models.ai_schemas import InsuranceType, PremiumBreakdown, QuoteRequest, QuoteResult
from app.services.ai.quotes.rate_tables import (
    HOME_AGE_FACTORS,
    HOME_BASE_RATE_PER_1000,
    HOME_CLAIMS_FACTORS,
    HOME_CONSTRUCTION_FACTORS,
    HOME_DEDUCTIBLE_FACTORS,
    RATE_TABLE_VERSION,
)


def _get_home_age_bracket(home_age: int) -> str:
    if home_age <= 5:
        return "0-5"
    elif home_age <= 15:
        return "6-15"
    elif home_age <= 30:
        return "16-30"
    elif home_age <= 50:
        return "31-50"
    return "51+"


def calculate_home_quote(request: QuoteRequest) -> QuoteResult:
    """Calculate home insurance premium."""
    property_value = request.property_value or 300000
    base = (property_value / 1000) * HOME_BASE_RATE_PER_1000

    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    # Construction type
    construction = request.construction_type or "frame"
    c_factor = HOME_CONSTRUCTION_FACTORS.get(construction, 1.0)
    if c_factor > 1.0:
        adjustments["construction_type"] = base * (c_factor - 1)
    elif c_factor < 1.0:
        discounts["construction_type"] = base * (1 - c_factor)

    # Home age
    home_age = request.home_age or 15
    h_bracket = _get_home_age_bracket(home_age)
    h_factor = HOME_AGE_FACTORS[h_bracket]
    if h_factor > 1.0:
        adjustments["home_age"] = base * (h_factor - 1)
    elif h_factor < 1.0:
        discounts["home_age"] = base * (1 - h_factor)

    # Claims history
    claims = min(request.claims_history or 0, 3)
    cl_factor = HOME_CLAIMS_FACTORS.get(claims, 1.75)
    if cl_factor > 1.0:
        adjustments["claims_history"] = base * (cl_factor - 1)

    # Deductible
    deductible = request.deductible or 1000
    closest = min(HOME_DEDUCTIBLE_FACTORS.keys(), key=lambda x: abs(x - deductible))
    d_factor = HOME_DEDUCTIBLE_FACTORS[closest]
    if d_factor > 1.0:
        adjustments["low_deductible"] = base * (d_factor - 1)
    elif d_factor < 1.0:
        discounts["high_deductible"] = base * (1 - d_factor)

    annual = base * c_factor * h_factor * cl_factor * d_factor
    annual = round(annual, 2)

    return QuoteResult(
        insurance_type=InsuranceType.HOME,
        monthly_premium=round(annual / 12, 2),
        annual_premium=annual,
        breakdown=PremiumBreakdown(
            base_premium=round(base, 2),
            adjustments=adjustments,
            discounts=discounts,
            total_premium=annual,
        ),
        coverage_details={
            "property_value": str(property_value),
            "construction_type": construction,
            "home_age_bracket": h_bracket,
            "deductible": str(closest),
        },
        rate_table_version=RATE_TABLE_VERSION,
    )
