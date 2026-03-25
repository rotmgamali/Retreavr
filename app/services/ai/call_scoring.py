"""AI Call Scoring system (0-100)."""

import json
from typing import Optional

from app.config import settings
from app.models.ai_schemas import CallScore, ScoreDimension
from app.services.ai.client import get_openai_client
from app.services.ai.prompts.sentiment import CALL_SCORING_SYSTEM, CALL_SCORING_USER

DEFAULT_SCRIPT_FLOW = """1. Greeting and identification
2. Purpose of call / needs discovery
3. Current coverage review
4. Information gathering (demographics, risk factors)
5. Quote presentation
6. Objection handling
7. Next steps / close
8. Summary and farewell"""


async def score_call(
    call_id: str,
    transcript: str,
    agent_name: str = "Agent",
    script_flow: Optional[str] = None,
) -> CallScore:
    """Score an agent's call performance across 4 dimensions (0-100 total)."""
    client = get_openai_client()

    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CALL_SCORING_SYSTEM},
            {"role": "user", "content": CALL_SCORING_USER.format(
                transcript=transcript,
                agent_name=agent_name,
                script_flow=script_flow or DEFAULT_SCRIPT_FLOW,
            )},
        ],
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)

    dimensions = [
        ScoreDimension(
            name=d["name"],
            score=min(d["score"], 25.0),
            feedback=d.get("feedback", ""),
        )
        for d in result.get("dimensions", [])
    ]

    return CallScore(
        call_id=call_id,
        total_score=min(result.get("total_score", 0), 100.0),
        dimensions=dimensions,
        strengths=result.get("strengths", []),
        improvements=result.get("improvements", []),
    )
