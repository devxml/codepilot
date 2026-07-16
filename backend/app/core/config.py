from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@db:5432/ai_copilot"

    # Pinecone
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "code-copilot"

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # App
    SECRET_KEY: str = "change-me-in-production"
    UPLOAD_DIR: str = "/tmp/uploads"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Chunking
    CHUNK_SIZE_TOKENS: int = 512
    CHUNK_OVERLAP_TOKENS: int = 50
    EMBED_BATCH_SIZE: int = 64
    RETRIEVAL_TOP_K: int = 4
    CONVERSATION_HISTORY_LIMIT: int = 2
    MAX_CHARS_PER_CHUNK: int = 1200
    MAX_TOTAL_INPUT_CHARS: int = 8000

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
