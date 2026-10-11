import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama3")

class LLMClient:
    """
    Interface for Llama 3 / LLM question generation.
    Attempts local Ollama / HuggingFace inference first;
    falls back seamlessly to structured rule-based NLP prompt templates if local server is unavailable.
    """

    @staticmethod
    def is_ollama_available() -> bool:
        try:
            res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=2)
            return res.status_code == 200
        except Exception:
            return False

    @classmethod
    def generate_with_prompt(cls, system_prompt: str, user_prompt: str) -> Optional[str]:
        """Sends request to local Llama 3 (Ollama) if available."""
        if not cls.is_ollama_available():
            return None

        try:
            payload = {
                "model": LLM_MODEL_NAME,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False,
                "options": {"temperature": 0.7}
            }
            res = requests.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=15)
            if res.status_code == 200:
                data = res.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.warning(f"Ollama Llama3 request failed: {e}. Falling back to NLP template generator.")
        return None
