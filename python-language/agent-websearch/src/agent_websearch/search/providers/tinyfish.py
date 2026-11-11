# -*- coding: utf-8 -*-
from __future__ import annotations

import random
from typing import Any

import httpx
from loguru import logger

from agent_websearch.search.providers.base import normalize_item
from agent_websearch.settings import Settings


class TinyFishProvider:
    name = "tinyfish"
    url = "https://api.search.tinyfish.ai/v1/search"

    def __init__(self, settings: Settings) -> None:
        self._keys = settings.tinyfish_api_keys

    def configured(self) -> bool:
        return bool(self._keys)

    async def search(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        if not self._keys:
            return []
        api_key = random.choice(self._keys)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {"query": query, "limit": max_results}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        rows = data.get("results") or data.get("data") or data.get("organic") or []
        if isinstance(data, list):
            rows = data
        results: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            results.append(
                normalize_item(
                    title=row.get("title") or row.get("name"),
                    link=row.get("link") or row.get("url"),
                    snippet=row.get("snippet") or row.get("description") or row.get("content"),
                )
            )
            if len(results) >= max_results:
                break
        logger.info(f"tinyfish returned {len(results)} hits for query length={len(query)}")
        return results
