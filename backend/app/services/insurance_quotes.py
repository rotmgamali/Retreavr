"""Insurance quote calculation service.

Self-contained quote engine for the backend API and voice tool pipeline.
Rate tables and calculation logic mirror the AI analytics layer in app/services/ai/quotes/.
"""

from __future__ import annotations

from datetime import datetime

from app.schemas.quotes import BundleQuoteResult, PremiumBreakdown, QuoteRequest, QuoteResult

# ---------------------------------------------------------------------------
# Rate tables
#
# TODO: These rate tables are hardcoded for now. They should eventually be
# moved to org-level configuration so each tenant can manage their own
# rates, factors, and discounts via the admin panel or API.
# ---------------------------------------------------------------------------

RATE_TABLE_VERSION = "2026-Q1-v1"

# Auto
_AUTO_BASE_RATES = {
    "16-25": 2400,
    "26-35": 1600,
    "36-45": 1400,
    "46-55": 1350,
    "56-65": 1500,
    "66+": 1800,
}
_AUTO_DRIVING_RECORD_FACTORS = {
    "clean": 1.0,
    "minor_violations": 1.25,
    "major_violations": 1.75,
    "dui": 2.50,
}
_AUTO_VEHICLE_AGE_FACTORS = {"0-2": 1.15, "3-5": 1.0, "6-10": 0.85, "11+": 0.70}
_AUTO_DEDUCTIBLE_FACTORS = {250: 1.20, 500: 1.0, 1000: 0.85, 2000: 0.70}

# Home
_HOME_BASE_RATE_PER_1000 = 3.50
_HOME_CONSTRUCTION_FACTORS = {
    "frame": 1.0,
    "masonry": 0.90,
    "fire_resistive": 0.80,
    "superior": 0.75,
}
_HOME_AGE_FACTORS = {"0-5": 0.90, "6-15": 1.0, "16-30": 1.15, "31-50": 1.30, "51+": 1.50}
_HOME_CLAIMS_FACTORS = {0: 1.0, 1: 1.20, 2: 1.45, 3: 1.75}
_HOME_DEDUCTIBLE_FACTORS = {500: 1.15, 1000: 1.0, 2500: 0.85, 5000: 0.70, 10000: 0.55}

# Life
_LIFE_BASE_RATES = {
    ("20-29", "male"): 0.95,
    ("20-29", "female"): 0.80,
    ("30-39", "male"): 1.15,
    ("30-39", "female"): 0.95,
    ("40-49", "male"): 2.10,
    ("40-49", "female"): 1.75,
    ("50-59", "male"): 5.20,
    ("50-59", "female"): 3.80,
    ("60-69", "male"): 12.50,
    ("60-69", "female"): 8.90,
    ("70+", "male"): 28.00,
    ("70+", "female"): 20.00,
}
_LIFE_TOBACCO_FACTOR = 2.0
_LIFE_HEALTH_CLASS_FACTORS = {
    "preferred_plus": 0.75,
    "preferred": 0.90,
    "standard_plus": 1.0,
    "standard": 1.15,
    "substandard": 1.75,
}
_LIFE_TERM_FACTORS = {10: 0.80, 15: 0.90, 20: 1.0, 25: 1.15, 30: 1.30}

_MULTI_LINE_DISCOUNT = 0.10  # 10% per additional line, max 25%


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def _validate_auto_inputs(req: QuoteRequest) -> None:
    """Validate auto insurance quote inputs."""
    if req.age is not None:
        if req.age < 16 or req.age > 100:
            raise ValueError(f"Driver age must be between 16 and 100, got {req.age}")
    if req.deductible is not None and req.deductible <= 0:
        raise ValueError(f"Deductible must be positive, got {req.deductible}")
    if req.vehicle_year is not None:
        current_year = datetime.now().year
        if req.vehicle_year < 1900 or req.vehicle_year > current_year + 2:
            raise ValueError(f"Vehicle year must be between 1900 and {current_year + 2}, got {req.vehicle_year}")


def _validate_home_inputs(req: QuoteRequest) -> None:
    """Validate home insurance quote inputs."""
    if req.property_value is not None and req.property_value <= 0:
        raise ValueError(f"Property value must be positive, got {req.property_value}")
    if req.deductible is not None and req.deductible <= 0:
        raise ValueError(f"Deductible must be positive, got {req.deductible}")
    if req.home_age is not None and req.home_age < 0:
        raise ValueError(f"Home age cannot be negative, got {req.home_age}")
    if req.claims_history is not None and req.claims_history < 0:
        raise ValueError(f"Claims history cannot be negative, got {req.claims_history}")


def _validate_life_inputs(req: QuoteRequest) -> None:
    """Validate life insurance quote inputs."""
    if req.age is not None:
        if req.age < 18 or req.age > 85:
            raise ValueError(f"Life insurance age must be between 18 and 85, got {req.age}")
    if req.coverage_amount is not None and req.coverage_amount <= 0:
        raise ValueError(f"Coverage amount must be positive, got {req.coverage_amount}")
    if req.term_years is not None and req.term_years <= 0:
        raise ValueError(f"Term years must be positive, got {req.term_years}")


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

def _auto_age_bracket(age: int) -> str:
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


def _vehicle_age_bracket(vehicle_year: int) -> str:
    age = datetime.now().year - vehicle_year
    if age <= 2:
        return "0-2"
    elif age <= 5:
        return "3-5"
    elif age <= 10:
        return "6-10"
    return "11+"


def _home_age_bracket(home_age: int) -> str:
    if home_age <= 5:
        return "0-5"
    elif home_age <= 15:
        return "6-15"
    elif home_age <= 30:
        return "16-30"
    elif home_age <= 50:
        return "31-50"
    return "51+"


def _life_age_bracket(age: int) -> str:
    if age <= 29:
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


def _calculate_auto(req: QuoteRequest) -> QuoteResult:
    _validate_auto_inputs(req)
    age_bracket = _auto_age_bracket(req.age or 35)
    base = _AUTO_BASE_RATES[age_bracket]
    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    record = req.driving_record or "clean"
    record_factor = _AUTO_DRIVING_RECORD_FACTORS.get(record, 1.0)
    if record_factor != 1.0:
        adjustments["driving_record"] = base * (record_factor - 1)

    v_factor = 1.0
    if req.vehicle_year:
        v_bracket = _vehicle_age_bracket(req.vehicle_year)
        v_factor = _AUTO_VEHICLE_AGE_FACTORS[v_bracket]
        if v_factor > 1.0:
            adjustments["vehicle_age"] = base * (v_factor - 1)
        elif v_factor < 1.0:
            discounts["vehicle_age"] = base * (1 - v_factor)

    deductible = req.deductible or 500
    closest_ded = min(_AUTO_DEDUCTIBLE_FACTORS, key=lambda x: abs(x - deductible))
    d_factor = _AUTO_DEDUCTIBLE_FACTORS[closest_ded]
    if d_factor > 1.0:
        adjustments["low_deductible"] = base * (d_factor - 1)
    elif d_factor < 1.0:
        discounts["high_deductible"] = base * (1 - d_factor)

    annual = round(base * record_factor * v_factor * d_factor, 2)
    return QuoteResult(
        insurance_type="auto",
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
            "deductible": str(closest_ded),
        },
        rate_table_version=RATE_TABLE_VERSION,
    )


def _calculate_home(req: QuoteRequest) -> QuoteResult:
    _validate_home_inputs(req)
    property_value = req.property_value or 300000
    base = (property_value / 1000) * _HOME_BASE_RATE_PER_1000
    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    construction = req.construction_type or "frame"
    c_factor = _HOME_CONSTRUCTION_FACTORS.get(construction, 1.0)
    if c_factor > 1.0:
        adjustments["construction_type"] = base * (c_factor - 1)
    elif c_factor < 1.0:
        discounts["construction_type"] = base * (1 - c_factor)

    h_bracket = _home_age_bracket(req.home_age or 15)
    h_factor = _HOME_AGE_FACTORS[h_bracket]
    if h_factor > 1.0:
        adjustments["home_age"] = base * (h_factor - 1)
    elif h_factor < 1.0:
        discounts["home_age"] = base * (1 - h_factor)

    claims = min(req.claims_history or 0, 3)
    cl_factor = _HOME_CLAIMS_FACTORS.get(claims, 1.75)
    if cl_factor > 1.0:
        adjustments["claims_history"] = base * (cl_factor - 1)

    deductible = req.deductible or 1000
    closest_ded = min(_HOME_DEDUCTIBLE_FACTORS, key=lambda x: abs(x - deductible))
    d_factor = _HOME_DEDUCTIBLE_FACTORS[closest_ded]
    if d_factor > 1.0:
        adjustments["low_deductible"] = base * (d_factor - 1)
    elif d_factor < 1.0:
        discounts["high_deductible"] = base * (1 - d_factor)

    annual = round(base * c_factor * h_factor * cl_factor * d_factor, 2)
    return QuoteResult(
        insurance_type="home",
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
            "deductible": str(closest_ded),
        },
        rate_table_version=RATE_TABLE_VERSION,
    )


def _calculate_life(req: QuoteRequest) -> QuoteResult:
    _validate_life_inputs(req)
    age = req.age or 35
    gender = req.gender or "male"
    coverage = req.coverage_amount or 500000
    term = req.term_years or 20

    age_bracket = _life_age_bracket(age)
    base_rate = _LIFE_BASE_RATES.get(
        (age_bracket, gender), _LIFE_BASE_RATES[("40-49", "male")]
    )
    base = (coverage / 1000) * base_rate
    adjustments: dict[str, float] = {}
    discounts: dict[str, float] = {}

    tobacco = req.tobacco_status or False
    t_factor = _LIFE_TOBACCO_FACTOR if tobacco else 1.0
    if tobacco:
        adjustments["tobacco_surcharge"] = base * (t_factor - 1)

    health = req.health_class or "standard"
    hc_factor = _LIFE_HEALTH_CLASS_FACTORS.get(health, 1.0)
    if hc_factor > 1.0:
        adjustments["health_class"] = base * (hc_factor - 1)
    elif hc_factor < 1.0:
        discounts["health_class"] = base * (1 - hc_factor)

    closest_term = min(_LIFE_TERM_FACTORS, key=lambda x: abs(x - term))
    term_factor = _LIFE_TERM_FACTORS[closest_term]
    if term_factor > 1.0:
        adjustments["long_term"] = base * (term_factor - 1)
    elif term_factor < 1.0:
        discounts["short_term"] = base * (1 - term_factor)

    annual = round(base * t_factor * hc_factor * term_factor, 2)
    return QuoteResult(
        insurance_type="life",
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


_CALCULATORS = {
    "auto": _calculate_auto,
    "home": _calculate_home,
    "life": _calculate_life,
}


def calculate_quote(req: QuoteRequest) -> QuoteResult:
    """Route a quote request to the appropriate calculator."""
    calculator = _CALCULATORS.get(req.insurance_type)
    if calculator is None:
        raise ValueError(f"Unsupported insurance type: {req.insurance_type!r}. Supported: auto, home, life")
    return calculator(req)


def calculate_bundle_quotes(requests: list[QuoteRequest]) -> BundleQuoteResult:
    """Generate quotes for multiple lines and apply multi-line bundle discount."""
    results = [calculate_quote(r) for r in requests]

    pre_discount_total = sum(r.annual_premium for r in results)

    if len(results) > 1:
        discount_rate = min(_MULTI_LINE_DISCOUNT * (len(results) - 1), 0.25)
        for result in results:
            original = result.annual_premium
            result.annual_premium = round(original * (1 - discount_rate), 2)
            result.monthly_premium = round(result.annual_premium / 12, 2)
            result.breakdown.discounts["multi_line_bundle"] = round(original * discount_rate, 2)
            result.breakdown.total_premium = result.annual_premium

    post_discount_total_annual = sum(r.annual_premium for r in results)
    savings = round(pre_discount_total - post_discount_total_annual, 2)

    return BundleQuoteResult(
        quotes=results,
        total_monthly=round(post_discount_total_annual / 12, 2),
        total_annual=round(post_discount_total_annual, 2),
        bundle_savings_annual=savings,
    )
