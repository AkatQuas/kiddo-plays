from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

from voxmesh.embedding.adapters import OfflineEmbeddingAdapter
from voxmesh.embedding.port import SpeakerEmbeddingPort
from voxmesh.version import get_version


@dataclass
class OfflineApp:
    """Composition root for the offline HTTP ASR service."""

    args: Any
    model: Any
    model_english: Any
    embedding_service: Any
    model_lock: asyncio.Lock
    version: str
    param_dict: dict

    @classmethod
    def build(
        cls,
        args: Any,
        model: Any,
        model_english: Any,
        embedding_service: Any,
        param_dict: Optional[dict] = None,
    ) -> "OfflineApp":
        return cls(
            args=args,
            model=model,
            model_english=model_english,
            embedding_service=embedding_service,
            model_lock=asyncio.Lock(),
            version=get_version(),
            param_dict=param_dict or {"sentence_timestamp": True, "batch_size_s": 300},
        )

    def embedding_port(self) -> Optional[SpeakerEmbeddingPort]:
        if self.embedding_service is None:
            return None
        return OfflineEmbeddingAdapter(self.embedding_service)

    def is_embedding_available(self) -> bool:
        port = self.embedding_port()
        return port is not None and port.is_available()
