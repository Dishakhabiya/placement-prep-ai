import os
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "nemotron-3-nano:30b-cloud")

# Sentinel values returned when the LLM is unavailable
_QUOTA_EXCEEDED = "quota_exceeded"   # HTTP 429 — free-tier rate limit hit
_LLM_UNAVAILABLE = None              # Network error, non-reachable, or other HTTP error


class LLMClient:
    """
    Interface for Nemotron / Llama 3 / LLM question generation and multi-turn chat.
    Attempts local Ollama / Cloud inference first; falls back to structured rule-based NLP
    prompt templates if server is unavailable or the quota is exhausted.
    """

    @staticmethod
    def is_ollama_available() -> bool:
        try:
            res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=2)
            return res.status_code == 200
        except Exception:
            return False

    @classmethod
    def _parse_error(cls, res: requests.Response) -> str:
        """Extracts a readable error string from a non-200 Ollama response."""
        try:
            return res.json().get("error", res.text[:300])
        except Exception:
            return res.text[:300]

    @classmethod
    def generate_with_prompt(cls, system_prompt: str, user_prompt: str) -> Optional[str]:
        """
        Sends a single-turn prompt request to Ollama.
        Returns:
            str   — successful LLM reply
            None  — unavailable / unknown error (use NLP fallback)
            "quota_exceeded" — HTTP 429, free-tier limit hit (use quota fallback)
        """
        if not cls.is_ollama_available():
            logger.warning(
                "Ollama is not reachable at %s — skipping LLM, using NLP fallback.", OLLAMA_HOST
            )
            return _LLM_UNAVAILABLE

        try:
            payload = {
                "model": LLM_MODEL_NAME,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "options": {"temperature": 0.7},
            }
            res = requests.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=30)

            if res.status_code == 200:
                data = res.json()
                return data.get("message", {}).get("content", "") or None

            if res.status_code == 429:
                error_detail = cls._parse_error(res)
                logger.warning(
                    "Ollama single-turn: HTTP 429 quota exhausted for model '%s': %s",
                    LLM_MODEL_NAME, error_detail,
                )
                return _QUOTA_EXCEEDED

            error_detail = cls._parse_error(res)
            logger.warning(
                "Ollama single-turn: HTTP %d for model '%s': %s. Falling back to NLP.",
                res.status_code, LLM_MODEL_NAME, error_detail,
            )
        except Exception as e:
            logger.warning(
                "Ollama single-turn raised exception: %s. Falling back to NLP.", e
            )
        return _LLM_UNAVAILABLE

    @classmethod
    def generate_with_history(
        cls, system_prompt: str, history: List[Dict[str, str]]
    ) -> Optional[str]:
        """
        Sends a multi-turn conversational chat request to Ollama.
        Returns:
            str   — successful LLM reply
            None  — unavailable / unknown error (use NLP fallback)
            "quota_exceeded" — HTTP 429, free-tier limit hit (use quota fallback)
        """
        if not cls.is_ollama_available():
            logger.warning(
                "Ollama is not reachable at %s — skipping LLM, using NLP fallback.", OLLAMA_HOST
            )
            return _LLM_UNAVAILABLE

        try:
            truncated_history = history[-20:] if len(history) > 20 else history
            formatted_messages = [{"role": "system", "content": system_prompt}]
            for msg in truncated_history:
                formatted_messages.append(
                    {
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    }
                )

            payload = {
                "model": LLM_MODEL_NAME,
                "messages": formatted_messages,
                "stream": False,
                "options": {"temperature": 0.7},
            }
            res = requests.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=30)

            if res.status_code == 200:
                data = res.json()
                content = data.get("message", {}).get("content", "")
                if content:
                    return content
                logger.warning(
                    "Ollama multi-turn: HTTP 200 but empty content for model '%s'.", LLM_MODEL_NAME
                )
                return _LLM_UNAVAILABLE

            if res.status_code == 429:
                error_detail = cls._parse_error(res)
                logger.warning(
                    "Ollama multi-turn: HTTP 429 quota exhausted for model '%s': %s",
                    LLM_MODEL_NAME, error_detail,
                )
                return _QUOTA_EXCEEDED

            error_detail = cls._parse_error(res)
            logger.warning(
                "Ollama multi-turn: HTTP %d for model '%s': %s. Falling back to rule-based engine.",
                res.status_code, LLM_MODEL_NAME, error_detail,
            )
        except Exception as e:
            logger.warning(
                "Ollama multi-turn raised exception: %s. Falling back to rule-based engine.", e
            )
        return _LLM_UNAVAILABLE


# Export sentinel so callers can compare without importing private names
QUOTA_EXCEEDED_SENTINEL = _QUOTA_EXCEEDED
