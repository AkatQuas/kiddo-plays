"""Message system"""
from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel

# Define message role type, restricting its values
MessageRole = Literal["user", "assistant", "system", "tool"]

class Message(BaseModel):
    """Message class"""

    content: str
    role: MessageRole
    timestamp: datetime | None = None
    metadata: Optional[Dict[str, Any]] = None

    def __init__(self, content: str, role: MessageRole, **kwargs):
        super().__init__(
            content=content,
            role=role,
            timestamp=kwargs.get('timestamp', datetime.now()),
            metadata=kwargs.get('metadata', {})
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format (OpenAI API format)"""
        return {
            "role": self.role,
            "content": self.content
        }

    def __str__(self) -> str:
        return f"[{self.role}] {self.content}"
