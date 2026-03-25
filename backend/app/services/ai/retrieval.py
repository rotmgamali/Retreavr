from __future__ import annotations

"""Semantic retrieval service for RAG pipeline.

Provides two retrieval backends:
- retrieve_from_db: production path using pgvector HNSW cosine similarity
- retrieve_similar: in-memory cosine fallback for unit-testing without a DB
"""

import uuid
from dataclasses import dataclass, field

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.ai.embeddings import generate_embedding


@dataclass
class RetrievalResult:
    chunk_text: str
    similarity_score: float
    document_id: str
    chunk_index: int
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# pgvector-backed retrieval (production)
# ---------------------------------------------------------------------------

async def retrieve_from_db(
    session: AsyncSession,
    query: str,
    organization_id: uuid.UUID | None = None,
    document_ids: list[uuid.UUID] | None = None,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve semantically similar chunks from pgvector.

    Uses the HNSW index on document_embeddings.embedding with cosine distance.
    Cosine distance ∈ [0, 2]; similarity = 1 - distance.

    Args:
        session: AsyncSession from the caller (voice endpoint or ingestion worker).
        query: Natural-language query text.
        organization_id: Filter by org (multi-tenancy). If None, skips org filter.
        document_ids: Optional allowlist of document UUIDs to scope retrieval.
        top_k: Maximum number of results.
        similarity_threshold: Minimum similarity score (1 - cosine_distance).
    """
    from app.models.knowledge import DocumentEmbedding, KnowledgeDocument

    settings = get_settings()
    top_k = top_k if top_k is not None else settings.retrieval_top_k
    similarity_threshold = similarity_threshold if similarity_threshold is not None else settings.retrieval_similarity_threshold

    query_vec = await generate_embedding(query)

    # Build the query: order by cosine distance ascending (closer = better)
    stmt = (
        select(DocumentEmbedding)
        .order_by(DocumentEmbedding.embedding.cosine_distance(query_vec))
        .limit(top_k * 3)  # over-fetch before threshold filter
    )

    if document_ids:
        stmt = stmt.where(DocumentEmbedding.document_id.in_(document_ids))

    if organization_id is not None:
        # Join knowledge_documents to filter by org
        stmt = stmt.join(KnowledgeDocument, DocumentEmbedding.document_id == KnowledgeDocument.id).where(
            KnowledgeDocument.organization_id == organization_id,
            KnowledgeDocument.is_deleted.is_(False),
        )

    rows = (await session.execute(stmt)).scalars().all()

    results: list[RetrievalResult] = []
    for row in rows:
        # dot product of normalised vectors = cosine similarity
        similarity = float(
            np.dot(query_vec, row.embedding)
            / (np.linalg.norm(query_vec) * np.linalg.norm(row.embedding) + 1e-10)
        )

        if similarity < similarity_threshold:
            continue

        results.append(RetrievalResult(
            chunk_text=row.chunk_text,
            similarity_score=round(similarity, 4),
            document_id=str(row.document_id),
            chunk_index=row.chunk_index,
        ))

    results.sort(key=lambda r: r.similarity_score, reverse=True)
    return results[:top_k]


async def retrieve_for_voice_agent(
    session: AsyncSession,
    query: str,
    organization_id: uuid.UUID,
    top_k: int = 3,
    similarity_threshold: float = 0.72,
) -> list[RetrievalResult]:
    """Low-latency retrieval path for live voice calls.

    Uses a tighter top_k and slightly higher threshold to return only
    high-confidence snippets in the minimal number of DB round-trips.
    """
    return await retrieve_from_db(
        session=session,
        query=query,
        organization_id=organization_id,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
    )


# ---------------------------------------------------------------------------
# In-memory cosine fallback (unit-testing without a DB)
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr) + 1e-10))


async def retrieve_similar(
    query: str,
    stored_embeddings: list[dict],
    top_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve most similar chunks from an in-memory list (test / no-DB path).

    Each item in stored_embeddings must have keys:
        embedding, chunk_text, document_id, chunk_index, metadata (optional).
    """
    settings = get_settings()
    top_k = top_k if top_k is not None else settings.retrieval_top_k
    similarity_threshold = similarity_threshold if similarity_threshold is not None else settings.retrieval_similarity_threshold

    query_embedding = await generate_embedding(query)

    results: list[RetrievalResult] = []
    for item in stored_embeddings:
        score = cosine_similarity(query_embedding, item["embedding"])
        if score >= similarity_threshold:
            results.append(RetrievalResult(
                chunk_text=item["chunk_text"],
                similarity_score=round(score, 4),
                document_id=item["document_id"],
                chunk_index=item["chunk_index"],
                metadata=item.get("metadata", {}),
            ))

    results.sort(key=lambda r: r.similarity_score, reverse=True)
    return results[:top_k]
