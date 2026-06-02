from typing import Dict, List

from ..base import BaseMemory, MemoryConfig


class SemanticMemory(BaseMemory):
    """Semantic memory implementation\n
    Abstract knowledge and concepts

    Features:
    - Uses HuggingFace Chinese pre-trained models for text embedding
    - Vector retrieval for fast similarity matching
    - Knowledge graph storage for entities and relationships
    - Hybrid retrieval strategy: vector + graph + semantic reasoning
    """

    def __init__(self, config: MemoryConfig, storage_backend: MemoryRetriever | None = None):
        super().__init__(config, storage_backend)

        # Embedding model (unified provision)
        self.embedding_model = get_text_embedder()

        # Professional database storage
        self.vector_store = QdrantConnectionManager.get_instance(**qdrant_config)
        self.graph_store = Neo4jGraphStore(**neo4j_config)

        # Entity and relation cache
        self.entities: Dict[str, Entity] = {}
        self.relations: List[Relation] = []

        # NLP processor (supports Chinese and English)
        self.nlp = self._init_nlp()

    def add(self, memory_item: MemoryItem) -> str:
        """Add semantic memory"""
        # 1. Generate text embedding
        embedding = self.embedding_model.encode(memory_item.content)

        # 2. Extract entities and relations
        entities = self._extract_entities(memory_item.content)
        relations = self._extract_relations(memory_item.content, entities)

        # 3. Store to Neo4j graph database
        for entity in entities:
            self._add_entity_to_graph(entity, memory_item)

        for relation in relations:
            self._add_relation_to_graph(relation, memory_item)

        # 4. Store to Qdrant vector database
        metadata = {
            "memory_id": memory_item.id,
            "entities": [e.entity_id for e in entities],
            "entity_count": len(entities),
            "relation_count": len(relations)
        }

        self.vector_store.add_vectors(
            vectors=[embedding.tolist()],
            metadata=[metadata],
            ids=[memory_item.id]
        )

    def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
        """Retrieve semantic memory"""
        # 1. Vector retrieval
        vector_results = self._vector_search(query, limit * 2, user_id)

        # 2. Graph retrieval
        graph_results = self._graph_search(query, limit * 2, user_id)

        # 3. Hybrid ranking
        combined_results = self._combine_and_rank_results(
            vector_results, graph_results, query, limit
        )

        return combined_results[:limit]
    def _combine_and_rank_results(self, vector_results, graph_results, query, limit):
        """Hybrid ranking of results"""
        combined = {}

        # Merge vector and graph retrieval results
        for result in vector_results:
            combined[result["memory_id"]] = {
                **result,
                "vector_score": result.get("score", 0.0),
                "graph_score": 0.0
            }

        for result in graph_results:
            memory_id = result["memory_id"]
            if memory_id in combined:
                combined[memory_id]["graph_score"] = result.get("similarity", 0.0)
            else:
                combined[memory_id] = {
                    **result,
                    "vector_score": 0.0,
                    "graph_score": result.get("similarity", 0.0)
                }

        # Calculate hybrid score
        for memory_id, result in combined.items():
            vector_score = result["vector_score"]
            graph_score = result["graph_score"]
            importance = result.get("importance", 0.5)

            # Base relevance score
            base_relevance = vector_score * 0.7 + graph_score * 0.3

            # Importance weight [0.8, 1.2]
            importance_weight = 0.8 + (importance * 0.4)

            # Final score: similarity * importance weight
            combined_score = base_relevance * importance_weight
            result["combined_score"] = combined_score

        # Sort and return
        sorted_results = sorted(
            combined.values(),
            key=lambda x: x["combined_score"],
            reverse=True
        )

        return sorted_results[:limit]
