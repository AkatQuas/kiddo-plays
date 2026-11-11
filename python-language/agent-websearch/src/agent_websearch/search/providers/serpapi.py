# -*- coding: utf-8 -*-
from __future__ import annotations

import random
from typing import Any

import httpx
from loguru import logger

from agent_websearch.search.providers.base import normalize_item
from agent_websearch.settings import Settings


class SerpApiProvider:
    name = "serpapi"
    url = "https://serpapi.com/search.json"

    def __init__(self, settings: Settings) -> None:
        self._keys = settings.serpapi_api_keys

    def configured(self) -> bool:
        return bool(self._keys)

    async def search(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        if not self._keys:
            return []
        api_key = random.choice(self._keys)
        params = {
            "engine": "google",
            "q": query,
            "api_key": api_key,
            "num": max_results,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(self.url, params=params)
            resp.raise_for_status()
            data = resp.json()
        results: list[dict[str, Any]] = []
        for row in data.get("organic_results") or []:
            results.append(
                normalize_item(
                    title=row.get("title"),
                    link=row.get("link"),
                    snippet=row.get("snippet"),
                    extra={"position": row.get("position")},
                )
            )
            if len(results) >= max_results:
                break
        logger.info(f"serpapi returned {len(results)} hits for query length={len(query)}")
        return results
