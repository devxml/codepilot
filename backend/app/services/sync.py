"""Build sync payload for Express after ingestion."""

import re
from collections import Counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Chunk, File, Project

ROUTE_PATTERNS = [
    re.compile(r"@(?:app|router)\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.I),
    re.compile(r"@router\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.I),
    re.compile(r"router\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.I),
]

FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:async\s+)?def\s+\w+", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+\w+", re.M),
    re.compile(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\(", re.M),
]

CLASS_PATTERNS = [
    re.compile(r"^\s*class\s+\w+", re.M),
    re.compile(r"^\s*(?:export\s+)?class\s+\w+", re.M),
]

MODEL_PATTERNS = [
    re.compile(r"^\s*class\s+\w+\(.*Model.*\)", re.M),
    re.compile(r"model\s+\w+\s*\{", re.M),
    re.compile(r"@Entity", re.M),
]


def _extract_api_routes(content: str, filepath: str) -> list[dict]:
    routes: list[dict] = []
    for pattern in ROUTE_PATTERNS:
        for match in pattern.finditer(content):
            line_number = content[: match.start()].count("\n") + 1
            routes.append(
                {
                    "method": match.group(1).upper(),
                    "path": match.group(2),
                    "filepath": filepath,
                    "line_number": line_number,
                }
            )
    return routes


def _count_matches(patterns: list[re.Pattern[str]], content: str) -> int:
    return sum(len(p.findall(content)) for p in patterns)


async def build_project_sync(project_id: UUID, db: AsyncSession) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    files_result = await db.execute(
        select(File).where(File.project_id == project_id).order_by(File.filepath)
    )
    files = files_result.scalars().all()

    chunks_result = await db.execute(
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.file_id, Chunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()

    content_by_file: dict[UUID, list[str]] = {}
    for chunk in chunks:
        content_by_file.setdefault(chunk.file_id, []).append(chunk.text)

    languages: Counter[str] = Counter()
    sync_files: list[dict] = []
    api_routes: list[dict] = []
    function_count = 0
    class_count = 0
    total_bytes = 0

    for file in files:
        parts = content_by_file.get(file.id, [])
        content = "\n".join(parts) if parts else ""
        size_bytes = len(content.encode("utf-8"))
        total_bytes += size_bytes

        if file.language:
            languages[file.language] += 1

        function_count += _count_matches(FUNCTION_PATTERNS, content)
        class_count += _count_matches(CLASS_PATTERNS, content)
        api_routes.extend(_extract_api_routes(content, file.filepath))

        sync_files.append(
            {
                "filename": file.filename,
                "filepath": file.filepath,
                "language": file.language,
                "content": content,
                "size_bytes": size_bytes,
            }
        )

    return {
        "project_id": str(project.id),
        "name": project.name,
        "source_type": project.source_type,
        "source_url": project.source_url,
        "status": project.status,
        "file_count": len(sync_files),
        "function_count": function_count,
        "class_count": class_count,
        "api_route_count": len(api_routes),
        "repo_size_bytes": total_bytes,
        "languages": dict(languages),
        "files": sync_files,
        "api_routes": api_routes,
    }
