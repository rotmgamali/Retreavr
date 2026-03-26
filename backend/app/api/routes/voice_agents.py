
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_org, get_db
from app.models.user import User
from app.models.voice_agents import AgentConfig, AgentKnowledgeBase, VoiceAgent
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
    await db.commit()
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
    await db.commit()
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
    await db.commit()


@router.get("/{agent_id}/configs", response_model=list[AgentConfigResponse])
async def list_agent_configs(
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    # Verify agent belongs to org first
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.voice_agent_id == agent_id)
    )
    return result.scalars().all()


@router.put("/{agent_id}/configs/{key}")
async def upsert_agent_config(
    agent_id: uuid.UUID,
    key: str,
    body: AgentConfigCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.voice_agent_id == agent_id,
            AgentConfig.key == key,
        )
    )
    config = result.scalar_one_or_none()
    if config:
        config.value = body.value
    else:
        config = AgentConfig(voice_agent_id=agent_id, key=key, value=body.value)
        db.add(config)
    await db.flush()
    await db.commit()
    await db.refresh(config)
    return {"id": str(config.id), "key": config.key, "value": config.value}


@router.delete("/{agent_id}/configs/{key}", status_code=204)
async def delete_agent_config(
    agent_id: uuid.UUID,
    key: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.voice_agent_id == agent_id,
            AgentConfig.key == key,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.delete(config)
    await db.flush()
    await db.commit()


@router.post("/{agent_id}/knowledge/{document_id}", status_code=201)
async def attach_knowledge_document(
    agent_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    from app.models.knowledge import KnowledgeDocument
    doc = await db.get(KnowledgeDocument, document_id)
    if not doc or doc.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Document not found")
    existing = await db.execute(
        select(AgentKnowledgeBase).where(
            AgentKnowledgeBase.voice_agent_id == agent_id,
            AgentKnowledgeBase.knowledge_document_id == document_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already attached")
    link = AgentKnowledgeBase(voice_agent_id=agent_id, knowledge_document_id=document_id)
    db.add(link)
    await db.flush()
    await db.commit()
    return {"agent_id": str(agent_id), "document_id": str(document_id)}


@router.delete("/{agent_id}/knowledge/{document_id}", status_code=204)
async def detach_knowledge_document(
    agent_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    agent = await db.get(VoiceAgent, agent_id)
    if not agent or agent.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    result = await db.execute(
        select(AgentKnowledgeBase).where(
            AgentKnowledgeBase.voice_agent_id == agent_id,
            AgentKnowledgeBase.knowledge_document_id == document_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Not attached")
    await db.delete(link)
    await db.flush()
    await db.commit()
