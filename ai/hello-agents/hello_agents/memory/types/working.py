from typing import List

from ..base import MemoryConfig


class WorkingMemory:
    """Working memory implementation\n
    Temporary information

    Features:
    - Limited capacity (default 50 items) + TTL automatic cleanup
    - Pure in-memory storage, extremely fast access
    - Hybrid retrieval: TF-IDF vectorization + keyword matching
    """

    def __init__(self, config: MemoryConfig):
        self.max_capacity = config.working_memory_capacity or 50
        self.max_age_minutes = config.working_memory_ttl or 60
        self.memories = []

    def add(self, memory_item: MemoryItem) -> str:
        """Add working memory"""
        self._expire_old_memories()  # Expiration cleanup

        if len(self.memories) >= self.max_capacity:
            self._remove_lowest_priority_memory()  # Capacity management

        self.memories.append(memory_item)
        return memory_item.id

    def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
        """Hybrid retrieval: TF-IDF vectorization + keyword matching"""
        self._expire_old_memories()

        # Try TF-IDF vector retrieval
        vector_scores = self._try_tfidf_search(query)

        # Calculate comprehensive score
        scored_memories = []
        for memory in self.memories:
            vector_score = vector_scores.get(memory.id, 0.0)
            keyword_score = self._calculate_keyword_score(query, memory.content)

            # Hybrid scoring
            base_relevance = vector_score * 0.7 + keyword_score * 0.3 if vector_score > 0 else keyword_score
            time_decay = self._calculate_time_decay(memory.timestamp)
            importance_weight = 0.8 + (memory.importance * 0.4)

            final_score = base_relevance * time_decay * importance_weight
            if final_score > 0:
                scored_memories.append((final_score, memory))

        scored_memories.sort(key=lambda x: x[0], reverse=True)
        return [memory for _, memory in scored_memories[:limit]]
