from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PushResult:
    channel: str
    success: bool
    message: str = ""
    attempts: int = 1


class PushChannel(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def send(self, title: str, content: str) -> PushResult:
        ...
