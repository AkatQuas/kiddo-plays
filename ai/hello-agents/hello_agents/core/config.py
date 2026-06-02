"""Configuration management"""
import os
from typing import Any, Dict, Optional

from pydantic import BaseModel


class Config(BaseModel):
    """HelloAgents configuration class"""

    # LLM configuration
    default_model: str = "qwen3-8b"
    default_provider: str = "openai"
    temperature: float = 0.7
    max_tokens: Optional[int] = None

    # System configuration
    debug: bool = False
    log_level: str = "INFO"

    # Other configuration
    max_history_length: int = 100

    @classmethod
    def from_env(cls) -> "Config":
        """Create configuration from environment variables"""
        return cls(
            debug=os.getenv("DEBUG", "false").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            temperature=float(os.getenv("TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("MAX_TOKENS")) if os.getenv("MAX_TOKENS") else None, # type: ignore
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return self.model_dump()
