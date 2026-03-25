from __future__ import annotations

"""A/B testing framework for prompt variants.

Supports:
- Test creation with named prompt variants and traffic weights
- Weighted random variant assignment
- Result tracking (conversions, call duration, qualification rates)
- Statistical significance via chi-squared + Wilson CI
"""

import random
import uuid
from typing import Optional

from scipy import stats

from app.config import settings
from app.models.ai_schemas import ABTest, ABTestResult, ABTestVariant


def create_test(
    name: str,
    description: str,
    variants: list[dict],
) -> ABTest:
    """Create a new A/B test with normalized variant weights.

    Args:
        name: Human-readable test name.
        description: What this test is measuring.
        variants: List of dicts with keys: name, prompt_template, weight (optional).
                  Weights are normalized to sum to 1.0.

    Returns:
        ABTest ready for assignment.
    """
    n = len(variants)
    if n < 2:
        raise ValueError("A/B test requires at least 2 variants.")

    # Collect raw weights BEFORE constructing ABTestVariant (which enforces le=1.0)
    raw_weights = [float(v.get("weight", 1.0 / n)) for v in variants]
    total = sum(raw_weights)
    if total <= 0:
        raise ValueError("Variant weights must sum to a positive number.")

    normalized_weights = [round(w / total, 6) for w in raw_weights]

    ids = [str(uuid.uuid4()) for _ in variants]
    normalized = [
        ABTestVariant(
            id=ids[i],
            name=variants[i]["name"],
            prompt_template=variants[i]["prompt_template"],
            weight=normalized_weights[i],
        )
        for i in range(n)
    ]

    return ABTest(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        variants=normalized,
        results=[
            ABTestResult(
                variant_id=v.id,
                conversions=0,
                total_trials=0,
                conversion_rate=0.0,
            )
            for v in normalized
        ],
        status="running",
    )


def record_result(
    test: ABTest,
    variant_id: str,
    converted: bool,
    call_duration_seconds: Optional[float] = None,
    qualified: bool = False,
) -> ABTest:
    """Record the outcome of a single call for a variant.

    Uses incremental mean updates to avoid full re-scans.

    Args:
        test: The ABTest to update.
        variant_id: Which variant was assigned.
        converted: Whether the call ended in a sale.
        call_duration_seconds: Call length in seconds.
        qualified: Whether the lead was qualified.

    Returns:
        Updated ABTest with recalculated rolling metrics.
    """
    updated = []
    for r in test.results:
        if r.variant_id != variant_id:
            updated.append(r)
            continue

        n = r.total_trials + 1
        conversions = r.conversions + (1 if converted else 0)

        prev_dur = r.avg_call_duration or 0.0
        new_dur = (
            prev_dur + (call_duration_seconds - prev_dur) / n
            if call_duration_seconds is not None
            else r.avg_call_duration
        )

        prev_qual = r.avg_qualification_rate or 0.0
        new_qual = prev_qual + ((1.0 if qualified else 0.0) - prev_qual) / n

        updated.append(ABTestResult(
            variant_id=variant_id,
            conversions=conversions,
            total_trials=n,
            conversion_rate=round(conversions / n, 4),
            avg_call_duration=round(new_dur, 2) if new_dur is not None else None,
            avg_qualification_rate=round(new_qual, 4),
        ))

    return test.model_copy(update={"results": updated})


def get_winning_variant(test: ABTest) -> Optional[ABTestVariant]:
    """Return the variant with the highest conversion rate if the test is significant.

    Returns:
        Winning ABTestVariant, or None if test is not yet significant.
    """
    if not test.is_significant or not test.results:
        return None

    best = max(test.results, key=lambda r: r.conversion_rate)
    return next((v for v in test.variants if v.id == best.variant_id), None)


def assign_variant(test: ABTest) -> ABTestVariant:
    """Randomly assign a variant based on weights.

    Raises:
        ValueError: If the test is not in 'running' status.
    """
    if test.status != "running":
        raise ValueError(f"Cannot assign variant for test in status '{test.status}'.")
    weights = [v.weight for v in test.variants]
    total = sum(weights)
    weights = [w / total for w in weights]  # normalize
    return random.choices(test.variants, weights=weights, k=1)[0]


def calculate_significance(
    results: list[ABTestResult],
    confidence_level: Optional[float] = None,
) -> tuple[bool, float]:
    """Test statistical significance of A/B test results using chi-squared test.

    Returns (is_significant, p_value).
    """
    confidence_level = confidence_level or settings.scoring_confidence_level

    if len(results) < 2:
        return False, 1.0

    # Chi-squared test on conversion counts
    observed = []
    for r in results:
        observed.append([r.conversions, r.total_trials - r.conversions])

    if any(row[0] + row[1] == 0 for row in observed):
        return False, 1.0

    chi2, p_value, _, _ = stats.chi2_contingency(observed)
    is_significant = p_value < (1 - confidence_level)

    return is_significant, float(p_value)


def calculate_conversion_rate_ci(
    conversions: int,
    trials: int,
    confidence_level: float = 0.95,
) -> tuple[float, float, float]:
    """Calculate conversion rate with confidence interval.

    Returns (rate, lower_bound, upper_bound).
    """
    if trials == 0:
        return 0.0, 0.0, 0.0

    rate = conversions / trials
    z = stats.norm.ppf(1 - (1 - confidence_level) / 2)
    se = (rate * (1 - rate) / trials) ** 0.5
    return rate, max(0, rate - z * se), min(1, rate + z * se)
