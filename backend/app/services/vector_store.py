from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from backend.app.core.config import get_settings

settings = get_settings()

_pc: Pinecone | None = None


def _get_client() -> Pinecone:
    global _pc
    if _pc is None:
        _pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    return _pc


def ensure_index_exists():
    """
    Create the Pinecone index if it does not already exist.
    Called once at application startup.
    """
    pc = _get_client()
    existing = [idx.name for idx in pc.list_indexes()]
    if settings.PINECONE_INDEX_NAME not in existing:
        pc.create_index(
            name=settings.PINECONE_INDEX_NAME,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )


def _get_index():
    pc = _get_client()
    return pc.Index(settings.PINECONE_INDEX_NAME)


def upsert_chunks(
    chunks: List[dict],
    vectors: List[List[float]],
    project_id: str,
) -> None:
    """
    Upsert a batch of chunk vectors into Pinecone.
    Each record: id, values (vector), metadata.
    """
    index = _get_index()
    records = []
    for chunk, vector in zip(chunks, vectors):
        pinecone_id = f"{str(project_id)}_{chunk['filepath']}_{chunk['chunk_index']}"
        # Sanitise special chars that Pinecone doesn't allow in IDs
        pinecone_id = pinecone_id.replace("/", "_").replace("\\", "_").replace(" ", "_")

        records.append({
            "id": pinecone_id,
            "values": vector,
            "metadata": {
                "project_id": str(project_id),
                "filepath": chunk["filepath"],
                "language": chunk["language"],
                "start_line": chunk.get("start_line", 0),
                "end_line": chunk.get("end_line", 0),
                "chunk_index": chunk.get("chunk_index", 0),
                "text": chunk["text"][:1000],  # Pinecone metadata cap: store preview
            },
        })

    # Pinecone recommends batches of ≤ 100
    batch_size = 100
    if not records:
       return

    for i in range(0, len(records), batch_size):
       index.upsert(vectors=records[i : i + batch_size])


def query_index(
    query_vector: List[float],
    project_id: str,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    Search Pinecone for the top-k most similar chunks within a project.
    Returns list of match dicts with id, score, metadata.
    """
    index = _get_index()
    response = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True,
        filter={"project_id": {"$eq": str(project_id)}},
    )
    return [
        {
            "id": match.id,
            "score": match.score,
            "filepath": match.metadata.get("filepath", ""),
            "language": match.metadata.get("language", ""),
            "start_line": match.metadata.get("start_line", 0),
            "end_line": match.metadata.get("end_line", 0),
            "text": match.metadata.get("text", ""),
        }
        for match in response.matches
    ]


def delete_project_vectors(project_id: str) -> None:
    """Delete all vectors belonging to a project (when project is deleted)."""
    index = _get_index()
    index.delete(filter={"project_id": {"$eq": str(project_id)}})
