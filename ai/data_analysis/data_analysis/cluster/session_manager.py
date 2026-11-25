import os
import re
import threading
import time
import uuid
from collections.abc import Callable
from typing import Any

import duckdb
import pyarrow as pa

from data_analysis.cluster.request_scope import current_scope
from data_analysis.config import settings

_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,128}$")


class SessionNotFoundError(ValueError):
    """The session does not exist, has expired, or belongs to another caller.

    The three cases are deliberately indistinguishable to the caller. Subclasses
    ValueError so existing ``except ValueError`` handlers keep working.
    """

    def __init__(self, session_id: str):
        super().__init__(f"Session '{session_id}' not found")
        self.session_id = session_id


class SessionConflictError(ValueError):
    """The requested session id is already in use by another caller."""


class SessionCapacityError(RuntimeError):
    """The service is at its session or memory capacity and nothing can be evicted."""


class DatasetTooLargeError(ValueError):
    """Loading the dataset would push the session over its memory allowance."""


def _physical_memory_bytes() -> int | None:
    try:
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, OSError, AttributeError):
        return None


def total_memory_budget_bytes() -> int:
    """Budget for Arrow data held across all sessions.

    ``MAX_TOTAL_MEMORY_MB`` when set; otherwise half of physical memory, or 8 GiB
    when the platform does not report it.
    """
    if settings.MAX_TOTAL_MEMORY_MB > 0:
        return settings.MAX_TOTAL_MEMORY_MB * 1024 * 1024
    physical = _physical_memory_bytes()
    return physical // 2 if physical else 8 * 1024**3


def duckdb_memory_limit() -> str:
    configured = (settings.DUCKDB_MEMORY_LIMIT or "").strip()
    if configured and configured.lower() != "auto":
        return configured
    physical = _physical_memory_bytes()
    limit_mb = min(16 * 1024, (physical // 2) // (1024 * 1024)) if physical else 4096
    return f"{max(512, limit_mb)}MB"


class DatasetMeta:
    def __init__(self, name: str, arrow_table: pa.Table, source_info: dict[str, Any] | None = None):
        self.name = name
        if isinstance(arrow_table, pa.RecordBatchReader):
            arrow_table = arrow_table.read_all()
        self.table = arrow_table
        self.row_count = len(arrow_table)
        self.column_count = len(arrow_table.schema)
        self.column_names = arrow_table.column_names
        self.memory_bytes = arrow_table.nbytes
        self.loaded_at = time.time()
        self.source_info = source_info or {}


class SessionContext:
    """Isolated in-memory session holding DuckDB connection and loaded Arrow tables."""

    def __init__(self, session_id: str, owner: str | None = None):
        self.session_id = session_id
        # Digest of the API key that created the session; None = unowned (auth
        # disabled, MCP stdio, in-process use). See app/cluster/request_scope.py.
        self.owner = owner
        self.created_at = time.time()
        self.last_accessed_at = time.time()
        self.datasets: dict[str, DatasetMeta] = {}
        self._con = duckdb.connect(":memory:")

        # Configure DuckDB performance settings
        self._con.execute(f"SET memory_limit = '{duckdb_memory_limit()}'")
        self._con.execute(f"SET threads = {settings.DUCKDB_THREADS}")
        self._lock = threading.Lock()
        # Held by one request at a time for the whole request. Not an RLock: it is
        # released by the request scope, possibly from another thread.
        self._request_lock = threading.Lock()

    def touch(self):
        self.last_accessed_at = time.time()

    def is_expired(self, ttl_seconds: int) -> bool:
        return (time.time() - self.last_accessed_at) > ttl_seconds

    def is_in_use(self) -> bool:
        return self._request_lock.locked()

    def memory_bytes(self) -> int:
        return sum(meta.memory_bytes for meta in self.datasets.values())

    def _enter_request(self) -> None:
        """Serialize requests on this session (no-op outside a request scope)."""
        scope = current_scope()
        if scope is not None:
            scope.hold(self._request_lock, settings.SESSION_BUSY_TIMEOUT_SECONDS, self.session_id)

    def register_dataset(self, name: str, table: Any, source_info: dict[str, Any] | None = None):
        if isinstance(table, pa.RecordBatchReader):
            table = table.read_all()
        self._enter_request()
        incoming = table.nbytes
        replaced = self.datasets[name].memory_bytes if name in self.datasets else 0
        per_session_cap = settings.MAX_MEMORY_PER_SESSION_MB * 1024 * 1024
        if per_session_cap > 0 and self.memory_bytes() - replaced + incoming > per_session_cap:
            raise DatasetTooLargeError(
                f"Dataset '{name}' ({incoming / 1e6:.0f} MB) would exceed the per-session "
                f"limit of {settings.MAX_MEMORY_PER_SESSION_MB} MB. Load fewer columns / rows, "
                f"or use scanner mode for database sources."
            )
        SessionManager().make_room(incoming - replaced, keep=self.session_id)
        with self._lock:
            self.touch()
            # Register arrow table directly as zero-copy in-memory view
            self._con.register(name, table)
            meta = DatasetMeta(name, table, source_info)
            self.datasets[name] = meta
            return meta

    def get_dataset_meta(self, name: str) -> DatasetMeta | None:
        self.touch()
        return self.datasets.get(name)

    def execute_sql(self, sql: str, limit: int | None = None) -> pa.Table:
        self._enter_request()
        with self._lock:
            self.touch()
            clean_sql = sql.strip().rstrip(";")
            if limit:
                clean_sql = f"SELECT * FROM ({clean_sql}) AS _q LIMIT {int(limit)}"
            res = self._con.execute(clean_sql)
            tbl = res.arrow()
            if isinstance(tbl, pa.RecordBatchReader):
                tbl = tbl.read_all()
            return tbl

    def get_duckdb_conn(self) -> duckdb.DuckDBPyConnection:
        """The session connection. Inside a request scope the caller owns the
        session until the request ends, so execute()/fetch*() cannot interleave
        with another request's."""
        self._enter_request()
        self.touch()
        return self._con

    def close(self):
        with self._lock:
            try:
                self._con.close()
            except Exception:
                pass
            self.datasets.clear()


class SessionManager:
    """Singleton manager for in-memory analytical sessions: ownership, capacity, TTL eviction."""

    _instance = None
    _lock = threading.Lock()
    # Called with the session id whenever a session is dropped, evicted or expired.
    # Per-session registries (catalog, metrics, DAG, lineage) hook in here so their
    # state dies with the session instead of accumulating forever.
    _close_listeners: list[Callable[[str], None]] = []

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._sessions: dict[str, SessionContext] = {}
                # Reentrant: make_room() runs while get_or_create_session() holds it.
                cls._instance._mutex = threading.RLock()
                cls._instance._start_cleanup_thread()
            return cls._instance

    @classmethod
    def add_close_listener(cls, listener: Callable[[str], None]) -> None:
        if listener not in cls._close_listeners:
            cls._close_listeners.append(listener)

    # ------------------------------------------------------------------ access

    @staticmethod
    def _visible(sess: SessionContext) -> bool:
        scope = current_scope()
        # Bridge sessions cannot be reached through legacy API-key-only or unscoped
        # MCP calls, even when the service key is shared by many business users.
        if sess.owner and sess.owner.startswith("bridge:"):
            return scope is not None and scope.owner == sess.owner
        if scope is None or sess.owner is None:
            return True
        return scope.owner == sess.owner

    def get_or_create_session(self, session_id: str | None = None) -> SessionContext:
        with self._mutex:
            sid = session_id or str(uuid.uuid4())
            if not _SESSION_ID_RE.match(sid):
                raise ValueError(
                    "Invalid session_id: use 1-128 characters from letters, digits and _ . : -"
                )
            sess = self._sessions.get(sid)
            if sess is not None:
                if not self._visible(sess):
                    raise SessionConflictError(
                        f"Session id '{sid}' is already in use; choose another id"
                    )
                sess.touch()
                return sess

            if settings.MAX_SESSIONS > 0 and len(self._sessions) >= settings.MAX_SESSIONS:
                if not self._evict_one(keep=None):
                    raise SessionCapacityError(
                        f"Session limit reached ({settings.MAX_SESSIONS}) and every session is in use"
                    )
            scope = current_scope()
            sess = SessionContext(sid, owner=scope.owner if scope is not None else None)
            self._sessions[sid] = sess
            return sess

    def get_session(self, session_id: str) -> SessionContext | None:
        with self._mutex:
            sess = self._sessions.get(session_id)
            if sess is None or not self._visible(sess):
                return None
            sess.touch()
            return sess

    def require_session(self, session_id: str) -> SessionContext:
        sess = self.get_session(session_id)
        if sess is None:
            raise SessionNotFoundError(session_id)
        return sess

    def drop_session(self, session_id: str) -> bool:
        with self._mutex:
            sess = self._sessions.get(session_id)
            if sess is None or not self._visible(sess):
                return False
        # Wait for a request that is mid-query on this session rather than closing
        # the connection underneath it.
        sess._enter_request()
        with self._mutex:
            self._close(session_id)
            return True

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._mutex:
            return [
                {
                    "session_id": sid,
                    "created_at": sess.created_at,
                    "last_accessed_at": sess.last_accessed_at,
                    "datasets": list(sess.datasets.keys()),
                    "memory_bytes": sess.memory_bytes(),
                }
                for sid, sess in self._sessions.items()
                if self._visible(sess)
            ]

    # ------------------------------------------------------------------ capacity

    def total_memory_bytes(self) -> int:
        with self._mutex:
            return sum(sess.memory_bytes() for sess in self._sessions.values())

    def make_room(self, incoming_bytes: int, keep: str | None) -> None:
        """Evict idle sessions (least recently used first) until ``incoming_bytes`` fits."""
        if incoming_bytes <= 0:
            return
        budget = total_memory_budget_bytes()
        with self._mutex:
            while self.total_memory_bytes() + incoming_bytes > budget:
                if not self._evict_one(keep=keep):
                    raise SessionCapacityError(
                        f"Not enough memory for {incoming_bytes / 1e6:.0f} MB: the service budget is "
                        f"{budget / 1e6:.0f} MB and the remaining sessions are in use"
                    )

    def _evict_one(self, keep: str | None) -> bool:
        candidates = [
            (sess.last_accessed_at, sid)
            for sid, sess in self._sessions.items()
            if sid != keep and not sess.is_in_use()
        ]
        if not candidates:
            return False
        _, victim = min(candidates)
        self._close(victim)
        return True

    def _close(self, session_id: str) -> None:
        sess = self._sessions.pop(session_id, None)
        if sess is None:
            return
        sess.close()
        for listener in list(self._close_listeners):
            try:
                listener(session_id)
            except Exception:
                pass

    def _cleanup_expired_sessions(self):
        with self._mutex:
            expired_ids = [
                sid
                for sid, sess in self._sessions.items()
                if sess.is_expired(settings.SESSION_TTL_SECONDS) and not sess.is_in_use()
            ]
            for sid in expired_ids:
                self._close(sid)

    def _start_cleanup_thread(self):
        def _loop():
            while True:
                time.sleep(60)
                try:
                    self._cleanup_expired_sessions()
                except Exception:
                    pass

        t = threading.Thread(target=_loop, daemon=True, name="SessionCleanerThread")
        t.start()
