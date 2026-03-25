"""Structured data extraction pipeline for insurance call transcripts."""

import json

from app.config import settings
from app.models.ai_schemas import ExtractedInsuranceData
from app.services.ai.client import get_openai_client
from app.services.ai.prompts.summarization import EXTRACTION_SYSTEM, EXTRACTION_USER


async def extract_insurance_data(transcript: str) -> ExtractedInsuranceData:
    """Extract structured insurance-specific fields from a call transcript.

    Uses GPT-4 with JSON mode to identify and return insurance fields including
    policy type, coverage details, demographics, and per-field confidence scores.
    Fields not mentioned in the transcript are returned as None.
    """
    client = get_openai_client()

    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM},
            {"role": "user", "content": EXTRACTION_USER.format(transcript=transcript)},
        ],
        temperature=0.0,
    )

    data = json.loads(response.choices[0].message.content)

    return ExtractedInsuranceData(
        policy_type=data.get("policy_type"),
        coverage_amount=data.get("coverage_amount"),
        deductible=data.get("deductible"),
        current_carrier=data.get("current_carrier"),
        renewal_date=data.get("renewal_date"),
        age=data.get("age"),
        zip_code=data.get("zip_code"),
        tobacco_status=data.get("tobacco_status"),
        driving_record=data.get("driving_record"),
        gender=data.get("gender"),
        property_value=data.get("property_value"),
        vehicle_year=data.get("vehicle_year"),
        vehicle_type=data.get("vehicle_type"),
        health_class=data.get("health_class"),
        confidence_scores=data.get("confidence_scores", {}),
    )
