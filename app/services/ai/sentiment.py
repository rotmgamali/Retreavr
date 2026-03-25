from __future__ import annotations

"""Sentiment analysis per call segment using GPT-4."""

import json

from app.config import settings
from app.models.ai_schemas import SegmentSentiment, SentimentLabel, SentimentResult
from app.services.ai.client import get_openai_client
from app.services.ai.prompts.sentiment import SENTIMENT_SYSTEM, SENTIMENT_USER


def parse_transcript_segments(transcript: str) -> list[dict]:
    """Split a transcript into speaker-labeled segments."""
    segments = []
    current_speaker = None
    current_text = []
    idx = 0

    for line in transcript.strip().split("\n"):
        line = line.strip()
        if not line:
            continue

        # Detect speaker labels like "Agent:" or "Customer:"
        if ":" in line:
            prefix = line.split(":")[0].strip().lower()
            if prefix in ("agent", "customer", "caller", "representative", "rep"):
                if current_speaker and current_text:
                    segments.append({
                        "segment_index": idx,
                        "speaker": current_speaker,
                        "text": " ".join(current_text),
                    })
                    idx += 1
                current_speaker = "agent" if prefix in ("agent", "representative", "rep") else "customer"
                current_text = [line.split(":", 1)[1].strip()]
                continue

        if current_text is not None:
            current_text.append(line)

    if current_speaker and current_text:
        segments.append({
            "segment_index": idx,
            "speaker": current_speaker,
            "text": " ".join(current_text),
        })

    return segments


async def analyze_sentiment(call_id: str, transcript: str) -> SentimentResult:
    """Analyze sentiment for each segment of a call transcript."""
    client = get_openai_client()
    segments = parse_transcript_segments(transcript)

    if not segments:
        return SentimentResult(
            call_id=call_id,
            segments=[],
            overall_sentiment=SentimentLabel.NEUTRAL,
            sentiment_timeline=[],
        )

    segments_text = json.dumps(segments, indent=2)

    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SENTIMENT_SYSTEM},
            {"role": "user", "content": SENTIMENT_USER.format(segments=segments_text)},
        ],
        temperature=0.1,
    )

    result = json.loads(response.choices[0].message.content)

    parsed_segments = []
    for seg_data in result.get("segments", []):
        idx = seg_data["segment_index"]
        original = segments[idx] if idx < len(segments) else {}
        parsed_segments.append(SegmentSentiment(
            segment_index=idx,
            speaker=seg_data.get("speaker", original.get("speaker", "unknown")),
            text=original.get("text", ""),
            sentiment=SentimentLabel(seg_data["sentiment"]),
            confidence=seg_data.get("confidence", 0.5),
        ))

    # Build timeline for heatmap
    timeline = [
        {
            "index": s.segment_index,
            "speaker": s.speaker,
            "sentiment": s.sentiment.value,
            "confidence": s.confidence,
        }
        for s in parsed_segments
    ]

    return SentimentResult(
        call_id=call_id,
        segments=parsed_segments,
        overall_sentiment=SentimentLabel(result.get("overall_sentiment", "neutral")),
        sentiment_timeline=timeline,
    )
