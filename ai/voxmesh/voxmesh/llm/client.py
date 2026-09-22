from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import httpx
import openai

from voxmesh.llm_defaults import (
    DEFAULT_LLM_API_KEY,
    DEFAULT_LLM_API_URL,
    DEFAULT_LLM_MAX_TOKENS,
    DEFAULT_LLM_MODEL,
)


@dataclass(frozen=True)
class LLMClientConfig:
    api_url: str = DEFAULT_LLM_API_URL
    api_key: str = DEFAULT_LLM_API_KEY
    model: str = DEFAULT_LLM_MODEL
    max_tokens: int = DEFAULT_LLM_MAX_TOKENS
    connect_timeout: float = 0.5
    timeout: float = 10.0


def create_openai_client(config: LLMClientConfig) -> Optional[openai.Client]:
    try:
        timeout = httpx.Timeout(
            connect=config.connect_timeout,
            read=config.timeout,
            write=config.timeout,
            pool=config.timeout,
        )
        return openai.Client(
            base_url=config.api_url,
            api_key=config.api_key,
            timeout=timeout,
        )
    except Exception:
        return None
