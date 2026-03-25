"""Post-processing pipeline: sentiment analysis + call scoring after transcript save."""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.calls import Call, CallSentiment

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates (inlined to keep this module self-contained)
# ---------------------------------------------------------------------------

_SENTIMENT_SYSTEM = (
    "You are a call center quality analyst specializing in insurance conversations. "
    "Analyze the sentiment and emotion of each conversation segment."
)

_SENTIMENT_USER = """Analyze the sentiment of each speaker segment in this call transcript.

SEGMENTS:
{segments}

For each segment, return JSON:
{{
  "segments": [
    {{
      "segment_index": <int>,
      "speaker": "<agent|customer>",
      "sentiment": "positive|negative|neutral|frustrated|interested|confused|satisfied",
      "confidence": <0.0-1.0>
    }}
  ],
  "overall_sentiment": "<dominant sentiment across the call>"
}}"""

_SCORING_SYSTEM = (
    "You are an insurance call center quality assurance expert. "
    "Score the agent's performance across four dimensions. Be fair but rigorous."
)

_SCORING_USER = """Score this insurance call agent's performance (0-100 total):

TRANSCRIPT:
{transcript}

AGENT NAME: {agent_name}
EXPECTED SCRIPT FLOW: {script_flow}

Score these dimensions (0-25 each):
1. **Script Adherence**: Did the agent follow the prescribed conversation flow?
2. **Objection Handling**: How effectively were customer objections addressed?
3. **Data Collection Completeness**: Were all required insurance fields captured?
4. **Customer Engagement**: Rapport building, active listening, appropriate responses?

Return JSON:
{{
  "total_score": <0-100>,
  "dimensions": [
    {{"name": "script_adherence", "score": <0-25>, "feedback": "..."}},
    {{"name": "objection_handling", "score": <0-25>, "feedback": "..."}},
    {{"name": "data_collection", "score": <0-25>, "feedback": "..."}},
    {{"name": "customer_engagement", "score": <0-25>, "feedback": "..."}}
  ],
  "strengths": ["list of things done well"],
  "improvements": ["list of areas to improve"]
}}"""

_DEFAULT_SCRIPT_FLOW = """1. Greeting and identification
2. Purpose of call / needs discovery
3. Current coverage review
4. Information gathering (demographics, risk factors)
5. Quote presentation
6. Objection handling
7. Next steps / close
8. Summary and farewell"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_segments(transcript: str) -> list[dict]:
    """Split transcript text into speaker-labelled segments."""
    segments: list[dict] = []
    current_speaker: Optional[str] = None
    current_text: list[str] = []
    idx = 0

    for line in transcript.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
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
                current_speaker = (
                    "agent" if prefix in ("agent", "representative", "rep") else "customer"
                )
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


def _dominant_sentiment(segments: list[dict], speaker: str) -> Optional[str]:
    speaker_segs = [s for s in segments if s.get("speaker") == speaker]
    if not speaker_segs:
        return None
    counts: Counter = Counter(s.get("sentiment", "neutral") for s in speaker_segs)
    return counts.most_common(1)[0][0]


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def run_post_processing(call_id: uuid.UUID, transcript: str) -> None:
    """Run sentiment analysis and call scoring; persist results.

    Creates its own DB session so it is safe to run as a FastAPI BackgroundTask.
    """
    from app.core.database import async_session  # local import avoids circular at module load

    settings = get_settings()
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured; skipping post-processing for call %s", call_id)
        return

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = settings.openai_model

    raw_segments = _parse_segments(transcript)
    sentiment_data: dict = {}
    call_score_data: dict = {}

    # --- Sentiment analysis ---
    if raw_segments:
        try:
            resp = await client.chat.completions.create(
                model=model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SENTIMENT_SYSTEM},
                    {"role": "user", "content": _SENTIMENT_USER.format(
                        segments=json.dumps(raw_segments, indent=2),
                    )},
                ],
                temperature=0.1,
            )
            sentiment_data = json.loads(resp.choices[0].message.content)
        except Exception:
            logger.exception("Sentiment analysis failed for call %s", call_id)

    # --- Call scoring ---
    try:
        resp = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SCORING_SYSTEM},
                {"role": "user", "content": _SCORING_USER.format(
                    transcript=transcript,
                    agent_name="Agent",
                    script_flow=_DEFAULT_SCRIPT_FLOW,
                )},
            ],
            temperature=0.2,
        )
        call_score_data = json.loads(resp.choices[0].message.content)
    except Exception:
        logger.exception("Call scoring failed for call %s", call_id)

    # --- Persist results ---
    segs: list[dict] = sentiment_data.get("segments", [])
    overall: str = sentiment_data.get("overall_sentiment", "neutral")
    total_score: Optional[float] = call_score_data.get("total_score")

    details = {
        "segments": segs,
        "overall_sentiment": overall,
        "timeline": [
            {
                "index": s.get("segment_index"),
                "speaker": s.get("speaker"),
                "sentiment": s.get("sentiment"),
                "confidence": s.get("confidence", 0.5),
            }
            for s in segs
        ],
        "call_score": call_score_data,
    }

    async with async_session() as db:
        try:
            result = await db.execute(
                select(CallSentiment).where(CallSentiment.call_id == call_id)
            )
            sentiment_row = result.scalar_one_or_none()

            if sentiment_row:
                sentiment_row.customer_sentiment = _dominant_sentiment(segs, "customer")
                sentiment_row.agent_sentiment = _dominant_sentiment(segs, "agent")
                sentiment_row.overall_score = total_score
                sentiment_row.details = details
            else:
                sentiment_row = CallSentiment(
                    call_id=call_id,
                    overall_score=total_score,
                    customer_sentiment=_dominant_sentiment(segs, "customer"),
                    agent_sentiment=_dominant_sentiment(segs, "agent"),
                    details=details,
                )
                db.add(sentiment_row)

            call = await db.get(Call, call_id)
            if call is not None and total_score is not None:
                call.sentiment_score = float(total_score)

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Failed to persist sentiment results for call %s", call_id)
