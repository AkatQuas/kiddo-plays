"""Replaceable product adapters (demos only)."""

from provider_orchestrator.adapters.echo import EchoAdapter
from provider_orchestrator.adapters.fallback_static import StaticFallbackAdapter

__all__ = ["EchoAdapter", "StaticFallbackAdapter"]
