from __future__ import annotations

"""Pydantic schemas for the Analytics & A/B Testing layer."""

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Funnel ---

class FunnelStageName(str, Enum):
    INITIATED = "initiated"
    CONNECTED = "connected"
    QUALIFIED = "qualified"
    QUOTED = "quoted"
    CONVERTED = "converted"


class FunnelStage(BaseModel):
    stage: FunnelStageName
    count: int
    drop_off: int = 0
    drop_off_rate: float = Field(ge=0.0, le=1.0, default=0.0)
    avg_duration_seconds: Optional[float] = None


class ConversionFunnel(BaseModel):
    period_start: date
    period_end: date
    stages: list[FunnelStage]
    overall_conversion_rate: float = Field(ge=0.0, le=1.0)
    campaign_id: Optional[str] = None
    agent_id: Optional[str] = None


# --- Agent Performance ---

class AgentMetrics(BaseModel):
    agent_id: str
    agent_name: Optional[str] = None
    period_start: date
    period_end: date
    total_calls: int
    connected_calls: int
    avg_call_duration_seconds: float
    conversion_rate: float = Field(ge=0.0, le=1.0)
    qualification_rate: float = Field(ge=0.0, le=1.0)
    avg_lead_score: float = Field(ge=0.0, le=1.0)
    sentiment_score: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    cost_per_conversion: Optional[float] = None


# --- Rollups ---

class DailyRollup(BaseModel):
    date: date
    total_calls: int
    connected_calls: int
    qualified_leads: int
    converted_leads: int
    avg_call_duration_seconds: float
    total_cost_usd: float
    unique_campaigns: int


class WeeklyRollup(BaseModel):
    week_start: date
    week_end: date
    total_calls: int
    connected_calls: int
    qualified_leads: int
    converted_leads: int
    conversion_rate: float
    avg_call_duration_seconds: float
    total_cost_usd: float


class MonthlyRollup(BaseModel):
    year: int
    month: int
    total_calls: int
    connected_calls: int
    qualified_leads: int
    converted_leads: int
    conversion_rate: float
    avg_call_duration_seconds: float
    total_cost_usd: float
    top_agent_id: Optional[str] = None


# --- Cost Analytics ---

class CostRecord(BaseModel):
    date: date
    openai_tokens_input: int = 0
    openai_tokens_output: int = 0
    openai_cost_usd: float = 0.0
    twilio_minutes: float = 0.0
    twilio_cost_usd: float = 0.0
    total_cost_usd: float = 0.0
    calls_count: int = 0
    cost_per_call: Optional[float] = None


class CostSummary(BaseModel):
    period_start: date
    period_end: date
    records: list[CostRecord]
    total_openai_cost_usd: float
    total_twilio_cost_usd: float
    total_cost_usd: float
    total_calls: int
    avg_cost_per_call: Optional[float] = None
