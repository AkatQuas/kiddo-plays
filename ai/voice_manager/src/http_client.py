import asyncio

import aiohttp

_session: aiohttp.ClientSession | None = None
_session_lock: asyncio.Lock | None = None


def _lock() -> asyncio.Lock:
    global _session_lock
    if _session_lock is None:
        _session_lock = asyncio.Lock()
    return _session_lock


async def init_http_client() -> aiohttp.ClientSession:
    global _session
    async with _lock():
        if _session is None or _session.closed:
            _session = aiohttp.ClientSession()
        return _session


async def close_http_client() -> None:
    global _session
    async with _lock():
        if _session is not None and not _session.closed:
            await _session.close()
        _session = None


async def get_http_session() -> aiohttp.ClientSession:
    return await init_http_client()


def auth_headers(api_key: str) -> dict[str, str]:
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}
