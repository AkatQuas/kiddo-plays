from datetime import datetime
from typing import List

from ...memory.base import MemoryConfig
from ...memory.manager import MemoryManager
from ..base import Tool


class MemoryTool(Tool):
    """Memory tool - Provides memory functionality for Agent"""

    def __init__(
        self,
        user_id: str = "default_user",
        memory_config: MemoryConfig | None = None,
        memory_types: List[str] | None = None
    ):
        super().__init__(
            name="memory",
            description="Memory tool - Can store and retrieve conversation history, knowledge, and experience"
        )

        # Initialize memory manager
        self.memory_config = memory_config or MemoryConfig()
        self.memory_types = memory_types or ["working", "episodic", "semantic"]

        self.memory_manager = MemoryManager(
            config=self.memory_config,
            user_id=user_id,
            enable_working="working" in self.memory_types,
            enable_episodic="episodic" in self.memory_types,
            enable_semantic="semantic" in self.memory_types,
            enable_perceptual="perceptual" in self.memory_types
        )

    def execute(self, action: str, **kwargs) -> str:
        """Execute memory operation

        Supported operations:
        - add: Add memory (supports 4 types: working/episodic/semantic/perceptual)
        - search: Search memory
        - summary: Get memory summary
        - stats: Get statistics
        - update: Update memory
        - remove: Delete memory
        - forget: Forget memory (multiple strategies)
        - consolidate: Consolidate memory (short-term → long-term)
        - clear_all: Clear all memories
        """

        if action == "add":
            return self._add_memory(**kwargs)
        elif action == "search":
            return self._search_memory(**kwargs)
        elif action == "summary":
            return self._get_summary(**kwargs)
        # ... other operations

    def _add_memory(
        self,
        content: str = "",
        memory_type: str = "working",
        importance: float = 0.5,
        file_path: str | None = None,
        modality: str | None = None,
        **metadata
    ) -> str:
        """Add memory"""
        try:
            # Ensure session ID exists
            if self.current_session_id is None:
                self.current_session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # Perceptual memory file support
            if memory_type == "perceptual" and file_path:
                inferred = modality or self._infer_modality(file_path)
                metadata.setdefault("modality", inferred)
                metadata.setdefault("raw_data", file_path)

            # Add session information to metadata
            metadata.update({
                "session_id": self.current_session_id,
                "timestamp": datetime.now().isoformat()
            })

            memory_id = self.memory_manager.add_memory(
                content=content,
                memory_type=memory_type,
                importance=importance,
                metadata=metadata,
                auto_classify=False
            )

            return f"✅ Memory added (ID: {memory_id[:8]}...)"

        except Exception as e:
            return f"❌ Failed to add memory: {str(e)}"

    def _search_memory(
        self,
        query: str,
        limit: int = 5,
        memory_types: List[str] | None = None,
        memory_type: str | None= None,
        min_importance: float = 0.1
    ) -> str:
        """Search memory"""
        try:
            # Parameter standardization
            if memory_type and not memory_types:
                memory_types = [memory_type]

            results = self.memory_manager.retrieve_memories(
                query=query,
                limit=limit,
                memory_types=memory_types,
                min_importance=min_importance
            )

            if not results:
                return f"🔍 No memories found related to '{query}'"

            # Format results
            formatted_results = []
            formatted_results.append(f"🔍 Found {len(results)} related memories:")

            for i, memory in enumerate(results, 1):
                memory_type_label = {
                    "working": "Working Memory",
                    "episodic": "Episodic Memory",
                    "semantic": "Semantic Memory",
                    "perceptual": "Perceptual Memory"
                }.get(memory.memory_type, memory.memory_type)

                content_preview = memory.content[:80] + "..." if len(memory.content) > 80 else memory.content
                formatted_results.append(
                    f"{i}. [{memory_type_label}] {content_preview} (Importance: {memory.importance:.2f})"
                )

            return "\n".join(formatted_results)

        except Exception as e:
            return f"❌ Failed to search memory: {str(e)}"

    def _forget(self, strategy: str = "importance_based", threshold: float = 0.1, max_age_days: int = 30) -> str:
        """Forget memories (supports multiple strategies)"""
        try:
            count = self.memory_manager.forget_memories(
                strategy=strategy,
                threshold=threshold,
                max_age_days=max_age_days
            )
            return f"🧹 Forgot {count} memories (strategy: {strategy})"
        except Exception as e:
            return f"❌ Failed to forget memories: {str(e)}"

    def _consolidate(self, from_type: str = "working", to_type: str = "episodic", importance_threshold: float = 0.7) -> str:
        """Consolidate memories (promote important short-term memories to long-term memories)"""
        try:
            count = self.memory_manager.consolidate_memories(
                from_type=from_type,
                to_type=to_type,
                importance_threshold=importance_threshold,
            )
            return f"🔄 Consolidated {count} memories to long-term memory ({from_type} → {to_type}, threshold={importance_threshold})"
        except Exception as e:
            return f"❌ Failed to consolidate memories: {str(e)}"
