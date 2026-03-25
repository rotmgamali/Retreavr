
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_org, get_db
from app.models.user import User
from app.models.voice_agents import AgentConfig, VoiceAgent
from app.schemas.common import PaginatedResponse
from app.schemas.voice_agents import (
    AgentConfigCreate,
    AgentConfigResponse,
    AgentConfigUpdate,
    VoiceAgentCreate,
    VoiceAgentResponse,
    VoiceAgentUpdate,
)

router = APIRouter(prefix="/voice-agents", tags=["voice-agents"])


@router.get("/", response_model=PaginatedResponse[VoiceAgentResponse])
async def list_voice_agents(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    limit: int = 20,
    offset: int = 0,
):
    total_result = await db.execute(
        select(func.count()).select_from(VoiceAgent).where(VoiceAgent.organization_id == org_id)
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(VoiceAgent).where(VoiceAgent.organization_id == org_id).limit(limit).offset(offset)
    )
    items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{agent_id}", response_model=VoiceAgentResponse)
async def get_voice_agent(
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice agent not found")
    return agent


@router.post("/", response_model=VoiceAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_voice_agent(
    body: VoiceAgentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = VoiceAgent(**{**body.model_dump(), "organization_id": org_id})
    db.add(agent)
    await db.flush()
    await db.refresh(agent)
    return agent


@router.patch("/{agent_id}", response_model=VoiceAgentResponse)
async def update_voice_agent(
    agent_id: uuid.UUID,
    body: VoiceAgentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice agent not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)

    await db.flush()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_agent(
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice agent not found")
    agent.status = "inactive"
    await db.flush()
