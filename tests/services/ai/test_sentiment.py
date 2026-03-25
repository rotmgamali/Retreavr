"""Unit tests for the sentiment analysis pipeline."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_schemas import SegmentSentiment, SentimentLabel, SentimentResult
from app.services.ai.sentiment import analyze_sentiment, parse_transcript_segments


SAMPLE_TRANSCRIPT = (
    "Agent: Thank you for calling Retrevr Insurance. How can I help you?\n"
    "Customer: I'm really frustrated. My premium went up again this year.\n"
    "Agent: I understand, let me look into that for you right away.\n"
    "Customer: I would appreciate that. I've been a customer for 5 years."
)


def _mock_sentiment_response(payload: dict) -> MagicMock:
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


# ── parse_transcript_segments ────────────────────────────────────────────────

def test_parse_segments_basic():
    segments = parse_transcript_segments(SAMPLE_TRANSCRIPT)
    assert len(segments) == 4
    assert segments[0]["speaker"] == "agent"
    assert segments[1]["speaker"] == "customer"
    assert segments[2]["speaker"] == "agent"
    assert segments[3]["speaker"] == "customer"


def test_parse_segments_speaker_normalization():
    transcript = "Rep: Hello.\nCaller: Hi there.\nRepresentative: Got it."
    segments = parse_transcript_segments(transcript)
    assert all(s["speaker"] == "agent" for s in [segments[0], segments[2]])
    assert segments[1]["speaker"] == "customer"


def test_parse_segments_empty_transcript():
    assert parse_transcript_segments("") == []


def test_parse_segments_assigns_indices():
    segments = parse_transcript_segments(SAMPLE_TRANSCRIPT)
    for i, seg in enumerate(segments):
        assert seg["segment_index"] == i


# ── analyze_sentiment ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_sentiment_returns_result():
    gpt_payload = {
        "segments": [
            {"segment_index": 0, "speaker": "agent", "sentiment": "neutral", "confidence": 0.9},
            {"segment_index": 1, "speaker": "customer", "sentiment": "frustrated", "confidence": 0.85},
            {"segment_index": 2, "speaker": "agent", "sentiment": "positive", "confidence": 0.8},
            {"segment_index": 3, "speaker": "customer", "sentiment": "satisfied", "confidence": 0.7},
        ],
        "overall_sentiment": "neutral",
    }
    mock_response = _mock_sentiment_response(gpt_payload)

    with patch("app.services.ai.sentiment.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await analyze_sentiment("call-001", SAMPLE_TRANSCRIPT)

    assert isinstance(result, SentimentResult)
    assert result.call_id == "call-001"
    assert len(result.segments) == 4
    assert result.overall_sentiment == SentimentLabel.NEUTRAL


@pytest.mark.asyncio
async def test_analyze_sentiment_builds_timeline():
    gpt_payload = {
        "segments": [
            {"segment_index": 0, "speaker": "agent", "sentiment": "positive", "confidence": 0.9},
        ],
        "overall_sentiment": "positive",
    }
    mock_response = _mock_sentiment_response(gpt_payload)

    with patch("app.services.ai.sentiment.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await analyze_sentiment("call-002", "Agent: Great call!")

    assert len(result.sentiment_timeline) == 1
    point = result.sentiment_timeline[0]
    assert "sentiment" in point
    assert "speaker" in point
    assert "confidence" in point


@pytest.mark.asyncio
async def test_analyze_sentiment_empty_transcript():
    result = await analyze_sentiment("call-003", "")

    assert result.call_id == "call-003"
    assert result.segments == []
    assert result.sentiment_timeline == []
    assert result.overall_sentiment == SentimentLabel.NEUTRAL


@pytest.mark.asyncio
async def test_analyze_sentiment_low_temperature():
    gpt_payload = {
        "segments": [
            {"segment_index": 0, "speaker": "agent", "sentiment": "neutral", "confidence": 0.8}
        ],
        "overall_sentiment": "neutral",
    }
    mock_response = _mock_sentiment_response(gpt_payload)

    with patch("app.services.ai.sentiment.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        await analyze_sentiment("call-004", "Agent: Hello.")

        kwargs = client.chat.completions.create.call_args.kwargs
        assert kwargs["temperature"] <= 0.2


@pytest.mark.asyncio
async def test_analyze_sentiment_segment_text_preserved():
    gpt_payload = {
        "segments": [
            {"segment_index": 0, "speaker": "customer", "sentiment": "frustrated", "confidence": 0.9},
        ],
        "overall_sentiment": "frustrated",
    }
    mock_response = _mock_sentiment_response(gpt_payload)

    with patch("app.services.ai.sentiment.get_openai_client") as mock_get_client:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = client

        result = await analyze_sentiment("call-005", "Customer: I am not happy.")

    # The original transcript text should be preserved in the segment
    assert len(result.segments) == 1
    assert "not happy" in result.segments[0].text
