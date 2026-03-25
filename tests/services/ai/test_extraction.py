"""Unit tests for the structured data extraction pipeline."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_schemas import ExtractedInsuranceData, InsuranceType
from app.services.ai.extraction import extract_insurance_data


SAMPLE_TRANSCRIPT = (
    "Agent: Hi, I'm calling about your auto insurance renewal. "
    "Customer: Yes, I currently have State Farm, renewal is April 15th 2026. "
    "I'm 35 years old, live in ZIP 90210. My driving record is clean. "
    "I'm looking for about 300,000 in coverage with a 1000 dollar deductible."
)


def _mock_openai_response(payload: dict) -> MagicMock:
    """Build a mock AsyncOpenAI response containing the given JSON payload."""
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_extract_basic_auto_fields():
    payload = {
        "policy_type": "auto",
        "coverage_amount": 300000,
        "deductible": 1000,
        "current_carrier": "State Farm",
        "renewal_date": "2026-04-15",
        "age": 35,
        "zip_code": "90210",
        "tobacco_status": None,
        "driving_record": "clean",
        "gender": None,
        "property_value": None,
        "vehicle_year": None,
        "vehicle_type": None,
        "health_class": None,
        "confidence_scores": {
            "policy_type": 0.97,
            "coverage_amount": 0.92,
            "current_carrier": 0.99,
        },
    }
    mock_response = _mock_openai_response(payload)

    with patch(
        "app.services.ai.extraction.get_openai_client"
    ) as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await extract_insurance_data(SAMPLE_TRANSCRIPT)

    assert isinstance(result, ExtractedInsuranceData)
    assert result.policy_type == InsuranceType.AUTO
    assert result.coverage_amount == 300000
    assert result.deductible == 1000
    assert result.current_carrier == "State Farm"
    assert result.renewal_date == "2026-04-15"
    assert result.age == 35
    assert result.zip_code == "90210"
    assert result.driving_record == "clean"
    assert result.tobacco_status is None
    assert result.confidence_scores["policy_type"] == 0.97


@pytest.mark.asyncio
async def test_extract_returns_nulls_for_missing_fields():
    """Fields not present in the transcript should be None."""
    payload = {
        "policy_type": None,
        "coverage_amount": None,
        "deductible": None,
        "current_carrier": None,
        "renewal_date": None,
        "age": None,
        "zip_code": None,
        "tobacco_status": None,
        "driving_record": None,
        "gender": None,
        "property_value": None,
        "vehicle_year": None,
        "vehicle_type": None,
        "health_class": None,
        "confidence_scores": {},
    }
    mock_response = _mock_openai_response(payload)

    with patch("app.services.ai.extraction.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await extract_insurance_data("Hello, how are you?")

    assert result.policy_type is None
    assert result.coverage_amount is None
    assert result.confidence_scores == {}


@pytest.mark.asyncio
async def test_extract_life_insurance_fields():
    payload = {
        "policy_type": "life",
        "coverage_amount": 500000,
        "deductible": None,
        "current_carrier": None,
        "renewal_date": None,
        "age": 42,
        "zip_code": "30301",
        "tobacco_status": False,
        "driving_record": None,
        "gender": "male",
        "property_value": None,
        "vehicle_year": None,
        "vehicle_type": None,
        "health_class": "preferred",
        "confidence_scores": {"policy_type": 0.98, "health_class": 0.85},
    }
    mock_response = _mock_openai_response(payload)

    with patch("app.services.ai.extraction.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await extract_insurance_data("Life insurance transcript")

    assert result.policy_type == InsuranceType.LIFE
    assert result.coverage_amount == 500000
    assert result.tobacco_status is False
    assert result.gender == "male"
    assert result.health_class == "preferred"


@pytest.mark.asyncio
async def test_extract_uses_zero_temperature():
    """Extraction must be deterministic — temperature must be 0.0."""
    mock_response = _mock_openai_response(
        {"policy_type": None, "confidence_scores": {}}
    )

    with patch("app.services.ai.extraction.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await extract_insurance_data("test")

        call_kwargs = client.chat.completions.create.call_args.kwargs
        assert call_kwargs["temperature"] == 0.0


@pytest.mark.asyncio
async def test_extract_uses_json_mode():
    """GPT-4 must be called with response_format json_object."""
    mock_response = _mock_openai_response({"confidence_scores": {}})

    with patch("app.services.ai.extraction.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await extract_insurance_data("test")

        call_kwargs = client.chat.completions.create.call_args.kwargs
        assert call_kwargs["response_format"] == {"type": "json_object"}
