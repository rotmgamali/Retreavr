"""AI Intelligence Layer - NLP, RAG, Sentiment, Quotes, Analytics."""

from app.services.ai.client import get_openai_client
from app.services.ai.extraction import extract_insurance_data
from app.services.ai.lead_scoring import score_lead
from app.services.ai.summarization import summarize_call
from app.services.ai.voice_tools import VOICE_AGENT_TOOLS, get_openai_tool_definitions
from app.services.ai.quotes.engine import generate_bundle_quotes, generate_quote
from app.services.ai.sentiment import analyze_sentiment
from app.services.ai.call_scoring import score_call
from app.services.ai.document_processing import extract_text_from_pdf, extract_text_from_pdf_path
from app.services.ai.chunking import chunk_text, chunk_document_pages, TextChunk
from app.services.ai.embeddings import generate_embedding, generate_embeddings_batch, ingest_document
from app.services.ai.retrieval import retrieve_from_db, retrieve_for_voice_agent, retrieve_similar

__all__ = [
    "get_openai_client",
    # NLP
    "extract_insurance_data",
    "score_lead",
    "summarize_call",
    "VOICE_AGENT_TOOLS",
    "get_openai_tool_definitions",
    # Quotes
    "generate_quote",
    "generate_bundle_quotes",
    # Sentiment & Scoring
    "analyze_sentiment",
    "score_call",
    # RAG Pipeline
    "extract_text_from_pdf",
    "extract_text_from_pdf_path",
    "chunk_text",
    "chunk_document_pages",
    "TextChunk",
    "generate_embedding",
    "generate_embeddings_batch",
    "ingest_document",
    "retrieve_from_db",
    "retrieve_for_voice_agent",
    "retrieve_similar",
]
