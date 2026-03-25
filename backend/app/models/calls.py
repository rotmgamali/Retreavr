from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CallDirection(str, PyEnum):
    inbound = "inbound"
    outbound = "outbound"


class CallStatus(str, PyEnum):
    initiating = "initiating"
    initiated = "initiated"
    ringing = "ringing"
    in_progress = "in-progress"
    completed = "completed"
    failed = "failed"
    busy = "busy"
    no_answer = "no-answer"
    canceled = "canceled"
    cancelled = "canceled"


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_agents.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, default=CallDirection.outbound)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=CallStatus.initiated)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone_from: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone_to: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    twilio_sid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True, index=True)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="calls")
    voice_agent: Mapped["VoiceAgent"] = relationship("VoiceAgent", back_populates="calls")
    lead: Mapped["Lead"] = relationship("Lead", back_populates="calls")
    recording: Mapped["CallRecording | None"] = relationship("CallRecording", back_populates="call", uselist=False, lazy="select")
    transcript: Mapped["CallTranscript | None"] = relationship("CallTranscript", back_populates="call", uselist=False, lazy="select")
    summary: Mapped["CallSummary | None"] = relationship("CallSummary", back_populates="call", uselist=False, lazy="select")
    sentiment: Mapped["CallSentiment | None"] = relationship("CallSentiment", back_populates="call", uselist=False, lazy="select")


class CallRecording(Base):
    __tablename__ = "call_recordings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True)
    recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="recording")


class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="transcript")


class CallSummary(Base):
    __tablename__ = "call_summaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    next_actions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="summary")


class CallSentiment(Base):
    __tablename__ = "call_sentiments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    customer_sentiment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    agent_sentiment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="sentiment")


