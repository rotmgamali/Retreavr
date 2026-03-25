from __future__ import annotations

"""Pydantic schemas for the AI Intelligence Layer."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- NLP / Extraction ---

class InsuranceType(str, Enum):
    AUTO = "auto"
    HOME = "home"
    LIFE = "life"
    HEALTH = "health"
    UMBRELLA = "umbrella"


class ExtractedInsuranceData(BaseModel):
    policy_type: Optional[InsuranceType] = None
    coverage_amount: Optional[float] = None
    deductible: Optional[float] = None
    current_carrier: Optional[str] = None
    renewal_date: Optional[str] = None
    age: Optional[int] = None
    zip_code: Optional[str] = None
    tobacco_status: Optional[bool] = None
    driving_record: Optional[str] = None
    gender: Optional[str] = None
    property_value: Optional[float] = None
    vehicle_year: Optional[int] = None
    vehicle_type: Optional[str] = None
    health_class: Optional[str] = None
    confidence_scores: dict[str, float] = Field(default_factory=dict)


class CallSummary(BaseModel):
    call_id: str
    summary: str
    key_topics: list[str]
    action_items: list[str]
    extracted_data: ExtractedInsuranceData
    duration_seconds: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LeadScore(BaseModel):
    lead_id: str
    score: float = Field(ge=0.0, le=1.0)
    factors: dict[str, float]
    recommendation: str
    extracted_data: ExtractedInsuranceData


# --- Sentiment ---

class SentimentLabel(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    FRUSTRATED = "frustrated"
    INTERESTED = "interested"
    CONFUSED = "confused"
    SATISFIED = "satisfied"


class SegmentSentiment(BaseModel):
    segment_index: int
    speaker: str
    text: str
    sentiment: SentimentLabel
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None


class SentimentResult(BaseModel):
    call_id: str
    segments: list[SegmentSentiment]
    overall_sentiment: SentimentLabel
    sentiment_timeline: list[dict]


# --- Call Scoring ---

class ScoreDimension(BaseModel):
    name: str
    score: float = Field(ge=0.0, le=25.0)
    max_score: float = 25.0
    feedback: str


class CallScore(BaseModel):
    call_id: str
    total_score: float = Field(ge=0.0, le=100.0)
    dimensions: list[ScoreDimension]
    strengths: list[str]
    improvements: list[str]


# --- Quote Engine ---

class QuoteRequest(BaseModel):
    insurance_type: InsuranceType
    age: Optional[int] = None
    zip_code: Optional[str] = None
    coverage_amount: Optional[float] = None
    deductible: Optional[float] = None
    # Auto-specific
    driving_record: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_type: Optional[str] = None
    # Home-specific
    property_value: Optional[float] = None
    construction_type: Optional[str] = None
    home_age: Optional[int] = None
    claims_history: Optional[int] = None
    # Life-specific
    gender: Optional[str] = None
    tobacco_status: Optional[bool] = None
    health_class: Optional[str] = None
    term_years: Optional[int] = None


class PremiumBreakdown(BaseModel):
    base_premium: float
    adjustments: dict[str, float]
    discounts: dict[str, float]
    total_premium: float


class QuoteResult(BaseModel):
    insurance_type: InsuranceType
    monthly_premium: float
    annual_premium: float
    breakdown: PremiumBreakdown
    coverage_details: dict[str, str]
    rate_table_version: str


# --- A/B Testing ---

class ABTestVariant(BaseModel):
    id: str
    name: str
    prompt_template: str
    weight: float = Field(ge=0.0, le=1.0)


class ABTestResult(BaseModel):
    variant_id: str
    conversions: int
    total_trials: int
    conversion_rate: float
    avg_call_duration: Optional[float] = None
    avg_qualification_rate: Optional[float] = None


class ABTest(BaseModel):
    id: str
    name: str
    description: str
    variants: list[ABTestVariant]
    results: list[ABTestResult] = Field(default_factory=list)
    is_significant: Optional[bool] = None
    p_value: Optional[float] = None
    status: str = "running"


# --- RAG / Knowledge Base ---

class DocumentChunk(BaseModel):
    index: int
    text: str
    token_count: int
    start_char: int
    end_char: int
    metadata: dict = Field(default_factory=dict)


class IngestRequest(BaseModel):
    document_id: str
    filename: str
    organization_id: str


class IngestResult(BaseModel):
    document_id: str
    filename: str
    total_pages: int
    total_chunks: int
    total_tokens: int


class RetrievalQuery(BaseModel):
    query: str
    organization_id: str
    document_ids: Optional[list[str]] = None
    top_k: int = Field(default=5, ge=1, le=20)
    similarity_threshold: float = Field(default=0.70, ge=0.0, le=1.0)


class RetrievalResultItem(BaseModel):
    chunk_text: str
    similarity_score: float
    document_id: str
    chunk_index: int
    metadata: dict = Field(default_factory=dict)


class RetrievalResponse(BaseModel):
    query: str
    results: list[RetrievalResultItem]
    total_found: int


# --- Voice Agent Tools ---

class VoiceToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict
    handler: Optional[str] = None
