import os
import shutil
import zipfile
import uuid
from pathlib import Path
from typing import AsyncGenerator

import git  # gitpython
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.config import get_settings
from backend.app.db.models import Project, File, Chunk
from backend.app.services.file_walker import walk_repo
from backend.app.services.chunker import chunk_file
from backend.app.services.embedder import embed_texts
from backend.app.services.vector_store import upsert_chunks

settings = get_settings()


async def ingest_from_zip(
    zip_path: str,
    project_name: str,
    db: AsyncSession,
) -> str:
    """
    Extract a ZIP file, run ingestion, return project_id.
    """
    project_id = uuid.uuid4()
    extract_dir = os.path.join(settings.UPLOAD_DIR, str(project_id))
    os.makedirs(extract_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(extract_dir)

    return await _run_ingestion(
        root_dir=extract_dir,
        project_id=project_id,
        project_name=project_name,
        source_type="zip",
        source_url=None,
        db=db,
    )


async def ingest_from_github(
    github_url: str,
    db: AsyncSession,
) -> str:
    """
    Clone a GitHub repo, run ingestion, return project_id.
    """
    project_id = uuid.uuid4()
    clone_dir = os.path.join(settings.UPLOAD_DIR, str(project_id))
    os.makedirs(clone_dir, exist_ok=True)

    # Strip trailing .git for display name
    project_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")

    try:
      git.Repo.clone_from(
          github_url,
          clone_dir,
          depth=1
    )
    except Exception:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise  # shallow clone

    return await _run_ingestion(
        root_dir=clone_dir,
        project_id=project_id,
        project_name=project_name,
        source_type="github",
        source_url=github_url,
        db=db,
    )


async def _run_ingestion(
    root_dir: str,
    project_id: uuid.UUID,
    project_name: str,
    source_type: str,
    source_url: str | None,
    db: AsyncSession,
) -> str:
    """
    Core pipeline: walk → chunk → embed → upsert → persist DB records.
    """
    # 1. Create project record
    project = Project(
        id=project_id,
        name=project_name,
        source_type=source_type,
        source_url=source_url,
        status="processing",
    )
    db.add(project)
    await db.flush()

    all_chunks: list[dict] = []
    file_records: list[File] = []

    # 2. Walk repo and chunk every file
    for file_info in walk_repo(root_dir):
        file_id = uuid.uuid4()
        chunks = chunk_file(
            content=file_info["content"],
            filepath=file_info["filepath"],
            language=file_info["language"],
            chunk_size=settings.CHUNK_SIZE_TOKENS,
            overlap=settings.CHUNK_OVERLAP_TOKENS,
        )

        if not chunks:
            continue

        file_rec = File(
            id=file_id,
            project_id=project_id,
            filename=file_info["filename"],
            filepath=file_info["filepath"],
            language=file_info["language"],
            total_chunks=len(chunks),
        )
        file_records.append(file_rec)

        for chunk in chunks:
            chunk["file_id"] = file_id
            chunk["project_id"] = project_id
        all_chunks.extend(chunks)

    # 3. Embed in batches
    if not all_chunks:
       project.status = "failed"
       await db.commit()
       raise Exception("No supported files found")

    texts = [c["text"] for c in all_chunks]
    vectors = embed_texts(
       texts,
       batch_size=settings.EMBED_BATCH_SIZE,
    )

    # 4. Upsert to Pinecone
    upsert_chunks(all_chunks, vectors, project_id)

    # 5. Persist files and chunks to PostgreSQL
    db.add_all(file_records)
    await db.flush()

    chunk_records = [
        Chunk(
            project_id=c["project_id"],
            file_id=c["file_id"],
            text=c["text"],
            start_line=c.get("start_line"),
            end_line=c.get("end_line"),
            chunk_index=c.get("chunk_index", 0),
            pinecone_id=f"{project_id}_{c['filepath']}_{c['chunk_index']}",
        )
        for c in all_chunks
    ]
    db.add_all(chunk_records)

    project.status = "ready"
    await db.commit()

    # 6. Clean up temp files
    shutil.rmtree(root_dir, ignore_errors=True)

    return str(project_id)
