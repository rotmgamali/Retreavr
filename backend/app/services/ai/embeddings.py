from __future__ import annotations

"""Embedding generation and async bulk ingestion pipeline using OpenAI API."""

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.ai.client import get_openai_client
from app.services.ai.chunking import TextChunk, chunk_document_pages
from app.services.ai.document_processing import ProcessedDocument


@dataclass
class EmbeddedChunk:
    chunk: TextChunk
    embedding: list[float]


# ---------------------------------------------------------------------------
# Low-level embedding generation
# ---------------------------------------------------------------------------

async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector for text."""
    settings = get_settings()
    client = get_openai_client()
    response = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=text,
        dimensions=settings.openai_embedding_dimensions,
    )
    return response.data[0].embedding


async def generate_embeddings_batch(texts: list[str], batch_size: int = 100) -> list[list[float]]:
    """Generate embeddings for a list of texts in batches."""
    settings = get_settings()
    client = get_openai_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=batch,
            dimensions=settings.openai_embedding_dimensions,
        )
        all_embeddings.extend([d.embedding for d in response.data])

    return all_embeddings


# ---------------------------------------------------------------------------
# Full ingestion pipeline: document → chunks → embeddings → pgvector
# ---------------------------------------------------------------------------

async def ingest_document(
    session: AsyncSession,
    document: ProcessedDocument,
    document_id: uuid.UUID,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[EmbeddedChunk]:
    """Chunk a document, embed each chunk, and store in pgvector.

    Returns the list of EmbeddedChunk objects created.
    """
    from app.models.knowledge import DocumentEmbedding

    # 1. Chunk per page so page_number metadata is preserved
    pages_data = [
        {"page_number": p.page_number, "text": p.text}
        for p in document.pages
        if p.text.strip()
    ]
    chunks = chunk_document_pages(pages_data, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    if not chunks:
        return []

    # 2. Generate embeddings in one batched call
    texts = [c.text for c in chunks]
    vectors = await generate_embeddings_batch(texts)

    # 3. Persist each chunk + vector to document_embeddings table
    embedded: list[EmbeddedChunk] = []
    for chunk, vector in zip(chunks, vectors):
        row = DocumentEmbedding(
            document_id=document_id,
            chunk_text=chunk.text,
            chunk_index=chunk.index,
            embedding=vector,
        )
        session.add(row)
        embedded.append(EmbeddedChunk(chunk=chunk, embedding=vector))

    await session.flush()
    return embedded
