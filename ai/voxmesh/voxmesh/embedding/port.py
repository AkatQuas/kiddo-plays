from __future__ import annotations

import base64
from typing import Optional, Protocol, runtime_checkable

import numpy as np


@runtime_checkable
class SpeakerEmbeddingPort(Protocol):
    """Unified interface for speaker embedding extraction."""

    def is_available(self) -> bool:
        ...

    def get_model_name(self) -> str:
        ...

    def extract_from_audio_path(self, audio_path: str) -> Optional[np.ndarray]:
        ...

    def extract_from_chunk(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        ...


def embedding_to_base64(embedding: np.ndarray) -> str:
    return base64.b64encode(embedding.astype(np.float32).tobytes()).decode("utf-8")
