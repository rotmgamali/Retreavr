from __future__ import annotations

"""Auto insurance quote calculator."""

from datetime import datetime

from app.models.ai_schemas import InsuranceType, PremiumBreakdown, QuoteRequest, QuoteResult
from app.services.ai.quotes.rate_tables import (
    AUTO_BASE_RATES,
    AUTO_COVERAGE_FACTORS,
    AUTO_DEDUCTIBLE_FACTORS,
    AUTO_DRIVING_RECORD_FACTORS,
    AUTO_VEHICLE_AGE_FACTORS,
    RATE_TABLE_VERSION,
)


def _get_age_bracket(age: int) -> str:
    if age <= 25:
        return "16-25"
    elif age <= 35:
        return "26-35"
    elif age <= 45:
        return "36-45"
    elif age <= 55:
        return "46-55"
    elif age <= 65:
        return "56-65"
    return "66+"


def _get_vehicle_age_bracket(vehicle_year: int) -> str:
    vehicle_age = datetime.now().year - vehicle_year
    if vehicle_age <= 2:
        return "0-2"
    elif vehicle_age <= 5:
        return "3-5"
    elif vehicle_age <= 10:
        return "6-10"
    return "11+"


def calculate_auto_quote(request: QuoteRequest) -> QuoteResult:
    """Calculate auto insurance premium."""
    age = request.age or 35
    age_bracket = _get_age_bracket(age)
    base = AUTO_BASE_RATES[age_bracket]

    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    # Driving record
    record = request.driving_record or "clean"
    record_factor = AUTO_DRIVING_RECORD_FACTORS.get(record, 1.0)
    if record_factor != 1.0:
        adjustments["driving_record"] = base * (record_factor - 1)

    # Vehicle age
    if request.vehicle_year:
        v_bracket = _get_vehicle_age_bracket(request.vehicle_year)
        v_factor = AUTO_VEHICLE_AGE_FACTORS[v_bracket]
        if v_factor > 1.0:
            adjustments["vehicle_age"] = base * (v_factor - 1)
        elif v_factor < 1.0:
            discounts["vehicle_age"] = base * (1 - v_factor)

    # Deductible
    deductible = request.deductible or 500
    closest_deductible = min(AUTO_DEDUCTIBLE_FACTORS.keys(), key=lambda x: abs(x - deductible))
    d_factor = AUTO_DEDUCTIBLE_FACTORS[closest_deductible]
    if d_factor > 1.0:
        adjustments["low_deductible"] = base * (d_factor - 1)
    elif d_factor < 1.0:
        discounts["high_deductible"] = base * (1 - d_factor)

    # Calculate total
    total_adjustments = sum(adjustments.values())
    total_discounts = sum(discounts.values())
    annual = base * record_factor
    if request.vehicle_year:
        annual *= AUTO_VEHICLE_AGE_FACTORS[_get_vehicle_age_bracket(request.vehicle_year)]
    annual *= d_factor

    annual = round(annual, 2)

    return QuoteResult(
        insurance_type=InsuranceType.AUTO,
        monthly_premium=round(annual / 12, 2),
        annual_premium=annual,
        breakdown=PremiumBreakdown(
            base_premium=base,
            adjustments=adjustments,
            discounts=discounts,
            total_premium=annual,
        ),
        coverage_details={
            "age_bracket": age_bracket,
            "driving_record": record,
            "deductible": str(closest_deductible),
        },
        rate_table_version=RATE_TABLE_VERSION,
    )
