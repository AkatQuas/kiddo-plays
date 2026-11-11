# -*- coding: utf-8 -*-
from fastapi.testclient import TestClient

from agent_websearch.app import app


def test_health():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "providers" in body
    assert "s3_configured" in body


def test_search_requires_token(monkeypatch):
    monkeypatch.setenv("API_BEARER_TOKEN", "test-token")
    from agent_websearch import settings as settings_mod

    settings_mod.get_settings.cache_clear()
    client = TestClient(app)
    resp = client.post("/v1/search", json={"query": "hello"})
    assert resp.status_code in (401, 403)
