from typing import List, Optional

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.knowledge import DocumentStatus


class KnowledgeDocumentBase(BaseModel):
    title: str
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    status: str = DocumentStatus.pending


class KnowledgeDocumentCreate(KnowledgeDocumentBase):
    organization_id: uuid.UUID


class KnowledgeDocumentUpdate(BaseModel):
    title: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    status: Optional[str] = None


class KnowledgeDocumentResponse(KnowledgeDocumentBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
