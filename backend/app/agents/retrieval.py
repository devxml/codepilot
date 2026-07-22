from backend.app.agents.state import AgentState
from backend.app.services.embedder import embed_query
from backend.app.services.vector_store import query_index
from backend.app.core.config import get_settings

settings = get_settings()


def retrieval_node(state: AgentState) -> AgentState:
    query = state["query"]
    project_id = state["project_id"]
    status_updates = state.get("status_updates", [])

    status_updates.append(f"🔍 Retrieving top {settings.RETRIEVAL_TOP_K} relevant code chunks...")

    query_vector = embed_query(query)
    vector_chunks = query_index(
        query_vector=query_vector,
        project_id=project_id,
        top_k=settings.RETRIEVAL_TOP_K,
    )

    chunks = []
    seen = set()
    # Seeded chunks are deliberately representative of the whole repository, so
    # keep them first when the caller supplied them for a broad question.
    for chunk in state.get("retrieved_chunks", []) + vector_chunks:
        key = (chunk.get("filepath"), chunk.get("start_line"), chunk.get("end_line"))
        if key not in seen:
            chunks.append(chunk)
            seen.add(key)

    status_updates.append(f"✅ Retrieved {len(chunks)} chunks from {len(set(c['filepath'] for c in chunks))} files.")
    state["retrieved_chunks"] = chunks
    state["status_updates"] = status_updates
    return state


def _trim_chunk_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit("\n", 1)[0].strip()


def _prepare_chunks_for_prompt(chunks: list[dict]) -> list[dict]:
    # Broad questions may include a curated repository-wide seed in addition to
    # semantic matches. The total-character guard below remains the hard limit.
    max_chunks = len(chunks)
    trimmed = []
    total_chars = 0

    for chunk in chunks[:max_chunks]:
        text = _trim_chunk_text(chunk.get("text", "") or "", settings.MAX_CHARS_PER_CHUNK)
        chunk_chars = len(text)
        if total_chars + chunk_chars > settings.MAX_TOTAL_INPUT_CHARS:
            break

        trimmed.append({**chunk, "text": text})
        total_chars += chunk_chars

    return trimmed


def _format_chunks_for_prompt(chunks: list[dict]) -> str:
    prepared = _prepare_chunks_for_prompt(chunks)
    parts = []
    for i, chunk in enumerate(prepared, 1):
        parts.append(
            f"--- Chunk {i} | {chunk['filepath']} (lines {chunk['start_line']}–{chunk['end_line']}) ---\n"
            f"{chunk['text']}\n"
        )
    return "\n".join(parts) if parts else "No relevant code chunks were found."
