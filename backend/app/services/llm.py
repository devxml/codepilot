"""Shared Gemini LLM client used by all LangGraph agents."""

from functools import lru_cache

from google import genai
from google.genai import types

from backend.app.core.config import get_settings


@lru_cache()
def get_gemini_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_text(
    prompt: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> str:
    """Generate text using Gemini 3.5 Flash."""
    settings = get_settings()
    client = get_gemini_client()

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        ),
    )

    return (response.text or "").strip()
