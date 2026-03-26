
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

from app.models.leads import InsuranceType, LeadStatus


class LeadBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    insurance_type: Optional[str] = None
    status: str = LeadStatus.new
    propensity_score: Optional[float] = None
    metadata_: Optional[Dict[str, Any]] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    insurance_type: Optional[str] = None
    status: Optional[str] = None
    propensity_score: Optional[float] = None
    metadata_: Optional[Dict[str, Any]] = None


class LeadResponse(LeadBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadInteractionBase(BaseModel):
    interaction_type: str
    notes: Optional[str] = None
    metadata_: Optional[Dict[str, Any]] = None


class LeadInteractionCreate(LeadInteractionBase):
    lead_id: uuid.UUID


class LeadInteractionUpdate(BaseModel):
    interaction_type: Optional[str] = None
    notes: Optional[str] = None
    metadata_: Optional[Dict[str, Any]] = None


class LeadInteractionResponse(LeadInteractionBase):
    id: uuid.UUID
    lead_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
