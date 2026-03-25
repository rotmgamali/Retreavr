import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(str, PyEnum):
    superadmin = "superadmin"
    admin = "admin"
    manager = "manager"
    agent = "agent"
    viewer = "viewer"


ROLE_HIERARCHY: dict = {
    UserRole.superadmin: 5,
    UserRole.admin: 4,
    UserRole.manager: 3,
    UserRole.agent: 2,
    UserRole.viewer: 1,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=UserRole.agent)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organization: Mapped["Organization"] = relationship("Organization", back_populates="users")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


from app.models.organization import Organization  # noqa: E402, F401
from app.models.refresh_token import RefreshToken  # noqa: E402, F401
