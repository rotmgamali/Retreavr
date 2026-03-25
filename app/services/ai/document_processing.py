from __future__ import annotations

"""PDF document processing for RAG pipeline."""

import io
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber


@dataclass
class DocumentPage:
    page_number: int  # 1-indexed
    text: str
    tables: list[list[list[str]]]


@dataclass
class ProcessedDocument:
    filename: str
    total_pages: int
    pages: list[DocumentPage]
    full_text: str
    pdf_metadata: dict = field(default_factory=dict)

    @property
    def total_chars(self) -> int:
        return sum(len(p.text) for p in self.pages)


def extract_text_from_pdf(pdf_bytes: bytes, filename: str = "document.pdf") -> ProcessedDocument:
    """Extract text and tables from a PDF given raw bytes (e.g. from an upload)."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return _extract(pdf, filename)


def extract_text_from_pdf_path(file_path: str | Path, filename: str | None = None) -> ProcessedDocument:
    """Extract text and tables from a PDF file on disk."""
    path = Path(file_path)
    with pdfplumber.open(path) as pdf:
        return _extract(pdf, filename or path.name)


def _extract(pdf: pdfplumber.PDF, filename: str) -> ProcessedDocument:
    pages: list[DocumentPage] = []

    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        tables = page.extract_tables() or []

        # Normalise table cells to strings
        str_tables = [
            [[str(cell) if cell else "" for cell in row] for row in table]
            for table in tables
        ]

        # Append table text to page text for unified chunking
        for table in str_tables:
            table_lines = [" | ".join(row) for row in table]
            text += "\n" + "\n".join(table_lines)

        pages.append(DocumentPage(
            page_number=i + 1,
            text=text.strip(),
            tables=str_tables,
        ))

    full_text = "\n\n".join(p.text for p in pages if p.text)

    pdf_metadata: dict = {}
    if pdf.metadata:
        pdf_metadata = {k: str(v) for k, v in pdf.metadata.items() if v}

    return ProcessedDocument(
        filename=filename,
        total_pages=len(pages),
        pages=pages,
        full_text=full_text,
        pdf_metadata=pdf_metadata,
    )
