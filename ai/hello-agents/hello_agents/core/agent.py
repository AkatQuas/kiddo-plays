"""Agent base class"""
from abc import ABC, abstractmethod
from typing import Optional

from .config import Config
from .llm import HelloAgentsLLM
from .message import Message


class Agent(ABC):
    """Agent base class"""

    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None
    ):
        self.name = name
        self.llm = llm
        self.system_prompt = system_prompt
        self.config = config or Config()
        self._history: list[Message] = []

    @abstractmethod
    def run(self, input_text: str, **kwargs) -> str:
        """Run Agent"""
        pass

    def add_message(self, message: Message):
        """Add message to history"""
        self._history.append(message)

    def clear_history(self):
        """Clear history"""
        self._history.clear()

    def get_history(self) -> list[Message]:
        """Get history"""
        return self._history.copy()

    def __str__(self) -> str:
        return f"Agent(name={self.name})"
