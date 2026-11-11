# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Protocol


class SearchProvider(Protocol):
    name: str

    def configured(self) -> bool: ...

    async def search(self, query: str, max_results: int = 10) -> list[dict[str, Any]]: ...


def normalize_item(
    *,
    title: str | None = None,
    link: str | None = None,
    snippet: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "title": title or "",
        "link": link or "",
        "snippet": snippet or "",
    }
    if extra:
        item.update(extra)
    return item
