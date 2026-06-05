"""
backend/app/services/embedder.py
Local embedding service using sentence-transformers all-MiniLM-L6-v2.
Runs entirely offline — no API calls, no cost.
Dimension: 384, Metric: cosine.
"""
from typing import List
from functools import lru_cache
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load the model once and cache it for the process lifetime."""
    return SentenceTransformer(MODEL_NAME)


def embed_texts(texts: List[str], batch_size: int = 64) -> List[List[float]]:
    """
    Embed a list of texts in batches.
    Returns a list of 384-dimensional float vectors.
    """
    model = _get_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,  # cosine similarity == dot product after L2 norm
    )
    return embeddings.tolist()


def embed_query(query: str) -> List[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]
