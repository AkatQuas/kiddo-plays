# -*- coding: utf-8 -*-
from __future__ import annotations

import time

import pytest

from agent_websearch.search.orchestrator import SearchOrchestrator
from agent_websearch.settings import Settings


class _FakeProvider:
    def __init__(self, name: str, hits: list | None = None, error: Exception | None = None):
        self.name = name
        self._hits = hits or []
        self._error = error
        self._configured = True

    def configured(self) -> bool:
        return self._configured

    async def search(self, query: str, max_results: int = 10):
        if self._error:
            raise self._error
        return self._hits[:max_results]


@pytest.mark.asyncio
async def test_no_providers_configured(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    monkeypatch.delenv("SERPAPI_API_KEY", raising=False)
    monkeypatch.delenv("TINYFISH_API_KEY", raising=False)
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)
    from agent_websearch import settings as settings_mod

    settings_mod.get_settings.cache_clear()
    orch = SearchOrchestrator(Settings())
    resp = await orch.run(query="hello", started_at=time.time())
    assert resp["status"] == "fail"
    assert "no search providers" in (resp["status_msg"] or "")


@pytest.mark.asyncio
async def test_fallback_order(monkeypatch):
    settings = Settings()
    settings.search_provider_order = ["tinyfish", "tavily"]
    orch = SearchOrchestrator(settings)
    orch._providers = {
        "tinyfish": _FakeProvider("tinyfish", hits=[]),
        "tavily": _FakeProvider(
            "tavily",
            hits=[{"title": "ok", "link": "https://example.com", "snippet": "s"}],
        ),
        "serpapi": _FakeProvider("serpapi", hits=[]),
        "brave": _FakeProvider("brave", hits=[]),
    }
    # mark configured
    for p in orch._providers.values():
        p._configured = True

    resp = await orch.run(query="weather", started_at=time.time())
    assert resp["status"] == "success"
    assert resp["source"] == "tavily"
    assert resp["result"][0]["title"] == "ok"


@pytest.mark.asyncio
async def test_forced_source_not_configured(monkeypatch):
    settings = Settings()
    orch = SearchOrchestrator(settings)
    empty = _FakeProvider("tavily")
    empty._configured = False
    orch._providers = {"tavily": empty, "tinyfish": empty, "serpapi": empty, "brave": empty}
    resp = await orch.run(query="x", source="tavily", started_at=time.time())
    assert resp["status"] == "fail"
    assert "not configured" in (resp["status_msg"] or "")
