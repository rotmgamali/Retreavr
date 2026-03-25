
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ABTestBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "draft"


class ABTestCreate(ABTestBase):
    organization_id: uuid.UUID


class ABTestUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ABTestResponse(ABTestBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ABTestVariantBase(BaseModel):
    name: str
    config: Optional[Dict[str, Any]] = None
    traffic_weight: float = 0.5


class ABTestVariantCreate(ABTestVariantBase):
    ab_test_id: uuid.UUID


class ABTestVariantUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    traffic_weight: Optional[float] = None


class ABTestVariantResponse(ABTestVariantBase):
    id: uuid.UUID
    ab_test_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
