"""Prompt templates for call summarization."""

CALL_SUMMARY_SYSTEM = """You are an expert insurance call analyst. Analyze the following call transcript and produce a structured summary.

Focus on:
- Key discussion points and insurance needs expressed
- Specific insurance products mentioned or requested
- Customer concerns, objections, and questions
- Action items agreed upon
- Overall call outcome"""

CALL_SUMMARY_USER = """Analyze this insurance call transcript and return a JSON response:

TRANSCRIPT:
{transcript}

Return JSON with these fields:
{{
  "summary": "2-3 sentence natural language summary of the call",
  "key_topics": ["list of main topics discussed"],
  "action_items": ["list of follow-up actions needed"],
  "call_outcome": "positive|neutral|negative"
}}"""

EXTRACTION_SYSTEM = """You are an insurance data extraction specialist. Extract structured insurance-related fields from call transcripts. Only extract fields that are explicitly mentioned or clearly implied. Use null for fields not discussed."""

EXTRACTION_USER = """Extract insurance-specific data from this transcript:

TRANSCRIPT:
{transcript}

Return JSON with these fields (use null if not mentioned):
{{
  "policy_type": "auto|home|life|health|umbrella|null",
  "coverage_amount": <number or null>,
  "deductible": <number or null>,
  "current_carrier": "<string or null>",
  "renewal_date": "<YYYY-MM-DD or null>",
  "age": <number or null>,
  "zip_code": "<string or null>",
  "tobacco_status": <true|false|null>,
  "driving_record": "<clean|minor_violations|major_violations|dui|null>",
  "gender": "<male|female|null>",
  "property_value": <number or null>,
  "vehicle_year": <number or null>,
  "vehicle_type": "<string or null>",
  "health_class": "<preferred_plus|preferred|standard_plus|standard|substandard|null>",
  "confidence_scores": {{"field_name": 0.0-1.0 confidence for each extracted field}}
}}"""
