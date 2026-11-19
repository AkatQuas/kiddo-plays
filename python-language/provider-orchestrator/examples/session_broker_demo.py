"""Run: PYTHONPATH=src python examples/session_broker_demo.py"""

from __future__ import annotations

import asyncio

from provider_orchestrator.session.broker import AccountSession, SessionBroker


async def fake_upstream(session: AccountSession, payload: dict):
    if payload.get("force_auth_error"):
        raise PermissionError("401 unauthorized")
    return {"account": session.account_id, "echo": payload}


async def main() -> None:
    broker = SessionBroker()
    broker.upsert(
        AccountSession(
            account_id="acct-1",
            label="demo",
            credential="session-secret-xyz",
            region="default",
        )
    )
    print("accounts:", broker.list_public())

    ok = await broker.call("acct-1", {"q": "ping"}, fake_upstream)
    print("call ok:", ok)

    try:
        await broker.call(
            "acct-1",
            {"force_auth_error": True},
            fake_upstream,
            is_auth_error=lambda e: isinstance(e, PermissionError),
        )
    except PermissionError:
        print("marked expired:", broker.list_public())


if __name__ == "__main__":
    asyncio.run(main())
