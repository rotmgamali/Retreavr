
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.models.voice_agents import VoiceEnum, AgentStatus


class VoiceAgentBase(BaseModel):
    name: str
    persona: Optional[str] = None
    system_prompt: Optional[str] = None
    voice: str = VoiceEnum.alloy
    status: str = AgentStatus.draft
    vad_config: Optional[Dict[str, Any]] = None


class VoiceAgentCreate(VoiceAgentBase):
    organization_id: uuid.UUID


class VoiceAgentUpdate(BaseModel):
    name: Optional[str] = None
    persona: Optional[str] = None
    system_prompt: Optional[str] = None
    voice: Optional[str] = None
    status: Optional[str] = None
    vad_config: Optional[Dict[str, Any]] = None


class VoiceAgentResponse(VoiceAgentBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentConfigBase(BaseModel):
    key: str
    value: Optional[Dict[str, Any]] = None


class AgentConfigCreate(AgentConfigBase):
    voice_agent_id: uuid.UUID


class AgentConfigUpdate(BaseModel):
    key: Optional[str] = None
    value: Optional[Dict[str, Any]] = None


class AgentConfigResponse(AgentConfigBase):
    id: uuid.UUID
    voice_agent_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
