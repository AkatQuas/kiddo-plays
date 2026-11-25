"""Per-request scope: who is calling, and which session connections it holds.

Two problems are solved with one small object:

* **Ownership.** API keys are flat secrets, and a session id is just a string the
  caller picks. Without a binding, any key holder who knows (or guesses) a session
  id can read another caller's data. The scope carries a digest of the caller's
  key; ``SessionManager`` stamps it on the sessions it creates and refuses to
  hand a session to a different owner.

* **One request at a time per session.** A DuckDB connection keeps a single
  pending result. Routes are sync functions run in a thread pool, so two requests
  on the same session used to interleave ``execute()`` / ``fetch*()`` on the same
  connection and could read each other's result. The first time a request touches
  a session it takes that session's lock and keeps it until the request ends.

The scope object is created by the outermost middleware (or by the MCP tool
wrapper) and published through a ContextVar. Thread-pool workers and child tasks
receive a *copy* of the context, but the copy points at the same scope object, so
locks taken in a worker thread are released by the middleware when the response
is done. ``threading.Lock`` (not RLock) is used for exactly that reason: it may be
released from a different thread than the one that acquired it.

Code that runs outside any scope (unit tests calling operators directly, the
built-in examples, scripts) is single-threaded by construction and is neither
locked nor ownership-checked.
"""

import hashlib
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar


class SessionBusyError(RuntimeError):
    """Another request held the session for longer than the caller may wait."""


class RequestScope:
    def __init__(self, owner: str | None = None):
        self.owner = owner
        self._held: list[threading.Lock] = []
        self._guard = threading.Lock()

    def hold(self, lock: threading.Lock, timeout: float, label: str) -> None:
        """Take ``lock`` for the rest of this request. Idempotent per request."""
        with self._guard:
            if any(held is lock for held in self._held):
                return
        if self.owner and self.owner.startswith("bridge:"):
            timeout = min(timeout, 1.0)
        if not lock.acquire(timeout=timeout):
            raise SessionBusyError(f"Session '{label}' is busy with another request; retry shortly")
        with self._guard:
            self._held.append(lock)

    def release_all(self) -> None:
        with self._guard:
            held, self._held = self._held, []
        for lock in held:
            try:
                lock.release()
            except RuntimeError:
                # Already released (session closed underneath us): nothing to undo.
                pass


_current: ContextVar[RequestScope | None] = ContextVar("data_analysis_request_scope", default=None)


def current_scope() -> RequestScope | None:
    return _current.get()


def owner_digest(api_key: str | None) -> str | None:
    """Stable, non-reversible identifier for a caller. The key itself is never stored."""
    if not api_key:
        return None
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:32]


@contextmanager
def request_scope(owner: str | None = None) -> Iterator[RequestScope]:
    scope = RequestScope(owner)
    token = _current.set(scope)
    try:
        yield scope
    finally:
        scope.release_all()
        _current.reset(token)
