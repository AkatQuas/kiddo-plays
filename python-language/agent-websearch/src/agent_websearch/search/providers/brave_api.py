# -*- coding: utf-8 -*-
from __future__ import annotations

import random
from typing import Any

import httpx
from loguru import logger

from agent_websearch.search.providers.base import normalize_item
from agent_websearch.settings import Settings


class BraveApiProvider:
    """Brave Search official Web Search API (not HTML scraping)."""

    name = "brave"
    url = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, settings: Settings) -> None:
        self._keys = settings.brave_api_keys

    def configured(self) -> bool:
        return bool(self._keys)

    async def search(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        if not self._keys:
            return []
        api_key = random.choice(self._keys)
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key,
        }
        params = {"q": query, "count": max_results}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(self.url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        web = (data.get("web") or {}).get("results") or []
        results: list[dict[str, Any]] = []
        for row in web:
            results.append(
                normalize_item(
                    title=row.get("title"),
                    link=row.get("url"),
                    snippet=row.get("description"),
                )
            )
            if len(results) >= max_results:
                break
        logger.info(f"brave returned {len(results)} hits for query length={len(query)}")
        return results
