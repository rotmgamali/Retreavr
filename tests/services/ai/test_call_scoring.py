"""Unit tests for the AI call scoring pipeline."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_schemas import CallScore, ScoreDimension
from app.services.ai.call_scoring import score_call


SAMPLE_TRANSCRIPT = (
    "Agent: Good afternoon, this is Sarah from Retrevr Insurance.\n"
    "Customer: Hi, I'm looking for a better rate on my auto insurance.\n"
    "Agent: Of course! I can help with that. May I ask your current carrier?\n"
    "Customer: I'm with State Farm, paying about $180 a month.\n"
    "Agent: Great. Can I get your zip code and vehicle year?\n"
    "Customer: 90210, 2021 Honda Civic.\n"
    "Agent: Perfect. I'm seeing competitive options starting at $130 a month.\n"
    "Customer: That sounds great, let's move forward."
)

SAMPLE_GPT_PAYLOAD = {
    "total_score": 88.0,
    "dimensions": [
        {"name": "script_adherence", "score": 22.0, "feedback": "Followed the script well."},
        {"name": "objection_handling", "score": 21.0, "feedback": "Handled price objection smoothly."},
        {"name": "data_collection", "score": 24.0, "feedback": "Captured carrier, zip, vehicle."},
        {"name": "customer_engagement", "score": 21.0, "feedback": "Good rapport."},
    ],
    "strengths": ["Clear communication", "Efficient data gathering"],
    "improvements": ["Could probe deeper on existing coverage"],
}


def _mock_scoring_response(payload: dict) -> MagicMock:
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_score_call_returns_call_score():
    mock_response = _mock_scoring_response(SAMPLE_GPT_PAYLOAD)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await score_call("call-001", SAMPLE_TRANSCRIPT)

    assert isinstance(result, CallScore)
    assert result.call_id == "call-001"
    assert result.total_score == 88.0
    assert len(result.dimensions) == 4


@pytest.mark.asyncio
async def test_score_call_dimensions_capped_at_25():
    payload = {
        "total_score": 100.0,
        "dimensions": [
            {"name": "script_adherence", "score": 30.0, "feedback": "Over max"},
        ],
        "strengths": [],
        "improvements": [],
    }
    mock_response = _mock_scoring_response(payload)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await score_call("call-002", SAMPLE_TRANSCRIPT)

    assert result.dimensions[0].score <= 25.0


@pytest.mark.asyncio
async def test_score_call_total_capped_at_100():
    payload = {
        "total_score": 150.0,
        "dimensions": [],
        "strengths": [],
        "improvements": [],
    }
    mock_response = _mock_scoring_response(payload)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await score_call("call-003", SAMPLE_TRANSCRIPT)

    assert result.total_score <= 100.0


@pytest.mark.asyncio
async def test_score_call_custom_agent_name_and_script():
    mock_response = _mock_scoring_response(SAMPLE_GPT_PAYLOAD)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await score_call(
            "call-004",
            SAMPLE_TRANSCRIPT,
            agent_name="Sarah",
            script_flow="1. Greet 2. Qualify 3. Quote",
        )

        call_kwargs = client.chat.completions.create.call_args.kwargs
        prompt_content = call_kwargs["messages"][1]["content"]
        assert "Sarah" in prompt_content
        assert "Greet" in prompt_content


@pytest.mark.asyncio
async def test_score_call_uses_default_script_when_none():
    mock_response = _mock_scoring_response(SAMPLE_GPT_PAYLOAD)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await score_call("call-005", SAMPLE_TRANSCRIPT)

        call_kwargs = client.chat.completions.create.call_args.kwargs
        prompt_content = call_kwargs["messages"][1]["content"]
        # Default script contains "Greeting"
        assert "Greeting" in prompt_content or "greeting" in prompt_content.lower()


@pytest.mark.asyncio
async def test_score_call_strengths_and_improvements_present():
    mock_response = _mock_scoring_response(SAMPLE_GPT_PAYLOAD)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await score_call("call-006", SAMPLE_TRANSCRIPT)

    assert "Clear communication" in result.strengths
    assert len(result.improvements) >= 1


@pytest.mark.asyncio
async def test_score_call_empty_dimensions_graceful():
    payload = {
        "total_score": 0.0,
        "dimensions": [],
        "strengths": [],
        "improvements": [],
    }
    mock_response = _mock_scoring_response(payload)

    with patch("app.services.ai.call_scoring.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await score_call("call-007", SAMPLE_TRANSCRIPT)

    assert result.dimensions == []
    assert result.total_score == 0.0
