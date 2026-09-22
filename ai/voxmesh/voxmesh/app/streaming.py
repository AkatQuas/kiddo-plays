from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class StreamingApp:
    """Composition root for the streaming ASR WebSocket service."""

    server: Any
    model_pool_manager: Any
    session_manager: Any
    config: Any

    @classmethod
    def create(cls, server: Any, model_pool_manager: Any, session_manager: Any, config: Any) -> "StreamingApp":
        return cls(
            server=server,
            model_pool_manager=model_pool_manager,
            session_manager=session_manager,
            config=config,
        )

    async def start(self) -> None:
        await self.server.start_server()

    async def shutdown(self) -> None:
        await self.server.shutdown()

    def get_pool_manager(self) -> Any:
        return self.model_pool_manager
