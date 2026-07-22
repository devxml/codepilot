"""Repository-wide context used for onboarding reports and broad chat questions."""

from collections import Counter, defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Chunk, File, Project
import re

ROUTE_PATTERNS = [
    re.compile(r"@(?:app|router)\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.I),
    re.compile(r"router\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.I),
]
FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:async\s+)?def\s+\w+", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+\w+", re.M),
    re.compile(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\(", re.M),
]
CLASS_PATTERNS = [re.compile(r"^\s*class\s+\w+", re.M), re.compile(r"^\s*(?:export\s+)?class\s+\w+", re.M)]


def _count_matches(patterns: list[re.Pattern[str]], content: str) -> int:
    return sum(len(pattern.findall(content)) for pattern in patterns)


def _extract_api_routes(content: str, filepath: str) -> list[dict]:
    routes = []
    for pattern in ROUTE_PATTERNS:
        for match in pattern.finditer(content):
            routes.append({"method": match.group(1).upper(), "path": match.group(2), "filepath": filepath, "line_number": content[:match.start()].count("\n") + 1})
    return routes


def rebuild_file_content(chunks: list[Chunk]) -> str:
    """Rebuild a file without counting the chunk overlap twice."""
    lines: dict[int, str] = {}
    for chunk in sorted(chunks, key=lambda item: item.chunk_index):
        for offset, line in enumerate(chunk.text.splitlines(), start=chunk.start_line or 1):
            lines.setdefault(offset, line)
    return "\n".join(lines[number] for number in sorted(lines))


async def load_repository_inventory(project_id: UUID, db: AsyncSession) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    files = (await db.execute(
        select(File).where(File.project_id == project_id).order_by(File.filepath)
    )).scalars().all()
    chunks = (await db.execute(
        select(Chunk).where(Chunk.project_id == project_id).order_by(Chunk.file_id, Chunk.chunk_index)
    )).scalars().all()

    chunks_by_file: dict[UUID, list[Chunk]] = defaultdict(list)
    for chunk in chunks:
        chunks_by_file[chunk.file_id].append(chunk)

    languages: Counter[str] = Counter()
    folders: Counter[str] = Counter()
    routes: list[dict] = []
    function_count = class_count = total_lines = total_bytes = 0
    file_details: list[dict] = []

    for file in files:
        content = rebuild_file_content(chunks_by_file[file.id])
        line_count = max((chunk.end_line or 0 for chunk in chunks_by_file[file.id]), default=0)
        total_lines += line_count
        total_bytes += len(content.encode("utf-8"))
        if file.language:
            languages[file.language] += 1
        filepath = file.filepath.replace("\\", "/")
        parent = filepath.rsplit("/", 1)[0] if "/" in filepath else "."
        folders[parent] += 1
        function_count += _count_matches(FUNCTION_PATTERNS, content)
        class_count += _count_matches(CLASS_PATTERNS, content)
        routes.extend(_extract_api_routes(content, file.filepath))
        file_details.append({"filepath": filepath, "language": file.language or "unknown", "lines": line_count})

    # Route patterns may overlap; only expose each actual route once.
    unique_routes = {(r["method"], r["path"], r["filepath"], r["line_number"]): r for r in routes}
    return {
        "project": project,
        "files": file_details,
        "folders": folders,
        "languages": languages,
        "routes": list(unique_routes.values()),
        "file_count": len(files),
        "total_lines": total_lines,
        "total_bytes": total_bytes,
        "function_count": function_count,
        "class_count": class_count,
        "chunks_by_file": chunks_by_file,
        "filepaths_by_id": {file.id: file.filepath.replace("\\", "/") for file in files},
    }


def format_repository_inventory(inventory: dict) -> str:
    project = inventory["project"]
    languages = ", ".join(f"{name} ({count})" for name, count in inventory["languages"].most_common()) or "None detected"
    folders = "\n".join(f"- `{folder}/` — {count} indexed files" for folder, count in inventory["folders"].most_common(40)) or "- No folders detected"
    files = "\n".join(f"- `{f['filepath']}` — {f['language']}, {f['lines']} lines" for f in inventory["files"][:150])
    routes = "\n".join(
        f"- `{route['method']} {route['path']}` — `{route['filepath']}:{route['line_number']}`"
        for route in inventory["routes"]
    ) or "- No conventional HTTP route declarations were detected."
    return f"""REPOSITORY FACTS (authoritative indexed inventory)
Project name: {project.name}
Source: {project.source_type}{f' ({project.source_url})' if project.source_url else ''}
Files: {inventory['file_count']}
Lines of code/content: {inventory['total_lines']}
Approximate indexed size: {inventory['total_bytes']} bytes
Functions detected: {inventory['function_count']}; classes detected: {inventory['class_count']}
Languages: {languages}

FOLDERS:
{folders}

FILES:
{files}

API ROUTES:
{routes}"""


def build_onboarding_report(inventory: dict) -> str:
    """Create a complete, factual report even when an LLM is slow or incomplete."""
    project = inventory["project"]
    paths = [file["filepath"] for file in inventory["files"]]
    path_text = " ".join(paths).lower()
    frameworks: list[str] = []
    if "frontend/" in path_text or "next.config" in path_text:
        frameworks.extend(["Next.js", "React"])
    if "server/" in path_text or any("express" in path.lower() for path in paths):
        frameworks.extend(["Node.js", "Express"])
    if "backend/" in path_text:
        frameworks.append("Python")
    if any("fastapi" in path.lower() or "main.py" in path.lower() for path in paths):
        frameworks.append("FastAPI")
    if any("prisma" in path.lower() for path in paths):
        frameworks.append("Prisma")
    if "docker-compose" in path_text or any(path.endswith("dockerfile") for path in paths):
        frameworks.append("Docker")
    frameworks = list(dict.fromkeys(frameworks))
    languages = ", ".join(f"{name} ({count} files)" for name, count in inventory["languages"].most_common()) or "No language metadata detected"
    purpose = (
        "A code-analysis platform that indexes uploaded repositories and provides repository reports and code chat."
        if {"frontend", "server", "backend"}.issubset({path.split("/", 1)[0] for path in paths if "/" in path})
        else "A software repository indexed for code analysis and documentation."
    )

    folder_roles = {
        "frontend": "browser user interface and presentation layer",
        "server": "application API, authentication, workspace, and repository orchestration",
        "backend": "AI indexing, retrieval, reporting, and analysis service",
        "prisma": "database schema and seed data",
        "src": "application source code",
        "app": "application modules and route handlers",
    }
    folder_lines = []
    for folder, count in inventory["folders"].most_common():
        top = folder.split("/", 1)[0]
        role = folder_roles.get(folder) or folder_roles.get(top) or "supporting source, configuration, or project assets"
        folder_lines.append(f"- `{folder}/` — {role}; {count} indexed files.")

    important = sorted(
        inventory["files"],
        key=lambda file: (0 if any(token in file["filepath"].lower() for token in ("main.", "app.", "index.", "route", "schema", "docker-compose", "readme")) else 1, file["filepath"]),
    )[:20]
    file_lines = []
    for file in important:
        name = file["filepath"].lower()
        if "route" in name:
            role = "defines HTTP endpoints or request routing"
        elif "schema" in name:
            role = "defines the data model or persistence schema"
        elif any(token in name for token in ("main.", "app.", "index.")):
            role = "acts as an application entry point or service bootstrap"
        elif "config" in name or ".env" in name:
            role = "contains runtime configuration"
        else:
            role = "contributes to the indexed application"
        file_lines.append(f"- `{file['filepath']}` — {role} ({file['lines']} lines).")

    route_lines = [
        f"| `{route['method']}` | `{route['path']}` | `{route['filepath']}:{route['line_number']}` |"
        for route in sorted(inventory["routes"], key=lambda item: (item["path"], item["method"], item["filepath"]))
    ]
    api_table = "| Method | Path | Source |\n| --- | --- | --- |\n" + "\n".join(route_lines) if route_lines else "No conventional HTTP route declarations were detected by the static scanner."

    layers = []
    if any(path.startswith("frontend/") for path in paths): layers.append("    UI[Frontend UI]")
    if any(path.startswith("server/") for path in paths): layers.append("    API[Server API]")
    if any(path.startswith("backend/") for path in paths): layers.append("    AI[Backend AI service]")
    if any("prisma" in path.lower() for path in paths): layers.append("    DB[(Database)]")
    edges = []
    nodes = {line.split("[", 1)[0].strip() for line in layers}
    if {"UI", "API"}.issubset(nodes): edges.append("    UI --> API")
    if {"API", "AI"}.issubset(nodes): edges.append("    API --> AI")
    if "DB" in nodes:
        if "API" in nodes: edges.append("    API --> DB")
        if "AI" in nodes: edges.append("    AI --> DB")
    diagram = "\n".join(["```mermaid", "flowchart TD", *layers, *edges, "```"])

    return f"""# Repository Overview

- **Project name:** {project.name}
- **Purpose:** {purpose}
- **Tech stack:** {languages}
- **Number of files:** {inventory['file_count']}
- **Lines of code/content:** {inventory['total_lines']}
- **Main frameworks:** {', '.join(frameworks) if frameworks else 'Derived from the indexed source files'}

## Project Architecture

The repository is organized into {', '.join(sorted({path.split('/', 1)[0] for path in paths if '/' in path})) or 'a flat source layout'}. Based on the indexed paths, requests flow through the application API and, where present, into the AI analysis service; persistence-related modules provide the data layer. This is a static structural inference, not a runtime trace.

## Folder Structure Analysis

{chr(10).join(folder_lines) or '- No folders detected.'}

## API Inventory

{api_table}

## File-Level Summary

{chr(10).join(file_lines) or '- No files detected.'}

## Architecture Diagram

{diagram}

## Notes and Confidence

This report is generated from all indexed file paths, chunk line ranges, and statically detected routes. Runtime-only routes, generated code, and files excluded during indexing may not appear here.
"""


async def representative_chunks(project_id: UUID, db: AsyncSession, limit: int = 12) -> list[dict]:
    """Give broad questions evidence from entry points and every major folder."""
    inventory = await load_repository_inventory(project_id, db)
    selected: list[Chunk] = []
    seen_folders: set[str] = set()
    preferred = ("readme", "main.", "index.", "app.", "route", "server", "config", "schema")
    all_chunks = [chunk for chunks in inventory["chunks_by_file"].values() for chunk in chunks]
    filepaths_by_id = inventory["filepaths_by_id"]
    for chunk in sorted(
        all_chunks,
        key=lambda c: (
            0 if any(key in filepaths_by_id[c.file_id].lower() for key in preferred) else 1,
            filepaths_by_id[c.file_id],
            c.chunk_index,
        ),
    ):
        filepath = filepaths_by_id[chunk.file_id]
        folder = filepath.rsplit("/", 1)[0] if "/" in filepath else "."
        if folder in seen_folders and len(selected) >= 6:
            continue
        selected.append(chunk)
        seen_folders.add(folder)
        if len(selected) >= limit:
            break
    return [
        {
            "filepath": filepaths_by_id[c.file_id],
            "language": "",
            "start_line": c.start_line or 1,
            "end_line": c.end_line or 1,
            "text": c.text,
            "score": 0.0,
        }
        for c in selected
    ]
