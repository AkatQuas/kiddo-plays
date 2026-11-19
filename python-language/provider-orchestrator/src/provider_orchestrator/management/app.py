"""
Management API skeleton.

Exposes key registry, token-pool stats, and a demo dispatch endpoint.
Protect with MANAGEMENT_API_TOKEN. Product adapters remain swappable.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from provider_orchestrator.adapters.echo import EchoAdapter
from provider_orchestrator.adapters.fallback_static import StaticFallbackAdapter
from provider_orchestrator.config import get_settings
from provider_orchestrator.keys.memory_store import InMemoryKeyStore
from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.pool.token_pool import TokenPool
from provider_orchestrator.ports.product import ProductRequest
from provider_orchestrator.scheduler.dispatch import Dispatcher
from provider_orchestrator.scheduler.memory_cache import InMemoryCache
from provider_orchestrator.session.broker import AccountSession, SessionBroker


def create_app() -> FastAPI:
    settings = get_settings()
    store = InMemoryKeyStore()
    registry = KeyRegistry(store)
    for i, raw in enumerate(settings.parsed_demo_keys()):
        registry.add(
            platform="echo",
            access_key=raw,
            name=f"demo-{i}",
            hour_limit=settings.key_hour_limit,
            month_limit=settings.key_month_limit,
        )
    # Always ensure at least one demo key so local boots work
    if not registry.list("echo"):
        registry.add(
            platform="echo",
            access_key="demo-local-key",
            name="local",
            hour_limit=settings.key_hour_limit,
            month_limit=settings.key_month_limit,
        )

    cache = InMemoryCache(default_ttl=settings.cache_ttl_seconds)
    dispatcher = Dispatcher(
        adapters=[EchoAdapter(name="echo")],
        registry=registry,
        cache=cache,
        fallback=StaticFallbackAdapter(),
        platform_order=["echo"],
        cache_ttl_seconds=settings.cache_ttl_seconds,
    )
    tokens = settings.parsed_demo_keys() or ["demo-local-key"]
    token_pool = TokenPool(
        tokens=tokens[: settings.token_pool_size],
        qps_per_token=settings.token_pool_qps_per_token,
    )
    sessions = SessionBroker()

    app = FastAPI(
        title="Provider Orchestrator Management",
        version="0.1.0",
        description=(
            "Architecture demo: key/quota management, token pool stats, "
            "and replaceable product dispatch. Not a production crawler."
        ),
    )

    def require_token(x_api_token: Optional[str] = Header(default=None)) -> None:
        expected = settings.management_api_token
        if not expected or expected == "change-me":
            # still require header equality to the configured value
            pass
        if x_api_token != expected:
            raise HTTPException(status_code=401, detail="invalid management token")

    class CreateKeyBody(BaseModel):
        platform: str = "echo"
        name: str = ""
        access_key: str
        hour_limit: Optional[int] = None
        month_limit: Optional[int] = None

    class DispatchBody(BaseModel):
        query: str
        params: dict = Field(default_factory=dict)

    class SessionBody(BaseModel):
        account_id: str
        label: str = ""
        credential: str
        region: str = "default"

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/keys", dependencies=[Depends(require_token)])
    def list_keys(platform: Optional[str] = None):
        return registry.quota_snapshot() if platform is None else [
            k.public_view() for k in registry.list(platform)
        ]

    @app.post("/api/keys", dependencies=[Depends(require_token)])
    def create_key(body: CreateKeyBody):
        key = registry.add(
            platform=body.platform,
            access_key=body.access_key,
            name=body.name,
            hour_limit=body.hour_limit if body.hour_limit is not None else settings.key_hour_limit,
            month_limit=body.month_limit if body.month_limit is not None else settings.key_month_limit,
        )
        return key.public_view()

    @app.get("/api/pool/stats", dependencies=[Depends(require_token)])
    def pool_stats():
        s = token_pool.stats()
        return {"size": s.size, "qps_per_token": s.qps_per_token, "slots": s.slots}

    @app.post("/api/dispatch", dependencies=[Depends(require_token)])
    async def dispatch(body: DispatchBody):
        out = await dispatcher.dispatch(
            ProductRequest(query=body.query, params=body.params)
        )
        return {
            "ok": out.result.ok,
            "provider": out.result.provider,
            "from_cache": out.result.from_cache,
            "from_fallback": out.result.from_fallback,
            "items": out.result.items,
            "error": out.result.error,
            "attempts": out.attempts,
        }

    @app.get("/api/sessions", dependencies=[Depends(require_token)])
    def list_sessions():
        return sessions.list_public()

    @app.post("/api/sessions", dependencies=[Depends(require_token)])
    def upsert_session(body: SessionBody):
        acc = sessions.upsert(
            AccountSession(
                account_id=body.account_id,
                label=body.label,
                credential=body.credential,
                region=body.region,
            )
        )
        return acc.public_view()

    # stash for tests / examples
    app.state.registry = registry
    app.state.dispatcher = dispatcher
    app.state.token_pool = token_pool
    app.state.sessions = sessions
    return app


app = create_app()
