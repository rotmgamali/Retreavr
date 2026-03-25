from __future__ import annotations

"""Text chunking with overlapping token strategy for RAG pipeline."""

from dataclasses import dataclass, field

import tiktoken

from app.config import settings

# cl100k_base is the encoding used by text-embedding-3-small
_ENCODING = tiktoken.get_encoding("cl100k_base")


@dataclass
class TextChunk:
    index: int
    text: str
    token_count: int
    start_char: int
    end_char: int
    metadata: dict = field(default_factory=dict)


def count_tokens(text: str) -> int:
    """Return exact token count for text."""
    return len(_ENCODING.encode(text))


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    metadata: dict | None = None,
) -> list[TextChunk]:
    """Split text into overlapping token-bounded chunks.

    Uses tiktoken for precise token counting (cl100k_base encoding).
    Default: 512 tokens per chunk, 50-token overlap.
    Tries to break at sentence boundaries near chunk edges.
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap
    metadata = metadata or {}

    if not text.strip():
        return []

    tokens = _ENCODING.encode(text)
    total_tokens = len(tokens)

    if total_tokens == 0:
        return []

    chunks: list[TextChunk] = []
    start_tok = 0
    idx = 0

    while start_tok < total_tokens:
        end_tok = min(start_tok + chunk_size, total_tokens)

        # Decode current candidate chunk
        chunk_tokens = tokens[start_tok:end_tok]
        chunk_str = _ENCODING.decode(chunk_tokens)

        # Try to break at sentence boundary if not at end of document
        if end_tok < total_tokens:
            # Search for a sentence-ending period near the tail of the chunk
            search_start = max(0, len(chunk_str) - 300)
            last_period = chunk_str.rfind(". ", search_start)
            if last_period > search_start:
                # Trim to sentence boundary and re-encode to get exact token split
                trimmed = chunk_str[: last_period + 1]
                trimmed_tokens = _ENCODING.encode(trimmed)
                if len(trimmed_tokens) > 0:
                    chunk_tokens = trimmed_tokens
                    chunk_str = trimmed
                    end_tok = start_tok + len(chunk_tokens)

        chunk_str = chunk_str.strip()
        if chunk_str:
            # Compute char offsets via the original text
            char_start = len(_ENCODING.decode(tokens[:start_tok]))
            char_end = char_start + len(chunk_str)

            chunks.append(TextChunk(
                index=idx,
                text=chunk_str,
                token_count=len(chunk_tokens),
                start_char=char_start,
                end_char=char_end,
                metadata={**metadata, "chunk_index": idx},
            ))
            idx += 1

        # Advance by (chunk_size - overlap), re-anchored to actual end_tok
        next_start = end_tok - chunk_overlap
        if next_start <= start_tok:
            # Safety: always advance at least one token
            next_start = start_tok + 1
        start_tok = next_start

    return chunks


def chunk_document_pages(
    pages: list[dict],  # each dict: {"page_number": int, "text": str}
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[TextChunk]:
    """Chunk a document page-by-page, preserving page_number in metadata."""
    all_chunks: list[TextChunk] = []
    global_idx = 0

    for page in pages:
        page_chunks = chunk_text(
            text=page["text"],
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            metadata={"page_number": page["page_number"]},
        )
        for chunk in page_chunks:
            chunk.index = global_idx
            chunk.metadata["chunk_index"] = global_idx
            global_idx += 1
        all_chunks.extend(page_chunks)

    return all_chunks
