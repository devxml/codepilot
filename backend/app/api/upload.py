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
from backend.app.services.sync import build_project_sync

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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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


@router.get("/projects/{project_id}/sync")
async def get_project_sync_payload(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return the indexed repository data needed by the application API.

    This endpoint is consumed only by the Express service after a successful
    ingestion. The AI service remains the source of truth for raw indexed code,
    while Express owns user-facing repository metadata and access control.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != "ready":
        raise HTTPException(status_code=409, detail="Project indexing is not complete")

    return await build_project_sync(project_id, db)
