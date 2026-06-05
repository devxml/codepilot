"""
backend/app/main.py
FastAPI application factory — registers routers, CORS, startup events.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import get_settings
from backend.app.db.session import create_tables
from backend.app.services.vector_store import ensure_index_exists
from backend.app.api.upload import router as upload_router
from backend.app.api.chat import router as chat_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before accepting requests."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await create_tables()           # create DB tables if they don't exist
    ensure_index_exists()           # create Pinecone index if it doesn't exist
    yield
    # Shutdown tasks (none needed for now)


app = FastAPI(
    title="codepilot",
    description="Upload a repo, ask questions, get AI-powered analysis.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and production URL
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(upload_router)
app.include_router(chat_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
