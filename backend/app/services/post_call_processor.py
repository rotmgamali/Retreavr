"""Post-call processing pipeline: transcript extraction and lead scoring.

Runs after a voice call ends to:
1. Extract structured insurance fields from the call transcript via LLM.
2. Score the lead's propensity to convert based on the extracted data.
3. Persist the score and enriched metadata back to the Lead record.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.calls import Call
from app.models.leads import Lead, LeadInteraction, LeadQualification

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Extraction prompts (mirrors app/services/ai/prompts/summarization.py)
# ---------------------------------------------------------------------------

_EXTRACTION_SYSTEM = (
    "You are an insurance data extraction specialist. Extract structured insurance-related "
    "fields from call transcripts. Only extract fields that are explicitly mentioned or clearly "
    "implied. Use null for fields not discussed."
)

_EXTRACTION_USER = """Extract insurance-specific data from this transcript:

TRANSCRIPT:
{transcript}

Return JSON with these fields (use null if not mentioned):
{{
  "policy_type": "auto|home|life|health|umbrella|null",
  "coverage_amount": <number or null>,
  "deductible": <number or null>,
  "current_carrier": "<string or null>",
  "renewal_date": "<YYYY-MM-DD or null>",
  "age": <number or null>,
  "zip_code": "<string or null>",
  "tobacco_status": <true|false|null>,
  "driving_record": "<clean|minor_violations|major_violations|dui|null>",
  "gender": "<male|female|null>",
  "property_value": <number or null>,
  "vehicle_year": <number or null>,
  "vehicle_type": "<string or null>",
  "health_class": "<preferred_plus|preferred|standard_plus|standard|substandard|null>",
  "confidence_scores": {{"field_name": 0.0-1.0 confidence for each extracted field}}
}}"""

# ---------------------------------------------------------------------------
# Lead scoring weights (mirrors app/services/ai/lead_scoring.py)
# ---------------------------------------------------------------------------

_SCORING_WEIGHTS = {
    "has_policy_type": 0.15,
    "has_coverage_amount": 0.10,
    "has_renewal_date": 0.15,
    "has_current_carrier": 0.10,
    "has_contact_info": 0.10,
    "near_renewal": 0.15,
    "high_coverage": 0.10,
    "data_completeness": 0.15,
}

_SCORE_FIELDS = ["policy_type", "coverage_amount", "deductible", "current_carrier",
                 "renewal_date", "age", "zip_code"]


def _score_extracted_data(data: dict) -> tuple[float, dict[str, float], str]:
    """Compute propensity score from extracted fields. Returns (score, factors, recommendation)."""
    from datetime import datetime, timezone

    factors: dict[str, float] = {}
    factors["has_policy_type"] = 1.0 if data.get("policy_type") else 0.0
    factors["has_coverage_amount"] = 1.0 if data.get("coverage_amount") else 0.0
    factors["has_renewal_date"] = 1.0 if data.get("renewal_date") else 0.0
    factors["has_current_carrier"] = 1.0 if data.get("current_carrier") else 0.0

    contact_vals = [data.get("age"), data.get("zip_code")]
    factors["has_contact_info"] = sum(1 for v in contact_vals if v is not None) / len(contact_vals)

    factors["near_renewal"] = 0.0
    renewal_date = data.get("renewal_date")
    if renewal_date:
        try:
            renewal = datetime.strptime(renewal_date, "%Y-%m-%d")
            days = (renewal - datetime.now(timezone.utc)).days
            if 0 <= days <= 30:
                factors["near_renewal"] = 1.0
            elif 30 < days <= 60:
                factors["near_renewal"] = 0.7
            elif 60 < days <= 90:
                factors["near_renewal"] = 0.4
        except ValueError:
            pass

    factors["high_coverage"] = 0.0
    coverage = data.get("coverage_amount")
    if coverage:
        if coverage >= 500000:
            factors["high_coverage"] = 1.0
        elif coverage >= 250000:
            factors["high_coverage"] = 0.7
        elif coverage >= 100000:
            factors["high_coverage"] = 0.4

    filled = sum(1 for f in _SCORE_FIELDS if data.get(f) is not None)
    factors["data_completeness"] = filled / len(_SCORE_FIELDS)

    score = round(sum(factors[k] * _SCORING_WEIGHTS[k] for k in _SCORING_WEIGHTS), 3)

    if score >= 0.7:
        recommendation = "Hot lead - prioritize immediate follow-up"
    elif score >= 0.4:
        recommendation = "Warm lead - schedule follow-up within 48 hours"
    else:
        recommendation = "Cold lead - add to nurture campaign"

    return score, factors, recommendation


async def run_post_call_processing(
    call_db_id: UUID,
    transcript_text: str,
    db: AsyncSession,
) -> None:
    """Extract insurance data and score the lead associated with a completed call.

    This is a best-effort background task — errors are logged but not raised.
    """
    if not transcript_text or not transcript_text.strip():
        logger.debug("post_call_processor: empty transcript for call %s — skipping", call_db_id)
        return

    try:
        # ---------------------------------------------------------------
        # 1. Resolve the lead_id from the call record
        # ---------------------------------------------------------------
        call = await db.get(Call, call_db_id)
        if call is None or call.lead_id is None:
            logger.debug("post_call_processor: no lead linked to call %s — skipping", call_db_id)
            return

        lead_id: UUID = call.lead_id

        # ---------------------------------------------------------------
        # 2. Extract structured insurance fields via LLM
        # ---------------------------------------------------------------
        settings = get_settings()
        if not settings.openai_api_key:
            logger.warning("post_call_processor: OPENAI_API_KEY not set — skipping extraction")
            return

        from openai import AsyncOpenAI  # lazy import

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=settings.openai_post_call_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _EXTRACTION_SYSTEM},
                {"role": "user", "content": _EXTRACTION_USER.format(transcript=transcript_text)},
            ],
            temperature=0.0,
        )
        raw = response.choices[0].message.content
        try:
            extracted: dict = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as parse_err:
            logger.error(
                "post_call_processor: failed to parse LLM response for call %s: %s — raw: %.500s",
                call_db_id, parse_err, raw,
            )
            return

        if not isinstance(extracted, dict):
            logger.error(
                "post_call_processor: LLM returned non-dict for call %s: %s",
                call_db_id, type(extracted).__name__,
            )
            return

        logger.info(
            "post_call_processor: extraction done for call %s (policy_type=%s)",
            call_db_id,
            extracted.get("policy_type"),
        )

        # ---------------------------------------------------------------
        # 3. Score the lead
        # ---------------------------------------------------------------
        score, factors, recommendation = _score_extracted_data(extracted)
        logger.info(
            "post_call_processor: lead %s scored %.3f — %s",
            lead_id,
            score,
            recommendation,
        )

        # ---------------------------------------------------------------
        # 4. Persist score and enrichment back to the lead
        # ---------------------------------------------------------------
        lead = await db.get(Lead, lead_id)
        if lead is None:
            logger.warning("post_call_processor: lead %s not found — skipping persistence", lead_id)
            return

        lead.propensity_score = score
        existing_meta = lead.metadata_ or {}
        existing_meta["extracted_data"] = extracted
        existing_meta["lead_score"] = {"score": score, "factors": factors, "recommendation": recommendation}
        lead.metadata_ = existing_meta

        # Update insurance type if not already set and extraction found one
        if not lead.insurance_type and extracted.get("policy_type"):
            lead.insurance_type = extracted["policy_type"]

        # Promote to qualified if score is high enough
        if score >= 0.4 and lead.status in ("new", "contacted"):
            lead.status = "qualified"

        qualification = LeadQualification(
            lead_id=lead_id,
            score=score,
            criteria=factors,
            notes=recommendation,
        )
        db.add(qualification)

        interaction = LeadInteraction(
            lead_id=lead_id,
            interaction_type="lead_scored",
            notes=f"Auto-scored after call: {recommendation}",
            metadata_={
                "score": score,
                "factors": factors,
                "call_id": str(call_db_id),
                "extracted_fields": list(
                    k for k, v in extracted.items()
                    if v is not None and k != "confidence_scores"
                ),
            },
        )
        db.add(interaction)
        await db.flush()

        logger.info(
            "post_call_processor: lead %s updated (score=%.3f, status=%s)",
            lead_id,
            score,
            lead.status,
        )

    except Exception:
        logger.exception("post_call_processor: failed for call %s", call_db_id)
