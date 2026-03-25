from __future__ import annotations

"""Unified insurance quote engine."""

from app.models.ai_schemas import InsuranceType, QuoteRequest, QuoteResult
from app.services.ai.quotes.auto import calculate_auto_quote
from app.services.ai.quotes.home import calculate_home_quote
from app.services.ai.quotes.life import calculate_life_quote

_CALCULATORS = {
    InsuranceType.AUTO: calculate_auto_quote,
    InsuranceType.HOME: calculate_home_quote,
    InsuranceType.LIFE: calculate_life_quote,
}


def generate_quote(request: QuoteRequest) -> QuoteResult:
    """Route a quote request to the appropriate calculator."""
    calculator = _CALCULATORS.get(request.insurance_type)
    if calculator is None:
        raise ValueError(f"Unsupported insurance type: {request.insurance_type}")
    return calculator(request)


def generate_bundle_quotes(requests: list[QuoteRequest]) -> list[QuoteResult]:
    """Generate quotes for multiple lines with bundle discount."""
    from app.services.ai.quotes.rate_tables import MULTI_LINE_DISCOUNT

    results = [generate_quote(r) for r in requests]

    if len(results) > 1:
        discount_rate = MULTI_LINE_DISCOUNT * (len(results) - 1)
        discount_rate = min(discount_rate, 0.25)  # cap at 25%

        for result in results:
            original = result.annual_premium
            result.annual_premium = round(original * (1 - discount_rate), 2)
            result.monthly_premium = round(result.annual_premium / 12, 2)
            result.breakdown.discounts["multi_line_bundle"] = round(original * discount_rate, 2)
            result.breakdown.total_premium = result.annual_premium

    return results
