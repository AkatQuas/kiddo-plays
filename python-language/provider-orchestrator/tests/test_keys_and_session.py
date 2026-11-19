import pytest

from provider_orchestrator.keys.memory_store import InMemoryKeyStore
from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.session.broker import AccountSession, SessionBroker


def test_round_robin_and_public_view():
    reg = KeyRegistry(InMemoryKeyStore())
    reg.add(platform="p", access_key="secret-aaaa", name="a")
    reg.add(platform="p", access_key="secret-bbbb", name="b")
    ids = [reg.pick("p").key_id for _ in range(4)]
    assert len(set(ids)) == 2
    view = reg.quota_snapshot()[0]
    assert "access_key" not in view
    assert view["access_key_suffix"]


@pytest.mark.asyncio
async def test_session_broker_marks_expired():
    broker = SessionBroker()
    broker.upsert(AccountSession(account_id="1", credential="abc12345"))

    async def boom(session, payload):
        raise PermissionError("401")

    with pytest.raises(PermissionError):
        await broker.call(
            "1",
            {},
            boom,
            is_auth_error=lambda e: isinstance(e, PermissionError),
        )
    assert broker.get("1").login_ok is False
