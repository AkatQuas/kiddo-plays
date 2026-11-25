"""Data-plane isolation, per-session serialization, capacity and cleanup.

tests/test_session_isolation.py covers the metadata registries. These cover what
it did not: who may touch a session's *data*, what happens when two requests hit
one session, and that nothing outlives an evicted session.
"""

import threading
import time

import pyarrow as pa
import pytest
from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.catalog.meta_registry import MetaRegistry, get_meta_registry
from data_analysis.cluster.request_scope import SessionBusyError, request_scope
from data_analysis.cluster.session_manager import (
    DatasetTooLargeError,
    SessionCapacityError,
    SessionConflictError,
    SessionManager,
    SessionNotFoundError,
)
from data_analysis.main import app

ALICE = {"X-API-Key": "alice-key"}
BOB = {"X-API-Key": "bob-key"}


@pytest.fixture()
def two_keys(monkeypatch):
    monkeypatch.setattr(settings, "API_KEYS", "alice-key,bob-key")
    yield TestClient(app)


def _table(rows: int = 3) -> pa.Table:
    return pa.table({"id": list(range(rows)), "amount": [float(i) for i in range(rows)]})


def _load(session_id: str, owner: str, rows: int = 3) -> None:
    with request_scope(owner):
        SessionManager().get_or_create_session(session_id).register_dataset("t", _table(rows))


def test_other_key_cannot_read_a_session_even_with_its_id(two_keys):
    from data_analysis.cluster.request_scope import owner_digest

    _load("own_alice", owner_digest("alice-key"))
    body = {"session_id": "own_alice", "sql_query": "select count(*) as n from t"}

    ok = two_keys.post("/api/v1/tools/sql", json=body, headers=ALICE)
    assert ok.status_code == 200 and ok.json()["data_preview"] == [{"n": 3}]

    denied = two_keys.post("/api/v1/tools/sql", json=body, headers=BOB)
    # Same answer as for a session that never existed: no existence oracle.
    assert denied.status_code == 404
    assert (
        two_keys.post(
            "/api/v1/tools/eda", json={"session_id": "own_alice", "dataset_name": "t"}, headers=BOB
        ).status_code
        == 404
    )


def test_other_key_cannot_adopt_list_or_delete_the_session(two_keys):
    from data_analysis.cluster.request_scope import owner_digest

    _load("own_alice_2", owner_digest("alice-key"))
    assert [
        s["session_id"]
        for s in two_keys.get("/api/v1/sessions", headers=BOB).json()["sessions"]
        if s["session_id"] == "own_alice_2"
    ] == []
    assert two_keys.delete("/api/v1/sessions/own_alice_2", headers=BOB).status_code == 404
    with request_scope(owner_digest("bob-key")):
        with pytest.raises(SessionConflictError):
            SessionManager().get_or_create_session("own_alice_2")

    mine = two_keys.get("/api/v1/sessions", headers=ALICE).json()["sessions"]
    assert any(s["session_id"] == "own_alice_2" and s["datasets"] == ["t"] for s in mine)
    assert two_keys.delete("/api/v1/sessions/own_alice_2", headers=ALICE).status_code == 200
    assert two_keys.delete("/api/v1/sessions/own_alice_2", headers=ALICE).status_code == 404


def test_missing_session_is_404_not_500():
    client = TestClient(app, headers={"X-API-Key": "test-api-key"})
    for path, body in [
        ("/api/v1/tools/sql", {"session_id": "nope", "sql_query": "select 1"}),
        ("/api/v1/tools/eda", {"session_id": "nope", "dataset_name": "t"}),
        (
            "/api/v1/tools/olap",
            {"session_id": "nope", "dataset_name": "t", "dimensions": ["a"], "metrics": ["b"]},
        ),
    ]:
        res = client.post(path, json=body)
        assert res.status_code == 404, path
        assert res.json()["status"] == "error" and "request_id" in res.json()


def test_session_id_is_validated():
    with pytest.raises(ValueError):
        SessionManager().get_or_create_session("../../etc")
    with pytest.raises(ValueError):
        SessionManager().get_or_create_session("x" * 200)


def test_requests_on_one_session_are_serialized():
    sess = SessionManager().get_or_create_session("serial_sess")
    order = []

    def slow():
        with request_scope():
            sess.get_duckdb_conn()
            order.append("slow-in")
            time.sleep(0.3)
            order.append("slow-out")

    def fast():
        time.sleep(0.05)
        with request_scope():
            sess.get_duckdb_conn()
            order.append("fast-in")

    threads = [threading.Thread(target=slow), threading.Thread(target=fast)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert order == ["slow-in", "slow-out", "fast-in"]
    assert not sess.is_in_use()


def test_lock_is_reentrant_within_a_request_and_times_out_across_requests(monkeypatch):
    monkeypatch.setattr(settings, "SESSION_BUSY_TIMEOUT_SECONDS", 0.05)
    sess = SessionManager().get_or_create_session("busy_sess")
    with request_scope():
        sess.get_duckdb_conn()
        sess.get_duckdb_conn()  # same request: must not deadlock on itself
        sess.register_dataset("t", _table())
        failed = []

        def other():
            with request_scope():
                try:
                    sess.get_duckdb_conn()
                except SessionBusyError as exc:
                    failed.append(exc)

        t = threading.Thread(target=other)
        t.start()
        t.join()
        assert len(failed) == 1


def test_per_session_memory_limit(monkeypatch):
    monkeypatch.setattr(settings, "MAX_MEMORY_PER_SESSION_MB", 1)
    sess = SessionManager().get_or_create_session("mem_sess")
    sess.register_dataset("small", _table(10))
    with pytest.raises(DatasetTooLargeError):
        sess.register_dataset("big", pa.table({"x": list(range(400_000))}))
    # Replacing a dataset is judged on the net change, not as an addition.
    sess.register_dataset("small", _table(20))


def test_session_limit_evicts_least_recently_used_and_cleans_registries(monkeypatch):
    mgr = SessionManager()
    for sid in [s["session_id"] for s in mgr.list_sessions()]:
        mgr.drop_session(sid)
    monkeypatch.setattr(settings, "MAX_SESSIONS", 2)

    mgr.get_or_create_session("lru_a")
    get_meta_registry("lru_a")
    time.sleep(0.01)
    mgr.get_or_create_session("lru_b")
    time.sleep(0.01)
    mgr.get_session("lru_a")  # a is now the most recently used
    mgr.get_or_create_session("lru_c")

    alive = {s["session_id"] for s in mgr.list_sessions()}
    assert alive == {"lru_a", "lru_c"}

    mgr.drop_session("lru_a")
    assert "lru_a" not in MetaRegistry._session_instances
    with pytest.raises(SessionNotFoundError):
        mgr.require_session("lru_a")


def test_sessions_in_use_are_never_evicted(monkeypatch):
    mgr = SessionManager()
    for sid in [s["session_id"] for s in mgr.list_sessions()]:
        mgr.drop_session(sid)
    monkeypatch.setattr(settings, "MAX_SESSIONS", 1)
    held = mgr.get_or_create_session("held_sess")
    with request_scope():
        held.get_duckdb_conn()
        done = []

        def other():
            with request_scope():
                try:
                    mgr.get_or_create_session("newcomer")
                except SessionCapacityError as exc:
                    done.append(exc)

        t = threading.Thread(target=other)
        t.start()
        t.join()
        assert len(done) == 1
    assert mgr.get_session("held_sess") is not None


def test_total_memory_budget_evicts_idle_sessions(monkeypatch):
    mgr = SessionManager()
    for sid in [s["session_id"] for s in mgr.list_sessions()]:
        mgr.drop_session(sid)
    monkeypatch.setattr(settings, "MAX_TOTAL_MEMORY_MB", 4)
    big = pa.table({"x": list(range(300_000))})  # ~2.4 MB
    mgr.get_or_create_session("budget_a").register_dataset("t", big)
    time.sleep(0.01)
    mgr.get_or_create_session("budget_b").register_dataset("t", big)
    assert mgr.get_session("budget_a") is None
    assert mgr.get_session("budget_b") is not None
