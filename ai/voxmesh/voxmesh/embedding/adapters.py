from __future__ import annotations

from typing import Any, Optional

import numpy as np


class StreamingEmbeddingAdapter:
    """Adapter for streaming ``SpeakerClustering`` embedding extraction."""

    def __init__(self, speaker_clustering: Any):
        self._clustering = speaker_clustering

    def is_available(self) -> bool:
        return self._clustering is not None

    def get_model_name(self) -> str:
        return getattr(self._clustering, "embedding_model_dir", "streaming-embedding")

    def extract_from_audio_path(self, audio_path: str) -> Optional[np.ndarray]:
        return None

    def extract_from_chunk(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        if not self.is_available():
            return None
        return self._clustering.extract_chunk_features(chunk_data)


class OfflineEmbeddingAdapter:
    """Adapter for offline ``EmbeddingService``."""

    def __init__(self, embedding_service: Any):
        self._service = embedding_service

    def is_available(self) -> bool:
        return self._service is not None and self._service.is_model_loaded()

    def get_model_name(self) -> str:
        if not self.is_available():
            return "offline-embedding"
        info = self._service.get_model_info()
        return info.get("model_name", "offline-embedding")

    def extract_from_audio_path(self, audio_path: str) -> Optional[np.ndarray]:
        if not self.is_available():
            return None
        return self._service._extract_features_from_audio_file(audio_path)

    def extract_from_chunk(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        return None
