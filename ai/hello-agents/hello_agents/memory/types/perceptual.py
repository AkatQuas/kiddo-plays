import math
from datetime import datetime
from typing import List

from ..base import BaseMemory, MemoryConfig


class PerceptualMemory(BaseMemory):
    """Perceptual memory implementation\n
    Multimodal information

    Features:
    - Supports multimodal data (text, images, audio, etc.)
    - Cross-modal similarity search
    - Semantic understanding of perceptual data
    - Supports content generation and retrieval
    """

    def __init__(self, config: MemoryConfig, storage_backend: MemoryRetriever | None = None):
        super().__init__(config, storage_backend)

        # Multimodal encoders
        self.text_embedder = get_text_embedder()
        self._clip_model = self._init_clip_model()  # Image encoding
        self._clap_model = self._init_clap_model()  # Audio encoding

        # Modality-separated vector storage
        self.vector_stores = {
            "text": QdrantConnectionManager.get_instance(
                collection_name="perceptual_text",
                vector_size=self.vector_dim
            ),
            "image": QdrantConnectionManager.get_instance(
                collection_name="perceptual_image",
                vector_size=self._image_dim
            ),
            "audio": QdrantConnectionManager.get_instance(
                collection_name="perceptual_audio",
                vector_size=self._audio_dim
            )
        }

    def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
        """Retrieve perceptual memory (can filter modality; same-modality vector retrieval + time/importance fusion)"""
        user_id = kwargs.get("user_id")
        target_modality = kwargs.get("target_modality")
        query_modality = kwargs.get("query_modality", target_modality or "text")

        # Same-modality vector retrieval
        try:
            query_vector = self._encode_data(query, query_modality)
            store = self._get_vector_store_for_modality(target_modality or query_modality)

            where = {"memory_type": "perceptual"}
            if user_id:
                where["user_id"] = user_id
            if target_modality:
                where["modality"] = target_modality

            hits = store.search_similar(
                query_vector=query_vector,
                limit=max(limit * 5, 20),
                where=where
            )
        except Exception:
            hits = []

        # Fusion ranking (vector similarity + temporal recency + importance weight)
        results = []
        for hit in hits:
            vector_score = float(hit.get("score", 0.0))
            recency_score = self._calculate_recency_score(hit["metadata"]["timestamp"])
            importance = hit["metadata"].get("importance", 0.5)

            # Scoring algorithm
            base_relevance = vector_score * 0.8 + recency_score * 0.2
            importance_weight = 0.8 + (importance * 0.4)
            combined_score = base_relevance * importance_weight

            results.append((combined_score, self._create_memory_item(hit)))

        results.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in results[:limit]]

    def _calculate_recency_score(self, timestamp: str) -> float:
        """Calculate temporal recency score"""
        try:
            memory_time = datetime.fromisoformat(timestamp)
            current_time = datetime.now()
            age_hours = (current_time - memory_time).total_seconds() / 3600

            # Exponential decay: maintain high score within 24 hours, then gradually decay
            decay_factor = 0.1  # Decay coefficient
            recency_score = math.exp(-decay_factor * age_hours / 24)

            return max(0.1, recency_score)  # Maintain minimum base score of 0.1
        except Exception:
            return 0.5  # Default medium score
