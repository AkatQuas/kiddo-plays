from typing import List

from ..base import MemoryConfig


class EpisodicMemory:
    """Episodic memory implementation\n
    Specific events and experiences

    Features:
    - SQLite+Qdrant hybrid storage architecture
    - Supports time series and session-level retrieval
    - Structured filtering + semantic vector retrieval
    """

    def __init__(self, config: MemoryConfig):
        self.doc_store = SQLiteDocumentStore(config.database_path)
        self.vector_store = QdrantVectorStore(config.qdrant_url, config.qdrant_api_key)
        self.embedder = create_embedding_model_with_fallback()
        self.sessions = {}  # Session index

    def add(self, memory_item: MemoryItem) -> str:
        """Add episodic memory"""
        # Create episode object
        episode = Episode(
            episode_id=memory_item.id,
            session_id=memory_item.metadata.get("session_id", "default"),
            timestamp=memory_item.timestamp,
            content=memory_item.content,
            context=memory_item.metadata
        )

        # Update session index
        session_id = episode.session_id
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        self.sessions[session_id].append(episode.episode_id)

        # Persistent storage (SQLite + Qdrant)
        self._persist_episode(episode)
        return memory_item.id

    def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
        """Hybrid retrieval: structured filtering + semantic vector retrieval"""
        # 1. Structured pre-filtering (time range, importance, etc.)
        candidate_ids = self._structured_filter(**kwargs)

        # 2. Vector semantic retrieval
        hits = self._vector_search(query, limit * 5, kwargs.get("user_id"))

        # 3. Comprehensive scoring and sorting
        results = []
        for hit in hits:
            if self._should_include(hit, candidate_ids, kwargs):
                score = self._calculate_episode_score(hit)
                memory_item = self._create_memory_item(hit)
                results.append((score, memory_item))

        results.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in results[:limit]]

    def _calculate_episode_score(self, hit) -> float:
        """Episodic memory scoring algorithm"""
        vec_score = float(hit.get("score", 0.0))
        recency_score = self._calculate_recency(hit["metadata"]["timestamp"])
        importance = hit["metadata"].get("importance", 0.5)

        # Scoring formula: (vector similarity × 0.8 + temporal recency × 0.2) × importance weight
        base_relevance = vec_score * 0.8 + recency_score * 0.2
        importance_weight = 0.8 + (importance * 0.4)

        return base_relevance * importance_weight
