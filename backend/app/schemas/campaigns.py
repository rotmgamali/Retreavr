
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

from app.models.campaigns import CampaignType, CampaignStatus


class CampaignBase(BaseModel):
    name: str
    type: str = CampaignType.outbound_call
    status: str = CampaignStatus.draft
    config: Optional[Dict[str, Any]] = None


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class CampaignResponse(CampaignBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
