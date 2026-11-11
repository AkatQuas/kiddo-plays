# -*- coding: utf-8 -*-
from __future__ import annotations

import random
from typing import Any

import httpx
from loguru import logger

from agent_websearch.search.providers.base import normalize_item
from agent_websearch.settings import Settings


class TavilyProvider:
    name = "tavily"
    url = "https://api.tavily.com/search"

    def __init__(self, settings: Settings) -> None:
        self._keys = settings.tavily_api_keys

    def configured(self) -> bool:
        return bool(self._keys)

    async def search(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        if not self._keys:
            return []
        api_key = random.choice(self._keys)
        payload = {
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
            "include_answer": False,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        results: list[dict[str, Any]] = []
        for row in data.get("results") or []:
            results.append(
                normalize_item(
                    title=row.get("title"),
                    link=row.get("url"),
                    snippet=row.get("content"),
                    extra={"score": row.get("score")},
                )
            )
        logger.info(f"tavily returned {len(results)} hits for query length={len(query)}")
        return results
