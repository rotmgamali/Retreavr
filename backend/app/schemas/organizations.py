
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, field_validator


class OrganizationBase(BaseModel):
    name: str
    slug: str
    settings: Optional[Dict[str, Any]] = None
    subscription_tier: str = "starter"
    is_active: bool = True


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    subscription_tier: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(OrganizationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
