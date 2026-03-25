import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    subscription_tier: Mapped[str] = mapped_column(String(50), nullable=False, default="starter")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    voice_agents: Mapped[List["VoiceAgent"]] = relationship("VoiceAgent", back_populates="organization", lazy="select")
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="organization", lazy="select")
    calls: Mapped[List["Call"]] = relationship("Call", back_populates="organization", lazy="select")
    campaigns: Mapped[List["Campaign"]] = relationship("Campaign", back_populates="organization", lazy="select")
    knowledge_documents: Mapped[List["KnowledgeDocument"]] = relationship(
        "KnowledgeDocument", back_populates="organization", lazy="select"
    )
