"""Shared Gemini LLM client used by all LangGraph agents."""

from functools import lru_cache

from google import genai
from google.genai import types

from backend.app.core.config import get_settings


@lru_cache()
def get_gemini_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=settings.LLM_TIMEOUT_MS),
    )


def generate_text(
    prompt: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> str:
    """Generate a bounded, low-latency Gemini response for repository chat."""
    settings = get_settings()
    client = get_gemini_client()

    config_options = {
        "max_output_tokens": max_tokens,
        "temperature": temperature,
    }

    # Older google-genai clients do not expose thinking_budget. Keep the
    # application compatible while deployments upgrade to the pinned SDK.
    if "thinking_budget" in getattr(types.ThinkingConfig, "model_fields", {}):
        config_options["thinking_config"] = types.ThinkingConfig(
            thinking_budget=settings.LLM_THINKING_BUDGET,
        )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(**config_options),
    )

    return (response.text or "").strip()
