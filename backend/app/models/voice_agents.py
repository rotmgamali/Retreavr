from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class VoiceEnum(str, PyEnum):
    alloy = "alloy"
    echo = "echo"
    fable = "fable"
    onyx = "onyx"
    nova = "nova"
    shimmer = "shimmer"


class AgentStatus(str, PyEnum):
    active = "active"
    inactive = "inactive"
    draft = "draft"


class VoiceAgent(Base):
    __tablename__ = "voice_agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    persona: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voice: Mapped[str] = mapped_column(String(50), nullable=False, default=VoiceEnum.alloy)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=AgentStatus.draft)
    vad_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="voice_agents")
    configs: Mapped[List["AgentConfig"]] = relationship("AgentConfig", back_populates="voice_agent", lazy="select")
    knowledge_bases: Mapped[List["AgentKnowledgeBase"]] = relationship("AgentKnowledgeBase", back_populates="voice_agent", lazy="select")
    calls: Mapped[List["Call"]] = relationship("Call", back_populates="voice_agent", lazy="select")


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voice_agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    voice_agent: Mapped["VoiceAgent"] = relationship("VoiceAgent", back_populates="configs")


class AgentKnowledgeBase(Base):
    __tablename__ = "agent_knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voice_agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    knowledge_document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    voice_agent: Mapped["VoiceAgent"] = relationship("VoiceAgent", back_populates="knowledge_bases")


