"""Memory System Base Classes and Configuration

Base components designed according to Chapter 8 architecture:
- MemoryItem: Memory item data structure
- MemoryConfig: Memory system configuration
- BaseMemory: Base memory class
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel


class MemoryItem(BaseModel):
    """Memory item data structure"""
    id: str
    content: str
    memory_type: str
    user_id: str
    timestamp: datetime
    importance: float = 0.5
    metadata: Dict[str, Any] = {}

    class Config:
        arbitrary_types_allowed = True

class MemoryConfig(BaseModel):
    """Memory system configuration"""

    # Storage path
    storage_path: str = "./memory_data"

    # Basic config for statistics display (for display only)
    max_capacity: int = 100
    importance_threshold: float = 0.1
    decay_factor: float = 0.95

    # Working memory specific config
    working_memory_capacity: int = 10
    working_memory_tokens: int = 2000
    working_memory_ttl_minutes: int = 120

    # Perceptual memory specific config
    perceptual_memory_modalities: List[str] = ["text", "image", "audio", "video"]

class BaseMemory(ABC):
    """Base Memory Class

    Defines common interfaces and behaviors for all memory types
    """

    def __init__(self, config: MemoryConfig, storage_backend=None):
        self.config = config
        self.storage = storage_backend
        self.memory_type = self.__class__.__name__.lower().replace("memory", "")

    @abstractmethod
    def add(self, memory_item: MemoryItem) -> str:
        """Add a memory item

        Args:
            memory_item: Memory item object

        Returns:
            Memory ID
        """
        pass

    @abstractmethod
    def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
        """Retrieve relevant memories

        Args:
            query: Query content
            limit: Maximum number of results
            **kwargs: Other retrieval parameters

        Returns:
            List of relevant memories
        """
        pass

    @abstractmethod
    def update(self, memory_id: str, content: str | None = None,
               importance: float | None = None, metadata: Dict[str, Any] | None = None) -> bool:
        """Update memory

        Args:
            memory_id: Memory ID
            content: New content
            importance: New importance score
            metadata: New metadata

        Returns:
            Whether update succeeded
        """
        pass

    @abstractmethod
    def remove(self, memory_id: str) -> bool:
        """Delete memory

        Args:
            memory_id: Memory ID

        Returns:
            Whether deletion succeeded
        """
        pass

    @abstractmethod
    def has_memory(self, memory_id: str) -> bool:
        """Check if memory exists

        Args:
            memory_id: Memory ID

        Returns:
            Whether exists
        """
        pass

    @abstractmethod
    def clear(self):
        """Clear all memories"""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics

        Returns:
            Statistics dictionary
        """
        pass

    def _generate_id(self) -> str:
        """Generate memory ID"""
        import uuid
        return str(uuid.uuid4())

    def _calculate_importance(self, content: str, base_importance: float = 0.5) -> float:
        """Calculate memory importance

        Args:
            content: Memory content
            base_importance: Base importance

        Returns:
            Calculated importance score
        """
        importance = base_importance

        # Based on content length
        if len(content) > 100:
            importance += 0.1

        # Based on keywords
        important_keywords = ["important", "critical", "must", "note", "warning", "error"]
        if any(keyword in content for keyword in important_keywords):
            importance += 0.2

        return max(0.0, min(1.0, importance))

    def __str__(self) -> str:
        stats = self.get_stats()
        return f"{self.__class__.__name__}(count={stats.get('count', 0)})"

    def __repr__(self) -> str:
        return self.__str__()
