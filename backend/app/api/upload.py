"""
backend/app/api/upload.py
Handles ZIP upload and GitHub URL ingestion.
"""
import os
import uuid
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db.session import get_db
from backend.app.db.models import Project
from backend.app.core.config import get_settings
from backend.app.services.ingestion import ingest_from_zip, ingest_from_github

router = APIRouter(prefix="/api/upload", tags=["upload"])
settings = get_settings()


@router.post("/zip")
async def upload_zip(
    file: UploadFile = File(...),
    project_name: str = Form(default=""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """Accept a ZIP file and start ingestion in the background."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    temp_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}.zip")

    # Save upload to disk
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    name = project_name or file.filename.replace(".zip", "")

    # Run ingestion (blocking — move to Celery/background task for prod)
    try:
        project_id = await ingest_from_zip(
            zip_path=temp_path,
            project_name=name,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"project_id": project_id, "name": name, "status": "ready"}


@router.post("/github")
async def upload_github(
    github_url: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Clone a GitHub repo and start ingestion."""
    if not github_url.startswith("https://github.com"):
        raise HTTPException(status_code=400, detail="Only https://github.com URLs are accepted.")

    try:
        project_id = await ingest_from_github(
            github_url=github_url,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    return {"project_id": project_id, "status": "ready"}


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all ingested projects."""
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "source_type": p.source_type,
            "source_url": p.source_url,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
        }
        for p in projects
    ]
