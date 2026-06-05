"""
backend/app/core/config.py
Application-wide settings loaded from environment variables via pydantic-settings.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@db:5432/ai_copilot"

    # Pinecone
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "code-copilot"

    # Groq
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama3-70b-8192"

    # App
    SECRET_KEY: str = "change-me-in-production"
    UPLOAD_DIR: str = "/tmp/uploads"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Chunking
    CHUNK_SIZE_TOKENS: int = 512
    CHUNK_OVERLAP_TOKENS: int = 50
    EMBED_BATCH_SIZE: int = 64
    RETRIEVAL_TOP_K: int = 10
    CONVERSATION_HISTORY_LIMIT: int = 5

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
