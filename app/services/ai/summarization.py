"""Call summarization pipeline using GPT-4."""

import json

from app.config import settings
from app.models.ai_schemas import CallSummary
from app.services.ai.client import get_openai_client
from app.services.ai.extraction import extract_insurance_data
from app.services.ai.prompts.summarization import CALL_SUMMARY_SYSTEM, CALL_SUMMARY_USER


async def summarize_call(call_id: str, transcript: str) -> CallSummary:
    """Generate a structured summary of a call transcript.

    Calls GPT-4 with JSON mode to produce a natural-language summary, key topics,
    and action items, then runs extraction in parallel to populate insurance fields.
    """
    client = get_openai_client()

    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CALL_SUMMARY_SYSTEM},
            {"role": "user", "content": CALL_SUMMARY_USER.format(transcript=transcript)},
        ],
        temperature=0.1,
    )

    result = json.loads(response.choices[0].message.content)
    extracted = await extract_insurance_data(transcript)

    return CallSummary(
        call_id=call_id,
        summary=result["summary"],
        key_topics=result.get("key_topics", []),
        action_items=result.get("action_items", []),
        extracted_data=extracted,
    )
