
"""Knowledge base API: PDF ingestion and semantic retrieval for voice agents."""

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.knowledge import DocumentStatus, KnowledgeDocument
from app.models.user import User

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

_MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    file_type: Optional[str]
    status: str
    total_chunks: int = 0

    model_config = {"from_attributes": True}


class IngestResponse(BaseModel):
    document_id: uuid.UUID
    filename: str
    total_pages: int
    total_chunks: int
    total_tokens: int


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    document_ids: Optional[List[uuid.UUID]] = None
    top_k: int = Field(default=5, ge=1, le=20)
    similarity_threshold: float = Field(default=0.70, ge=0.0, le=1.0)


class RetrieveResultItem(BaseModel):
    chunk_text: str
    similarity_score: float
    document_id: uuid.UUID
    chunk_index: int


class RetrieveResponse(BaseModel):
    query: str
    results: list[RetrieveResultItem]
    total_found: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/documents", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: Annotated[UploadFile, File(description="PDF file to ingest")],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IngestResponse:
    """Upload a PDF and run the full RAG ingestion pipeline.

    Steps: PDF parse → token-bounded chunking → OpenAI embeddings → pgvector store.
    """
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are supported.",
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > _MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"PDF exceeds maximum size of {_MAX_PDF_BYTES // (1024 * 1024)} MB.",
        )

    # Import AI services here to keep route file clean
    from app.services.ai.document_processing import extract_text_from_pdf
    from app.services.ai.embeddings import ingest_document

    # 1. Parse PDF
    parsed = extract_text_from_pdf(pdf_bytes, filename=file.filename or "document.pdf")

    # 2. Create knowledge_documents record (status=processing)
    doc_record = KnowledgeDocument(
        organization_id=current_user.organization_id,
        title=parsed.filename,
        file_type="pdf",
        status=DocumentStatus.processing,
    )
    db.add(doc_record)
    await db.flush()  # obtain doc_record.id before ingestion
    await db.commit()

    try:
        # 3. Chunk + embed + store in pgvector
        embedded_chunks = await ingest_document(
            session=db,
            document=parsed,
            document_id=doc_record.id,
        )

        # 4. Mark document ready
        doc_record.status = DocumentStatus.ready
        await db.flush()
        await db.commit()
    except Exception as exc:
        doc_record.status = DocumentStatus.failed
        await db.flush()
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ingestion pipeline failed: {exc}",
        ) from exc

    total_tokens = sum(ec.chunk.token_count for ec in embedded_chunks)

    return IngestResponse(
        document_id=doc_record.id,
        filename=parsed.filename,
        total_pages=parsed.total_pages,
        total_chunks=len(embedded_chunks),
        total_tokens=total_tokens,
    )


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_chunks(
    body: RetrieveRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RetrieveResponse:
    """Semantic retrieval endpoint for live voice agent calls.

    Returns the most relevant document chunks for the query using
    pgvector cosine similarity.
    """
    from app.services.ai.retrieval import retrieve_from_db

    results = await retrieve_from_db(
        session=db,
        query=body.query,
        organization_id=current_user.organization_id,
        document_ids=body.document_ids,
        top_k=body.top_k,
        similarity_threshold=body.similarity_threshold,
    )

    return RetrieveResponse(
        query=body.query,
        results=[
            RetrieveResultItem(
                chunk_text=r.chunk_text,
                similarity_score=r.similarity_score,
                document_id=uuid.UUID(r.document_id),
                chunk_index=r.chunk_index,
            )
            for r in results
        ],
        total_found=len(results),
    )


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DocumentResponse]:
    """List knowledge base documents for the current organisation."""
    stmt = (
        select(KnowledgeDocument)
        .where(
            KnowledgeDocument.organization_id == current_user.organization_id,
            KnowledgeDocument.is_deleted.is_(False),
        )
        .order_by(KnowledgeDocument.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [DocumentResponse.model_validate(r) for r in rows]


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft-delete a knowledge document and its embeddings."""
    stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.id == document_id,
        KnowledgeDocument.organization_id == current_user.organization_id,
        KnowledgeDocument.is_deleted.is_(False),
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    doc.is_deleted = True
    await db.flush()
    await db.commit()
