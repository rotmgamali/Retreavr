"""Shared OpenAI client for AI Intelligence Layer services."""

from typing import Optional

from openai import AsyncOpenAI

from app.config import settings

_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client
