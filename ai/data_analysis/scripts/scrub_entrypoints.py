#!/usr/bin/env python3
"""Scrub main.py and mcp_server.py for the weekend data_analysis OSS tree."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "data_analysis"


def rewrite_imports(text: str) -> str:
    text = re.sub(r"\bfrom app\.", "from data_analysis.", text)
    text = re.sub(r"\bimport app\b", "import data_analysis", text)
    text = re.sub(r"see app/", "see data_analysis/", text, flags=re.I)
    return text


def strip_main(text: str) -> str:
    text = rewrite_imports(text)
    text = re.sub(
        r"from data_analysis\.bridge_scope import.*\n",
        "",
        text,
    )
    text = re.sub(
        r"from data_analysis\.operators\.analysis_bridge import.*\n",
        "",
        text,
    )
    text = re.sub(
        r"from data_analysis\.schemas\.requests import BridgeLoadRequest.*\n",
        "",
        text,
    )
    text = re.sub(
        r"from data_analysis\.schemas\.responses import BridgeResponse\n",
        "",
        text,
    )

    # Lifespan: drop assets worker
    text = re.sub(
        r"    assets=None\n    if settings\.ASSETS_ENABLED:.*?\n    try:\n        yield\n    finally:\n        if assets:assets\.stop\(\)\n",
        "    yield\n",
        text,
        flags=re.S,
    )

    text = re.sub(
        r"from data_analysis\.assets\.api import router as asset_router\napp\.include_router\(asset_router\)\n\n",
        "",
        text,
    )

    # Simplify RequestScopeMiddleware: remove bridge body handling
    old_middleware = re.search(
        r"class RequestScopeMiddleware:.*?await self\.app\(scope, receive, send\)\n",
        text,
        flags=re.S,
    )
    if old_middleware:
        new_middleware = '''class RequestScopeMiddleware:
    """Publish caller identity and release session locks after the response."""

    def __init__(self, asgi_app):
        self.app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        api_key = None
        for name, value in scope.get("headers") or []:
            if name == b"x-api-key":
                api_key = value.decode("latin-1")
                break
        owner = owner_digest(api_key) if settings.api_key_list else None
        with request_scope(owner):
            await self.app(scope, receive, send)


'''
        text = text[: old_middleware.start()] + new_middleware + text[old_middleware.end() :]

    # Remove bridge routes
    text = re.sub(
        r"@app\.post\(\"/api/v1/analysis/load\".*?def api_bridge_profile.*?profile_source\(req\)\n\n",
        "",
        text,
        flags=re.S,
    )

    text = re.sub(
        r"from data_analysis\.schemas\.requests import OrderInvestigationRequest\n.*?def api_simulate_discount_scenarios.*?raise _client_error\(exc\) from exc\n\n",
        "",
        text,
        flags=re.S,
    )

    text = text.replace(
        "from app import examples as builtin_examples",
        "from data_analysis import examples as builtin_examples",
    )
    text = text.replace(
        'logger = logging.getLogger("app.main")',
        'logger = logging.getLogger("data_analysis.main")',
    )
    return text


def strip_mcp(text: str) -> str:
    text = rewrite_imports(text)
    # Remove order/discount MCP tools
    blocks = [
        "investigate_orders",
        "reconcile_order_amounts",
        "analyze_discount_drivers",
        "audit_discount_orders",
        "simulate_discount_scenarios",
    ]
    for name in blocks:
        text = re.sub(
            rf"@mcp\.tool\(name=['\"]{name}['\"].*?\n\n",
            "",
            text,
            flags=re.S,
        )
    # Soften bridge mentions in descriptions
    text = text.replace("BusinessHost bridge", "signed-scope bridge")
    text = text.replace("REST bridge-only", "REST-only")
    return text


def main() -> None:
    src_root = Path(__file__).resolve().parents[2] / "ai-data-insight" / "app"
    main_src = (src_root / "main.py").read_text(encoding="utf-8")
    mcp_src = (src_root / "mcp_server.py").read_text(encoding="utf-8")
    (PKG / "main.py").write_text(strip_main(main_src), encoding="utf-8")
    (PKG / "mcp_server.py").write_text(strip_mcp(mcp_src), encoding="utf-8")
    print("Scrubbed main.py and mcp_server.py")


if __name__ == "__main__":
    main()
