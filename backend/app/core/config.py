from __future__ import annotations

import warnings

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Retrevr Insurance Platform"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/retrevr"
    database_echo: bool = False

    # Auth (no default — must be set via env var or .env file)
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS — production must set via CORS_ORIGINS env var (JSON list)
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://valiant-solace-production-dca5.up.railway.app",
    ]

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_webhook_base_url: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini-2024-07-18"
    openai_realtime_model: str = "gpt-4o-realtime-preview-2024-10-01"
    openai_post_call_model: str = "gpt-4-turbo-2024-04-09"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    # Redis (for rate limiting, event bus, campaign queue)
    redis_url: str = ""

    # Sentry
    sentry_dsn: str = ""

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 50
    retrieval_top_k: int = 5
    retrieval_similarity_threshold: float = 0.7

    # Voice telephony cost
    cost_per_minute: float = 0.05  # USD per minute of voice call

    # S3/R2 Storage
    s3_bucket_name: str = "retrevr-recordings"
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()

    # Warn about empty, default, or weak SECRET_KEY values
    _key = settings.secret_key
    _key_lower = _key.lower()
    _weak_patterns = ("change-me", "changeme", "retrevr", "secret", "password", "example")
    if not _key:
        raise RuntimeError(
            "SECRET_KEY is not set. "
            "Generate a secure key with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    if len(_key) < 32 or any(p in _key_lower for p in _weak_patterns):
        warnings.warn(
            "SECRET_KEY is weak (too short or contains a default pattern). "
            "Generate a secure key with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(64))\"",
            stacklevel=2,
        )
    if not settings.redis_url:
        warnings.warn("REDIS_URL not set — rate limiting will be disabled")
    if not settings.twilio_account_sid:
        warnings.warn("TWILIO_ACCOUNT_SID not set — voice calls will not work")
    if not settings.openai_api_key:
        warnings.warn("OPENAI_API_KEY not set — AI features will be disabled")
    return settings
