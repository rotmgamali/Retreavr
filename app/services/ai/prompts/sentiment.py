"""Prompt templates for sentiment analysis and call scoring."""

SENTIMENT_SYSTEM = """You are a call center quality analyst specializing in insurance conversations. Analyze the sentiment and emotion of each conversation segment."""

SENTIMENT_USER = """Analyze the sentiment of each speaker segment in this call transcript.

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

CALL_SCORING_SYSTEM = """You are an insurance call center quality assurance expert. Score the agent's performance across four dimensions. Be fair but rigorous."""

CALL_SCORING_USER = """Score this insurance call agent's performance (0-100 total):

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
