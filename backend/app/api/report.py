"""Generate a complete onboarding report from the indexed repository inventory."""

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Project
from backend.app.db.session import get_db
from backend.app.services.repository_context import build_onboarding_report, load_repository_inventory

router = APIRouter(prefix="/api/reports", tags=["reports"])

class RepositoryReportRequest(BaseModel):
    project_id: str


@router.post("/repository")
async def create_repository_report(
    request: RepositoryReportRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        project_id = uuid.UUID(request.project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project id")

    project = await db.get(Project, project_id)
    if not project or project.status != "ready":
        raise HTTPException(status_code=409, detail="Project indexing is not complete")

    try:
        inventory = await load_repository_inventory(project_id, db)
        report = build_onboarding_report(inventory)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Report generation failed: {exc}")

    if not report:
        raise HTTPException(status_code=502, detail="Report generation returned no content")
    return {"report": report, "agents_used": ["repository_inventory_report"]}
