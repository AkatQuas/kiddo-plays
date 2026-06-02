"""Observability Module

Provides TraceLogger for recording Agent execution traces:
- JSONL format: machine-readable, supports streaming analysis
- HTML format: human-readable, visual audit interface
"""

from .trace_logger import TraceLogger

__all__ = ["TraceLogger"]
