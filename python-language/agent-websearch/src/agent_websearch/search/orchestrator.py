# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any

from loguru import logger

from agent_websearch.search.blocklist import matched_blocklist_terms
from agent_websearch.search.providers.brave_api import BraveApiProvider
from agent_websearch.search.providers.serpapi import SerpApiProvider
from agent_websearch.search.providers.tavily import TavilyProvider
from agent_websearch.search.providers.tinyfish import TinyFishProvider
from agent_websearch.search.schema import make_response
from agent_websearch.settings import Settings, get_settings


class SearchOrchestrator:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._providers = {
            "tinyfish": TinyFishProvider(self.settings),
            "tavily": TavilyProvider(self.settings),
            "serpapi": SerpApiProvider(self.settings),
            "brave": BraveApiProvider(self.settings),
        }

    def available_providers(self) -> list[str]:
        return [name for name, p in self._providers.items() if p.configured()]

    async def run(
        self,
        *,
        query: str,
        source: str | None = None,
        max_results: int = 10,
        started_at: float,
    ) -> dict[str, Any]:
        blocked = matched_blocklist_terms(query)
        if blocked:
            return make_response(
                result=[],
                status="fail",
                status_msg="query matched blocklist",
                started_at=started_at,
            )

        if source:
            key = source.strip().lower()
            provider = self._providers.get(key)
            if provider is None:
                return make_response(
                    result=[],
                    status="fail",
                    status_msg=f"unknown source: {source}",
                    started_at=started_at,
                )
            if not provider.configured():
                return make_response(
                    result=[],
                    status="fail",
                    status_msg=f"provider not configured: {key}",
                    source=key,
                    started_at=started_at,
                )
            try:
                hits = await provider.search(query, max_results=max_results)
            except Exception as exc:
                logger.error(f"{key} search failed: {exc}")
                return make_response(
                    result=[],
                    status="fail",
                    status_msg=str(exc),
                    source=key,
                    started_at=started_at,
                )
            return make_response(
                result=hits,
                status="success" if hits else "fail",
                status_msg=None if hits else "empty result",
                source=key,
                started_at=started_at,
            )

        order = [
            name
            for name in self.settings.search_provider_order
            if name in self._providers and self._providers[name].configured()
        ]
        if not order:
            return make_response(
                result=[],
                status="fail",
                status_msg="no search providers configured",
                started_at=started_at,
            )

        errors: list[str] = []
        for name in order:
            provider = self._providers[name]
            try:
                hits = await provider.search(query, max_results=max_results)
            except Exception as exc:
                logger.error(f"{name} search failed: {exc}")
                errors.append(f"{name}: {exc}")
                continue
            if hits:
                return make_response(
                    result=hits,
                    status="success",
                    source=name,
                    started_at=started_at,
                )
            errors.append(f"{name}: empty")

        return make_response(
            result=[],
            status="fail",
            status_msg="; ".join(errors) if errors else "all providers empty",
            started_at=started_at,
        )
