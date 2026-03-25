"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/retrevr"

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 50
    retrieval_top_k: int = 5
    retrieval_similarity_threshold: float = 0.7

    # Scoring
    scoring_confidence_level: float = 0.95

    model_config = {"env_file": ".env", "env_prefix": "RETREVR_"}


settings = Settings()
