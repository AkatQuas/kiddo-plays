"""LLM Response Object Definitions"""

from typing import Optional, Dict, List
from dataclasses import dataclass, field


@dataclass
class ToolCall:
    """Unified tool call object"""
    id: str
    name: str
    arguments: str


@dataclass
class LLMToolResponse:
    """Unified tool call response object"""
    content: Optional[str]
    tool_calls: List[ToolCall]
    model: str
    usage: Dict[str, int] = field(default_factory=dict)
    latency_ms: int = 0


@dataclass
class LLMResponse:
    """
    Unified LLM response object

    Contains response content, reasoning process (thinking model),
    token usage statistics, latency, and other information
    """

    content: str
    """Response content"""

    model: str
    """Actual model name used"""

    usage: Dict[str, int] = field(default_factory=dict)
    """Token usage statistics: {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}"""

    latency_ms: int = 0
    """Request latency (milliseconds)"""

    reasoning_content: Optional[str] = None
    """Reasoning process (only for thinking models such as o1, deepseek-reasoner)"""

    def __str__(self) -> str:
        """Backward compatibility: return content when printed directly"""
        return self.content

    def __repr__(self) -> str:
        """Detailed information display"""
        parts = [
            f"LLMResponse(model={self.model}",
            f"latency={self.latency_ms}ms",
            f"tokens={self.usage.get('total_tokens', 0)}",
        ]
        if self.reasoning_content:
            parts.append("has_reasoning=True")
        parts.append(f"content_length={len(self.content)})")
        return ", ".join(parts)

    def to_dict(self) -> Dict:
        """Convert to dictionary format for easy logging"""
        result = {
            "content": self.content,
            "model": self.model,
            "usage": self.usage,
            "latency_ms": self.latency_ms,
        }
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content
        return result


@dataclass
class StreamStats:
    """
    Streaming call statistics

    Available via llm.last_call_stats after streaming completes
    """

    model: str
    """Actual model name used"""

    usage: Dict[str, int] = field(default_factory=dict)
    """Token usage statistics"""

    latency_ms: int = 0
    """Request latency (milliseconds)"""

    reasoning_content: Optional[str] = None
    """Reasoning process (only for thinking models)"""

    def to_dict(self) -> Dict:
        """Convert to dictionary format"""
        result = {
            "model": self.model,
            "usage": self.usage,
            "latency_ms": self.latency_ms,
        }
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content
        return result