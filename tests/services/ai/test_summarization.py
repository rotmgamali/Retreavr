"""Unit tests for the call summarization pipeline."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_schemas import CallSummary, ExtractedInsuranceData, InsuranceType
from app.services.ai.summarization import summarize_call


SAMPLE_TRANSCRIPT = (
    "Agent: Thanks for calling Retrevr Insurance. How can I help you today? "
    "Customer: I want to compare auto insurance rates. I'm currently with Geico, "
    "renewal is next month. I'm 29, live in 77001, clean driving record."
)

EMPTY_EXTRACTED = ExtractedInsuranceData()


def _mock_summary_response(payload: dict) -> MagicMock:
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_summarize_call_returns_call_summary():
    summary_payload = {
        "summary": "Customer called to compare auto insurance rates before renewal.",
        "key_topics": ["auto insurance", "rate comparison", "renewal"],
        "action_items": ["Send competitive quotes", "Follow up before renewal"],
        "call_outcome": "positive",
    }
    extracted = ExtractedInsuranceData(
        policy_type=InsuranceType.AUTO,
        current_carrier="Geico",
        age=29,
        zip_code="77001",
        driving_record="clean",
    )

    mock_response = _mock_summary_response(summary_payload)

    with (
        patch("app.services.ai.summarization.get_openai_client") as mock_get_client,
        patch(
            "app.services.ai.summarization.extract_insurance_data",
            new=AsyncMock(return_value=extracted),
        ),
    ):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await summarize_call("call-001", SAMPLE_TRANSCRIPT)

    assert isinstance(result, CallSummary)
    assert result.call_id == "call-001"
    assert "auto insurance" in result.summary.lower() or "rate" in result.summary.lower()
    assert "auto insurance" in result.key_topics
    assert len(result.action_items) == 2
    assert result.extracted_data.policy_type == InsuranceType.AUTO


@pytest.mark.asyncio
async def test_summarize_call_passes_transcript_to_extraction():
    """extract_insurance_data must be called with the same transcript."""
    summary_payload = {
        "summary": "Test summary.",
        "key_topics": [],
        "action_items": [],
    }
    mock_response = _mock_summary_response(summary_payload)
    mock_extract = AsyncMock(return_value=EMPTY_EXTRACTED)

    with (
        patch("app.services.ai.summarization.get_openai_client") as mock_get_client,
        patch("app.services.ai.summarization.extract_insurance_data", mock_extract),
    ):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await summarize_call("call-002", SAMPLE_TRANSCRIPT)

    mock_extract.assert_called_once_with(SAMPLE_TRANSCRIPT)


@pytest.mark.asyncio
async def test_summarize_call_uses_low_temperature():
    """Summarization temperature should be <= 0.2 for consistency."""
    summary_payload = {"summary": "Short summary.", "key_topics": [], "action_items": []}
    mock_response = _mock_summary_response(summary_payload)

    with (
        patch("app.services.ai.summarization.get_openai_client") as mock_get_client,
        patch(
            "app.services.ai.summarization.extract_insurance_data",
            new=AsyncMock(return_value=EMPTY_EXTRACTED),
        ),
    ):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await summarize_call("call-003", "transcript text")

        call_kwargs = client.chat.completions.create.call_args.kwargs
        assert call_kwargs["temperature"] <= 0.2


@pytest.mark.asyncio
async def test_summarize_call_empty_action_items():
    """action_items defaults to empty list when not in GPT response."""
    summary_payload = {"summary": "Brief call.", "key_topics": ["pricing"]}
    mock_response = _mock_summary_response(summary_payload)

    with (
        patch("app.services.ai.summarization.get_openai_client") as mock_get_client,
        patch(
            "app.services.ai.summarization.extract_insurance_data",
            new=AsyncMock(return_value=EMPTY_EXTRACTED),
        ),
    ):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await summarize_call("call-004", "transcript")

    assert result.action_items == []
