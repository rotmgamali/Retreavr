from __future__ import annotations

"""Lead auto-qualification scoring model."""

from app.models.ai_schemas import ExtractedInsuranceData, LeadScore

# Weighted scoring factors for lead qualification
SCORING_WEIGHTS = {
    "has_policy_type": 0.15,
    "has_coverage_amount": 0.10,
    "has_renewal_date": 0.15,
    "has_current_carrier": 0.10,
    "has_contact_info": 0.10,
    "near_renewal": 0.15,
    "high_coverage": 0.10,
    "data_completeness": 0.15,
}

FIELD_NAMES = [
    "policy_type", "coverage_amount", "deductible", "current_carrier",
    "renewal_date", "age", "zip_code",
]


def score_lead(lead_id: str, data: ExtractedInsuranceData) -> LeadScore:
    """Calculate a propensity score (0-1) for a lead based on extracted data."""
    factors: dict[str, float] = {}

    # Has policy type identified
    factors["has_policy_type"] = 1.0 if data.policy_type else 0.0

    # Has coverage amount discussed
    factors["has_coverage_amount"] = 1.0 if data.coverage_amount else 0.0

    # Has renewal date (high intent signal)
    factors["has_renewal_date"] = 1.0 if data.renewal_date else 0.0

    # Has current carrier (shopping signal)
    factors["has_current_carrier"] = 1.0 if data.current_carrier else 0.0

    # Has basic contact/demographic info
    contact_fields = [data.age, data.zip_code]
    factors["has_contact_info"] = sum(1 for f in contact_fields if f is not None) / len(contact_fields)

    # Near renewal date (within 60 days = high urgency)
    factors["near_renewal"] = 0.0
    if data.renewal_date:
        from datetime import datetime, timedelta
        try:
            renewal = datetime.strptime(data.renewal_date, "%Y-%m-%d")
            days_until = (renewal - datetime.utcnow()).days
            if 0 <= days_until <= 30:
                factors["near_renewal"] = 1.0
            elif 30 < days_until <= 60:
                factors["near_renewal"] = 0.7
            elif 60 < days_until <= 90:
                factors["near_renewal"] = 0.4
        except ValueError:
            pass

    # High coverage = higher value lead
    factors["high_coverage"] = 0.0
    if data.coverage_amount:
        if data.coverage_amount >= 500000:
            factors["high_coverage"] = 1.0
        elif data.coverage_amount >= 250000:
            factors["high_coverage"] = 0.7
        elif data.coverage_amount >= 100000:
            factors["high_coverage"] = 0.4

    # Data completeness
    filled = sum(1 for f in FIELD_NAMES if getattr(data, f, None) is not None)
    factors["data_completeness"] = filled / len(FIELD_NAMES)

    # Weighted score
    score = sum(
        factors[key] * SCORING_WEIGHTS[key]
        for key in SCORING_WEIGHTS
    )

    # Recommendation
    if score >= 0.7:
        recommendation = "Hot lead - prioritize immediate follow-up"
    elif score >= 0.4:
        recommendation = "Warm lead - schedule follow-up within 48 hours"
    else:
        recommendation = "Cold lead - add to nurture campaign"

    return LeadScore(
        lead_id=lead_id,
        score=round(score, 3),
        factors=factors,
        recommendation=recommendation,
        extracted_data=data,
    )
