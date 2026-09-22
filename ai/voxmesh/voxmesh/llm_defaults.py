"""Defaults for OpenAI-compatible LLM backends (Ollama, vLLM, LocalAI, etc.)."""

import os

DEFAULT_LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:11434/v1")
DEFAULT_LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
DEFAULT_LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
DEFAULT_LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))
