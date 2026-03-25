
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

from app.models.calls import CallDirection, CallStatus


class CallBase(BaseModel):
    direction: str = CallDirection.outbound
    status: str = CallStatus.initiated
    duration: Optional[int] = None
    phone_from: Optional[str] = None
    phone_to: Optional[str] = None
    twilio_sid: Optional[str] = None
    sentiment_score: Optional[float] = None


class CallCreate(CallBase):
    organization_id: uuid.UUID
    agent_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None


class CallUpdate(BaseModel):
    status: Optional[str] = None
    duration: Optional[int] = None
    twilio_sid: Optional[str] = None
    sentiment_score: Optional[float] = None


class CallResponse(CallBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    agent_id: Optional[uuid.UUID]
    lead_id: Optional[uuid.UUID]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CallTranscriptBase(BaseModel):
    transcript: Optional[str] = None
    language: Optional[str] = None


class CallTranscriptCreate(CallTranscriptBase):
    call_id: uuid.UUID


class CallTranscriptUpdate(BaseModel):
    transcript: Optional[str] = None
    language: Optional[str] = None


class CallTranscriptResponse(CallTranscriptBase):
    id: uuid.UUID
    call_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CallSummaryBase(BaseModel):
    summary: Optional[str] = None
    key_points: Optional[Dict[str, Any]] = None
    next_actions: Optional[Dict[str, Any]] = None


class CallSummaryCreate(CallSummaryBase):
    call_id: uuid.UUID


class CallSummaryUpdate(BaseModel):
    summary: Optional[str] = None
    key_points: Optional[Dict[str, Any]] = None
    next_actions: Optional[Dict[str, Any]] = None


class CallSummaryResponse(CallSummaryBase):
    id: uuid.UUID
    call_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
