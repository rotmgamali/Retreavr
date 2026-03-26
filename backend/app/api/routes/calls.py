
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_org, get_db
from app.models.calls import Call, CallSentiment, CallSummary, CallTranscript
from app.schemas.calls import (
    CallCreate,
    CallResponse,
    CallSentimentResponse,
    CallSummaryCreate,
    CallSummaryResponse,
    CallSummaryUpdate,
    CallTranscriptCreate,
    CallTranscriptResponse,
    CallTranscriptUpdate,
    CallUpdate,
)
from app.schemas.common import PaginatedResponse
from app.services.ai.post_processing import run_post_processing

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("/", response_model=PaginatedResponse[CallResponse])
async def list_calls(
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
    limit: int = 20,
    offset: int = 0,
):
    base_filter = (Call.organization_id == org_id, Call.is_deleted.is_(False))

    total_result = await db.execute(select(func.count()).select_from(Call).where(*base_filter))
    total = total_result.scalar_one()

    result = await db.execute(select(Call).where(*base_filter).limit(limit).offset(offset))
    return PaginatedResponse(items=result.scalars().all(), total=total, limit=limit, offset=offset)


@router.get("/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id or call.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return call


@router.post("/", response_model=CallResponse, status_code=status.HTTP_201_CREATED)
async def create_call(
    body: CallCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    data = body.model_dump()
    data["organization_id"] = org_id
    call = Call(**data)
    db.add(call)
    await db.flush()
    await db.commit()
    await db.refresh(call)
    return call


@router.patch("/{call_id}", response_model=CallResponse)
async def update_call(
    call_id: uuid.UUID,
    body: CallUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id or call.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(call, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(call)
    return call


@router.delete("/{call_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_call(
    call_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id or call.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    call.is_deleted = True
    await db.flush()
    await db.commit()


@router.get("/{call_id}/transcript", response_model=CallTranscriptResponse)
async def get_call_transcript(
    call_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    result = await db.execute(select(CallTranscript).where(CallTranscript.call_id == call_id))
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcript not found")
    return transcript


@router.post("/{call_id}/transcript", response_model=CallTranscriptResponse, status_code=status.HTTP_201_CREATED)
async def create_call_transcript(
    call_id: uuid.UUID,
    body: CallTranscriptCreate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    transcript = CallTranscript(**{**body.model_dump(), "call_id": call_id})
    db.add(transcript)
    await db.flush()
    await db.commit()
    await db.refresh(transcript)

    if transcript.transcript:
        background_tasks.add_task(run_post_processing, call_id, transcript.transcript)

    return transcript


@router.patch("/{call_id}/transcript")
async def update_call_transcript(
    call_id: uuid.UUID,
    body: CallTranscriptUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Call not found")
    result = await db.execute(
        select(CallTranscript).where(CallTranscript.call_id == call_id)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(transcript, field, value)
    await db.flush()
    await db.commit()
    await db.refresh(transcript)
    return transcript


@router.get("/{call_id}/sentiment", response_model=CallSentimentResponse)
async def get_call_sentiment(
    call_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id or call.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    result = await db.execute(select(CallSentiment).where(CallSentiment.call_id == call_id))
    sentiment = result.scalar_one_or_none()
    if not sentiment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentiment data not yet available")
    return sentiment


@router.get("/{call_id}/summary", response_model=CallSummaryResponse)
async def get_call_summary(
    call_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    result = await db.execute(select(CallSummary).where(CallSummary.call_id == call_id))
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary not found")
    return summary


@router.post("/{call_id}/summary", response_model=CallSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_call_summary(
    call_id: uuid.UUID,
    body: CallSummaryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    org_id: Annotated[uuid.UUID, Depends(get_current_org)],
):
    call = await db.get(Call, call_id)
    if not call or call.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    summary = CallSummary(**{**body.model_dump(), "call_id": call_id})
    db.add(summary)
    await db.flush()
    await db.commit()
    await db.refresh(summary)
    return summary
