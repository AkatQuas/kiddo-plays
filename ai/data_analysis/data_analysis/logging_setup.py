"""Stdlib logging with a contextvar request id.

The request id lives in a contextvar so log records emitted deep in the call
stack (operators, connectors) carry it without threading an argument through
every signature. A logging.Filter injects it into the format string.

Never log: request bodies, connection strings, or the X-API-Key value.
For destinations, log scheme+host only via safe_destination() - connection
strings in app/connectors/ embed database passwords.
"""

import logging
import sys
from contextvars import ContextVar
from urllib.parse import urlsplit

from data_analysis.config import settings

_request_id: ContextVar[str] = ContextVar("request_id", default="-")

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s"


def set_request_id(value: str) -> None:
    _request_id.set(value)


def get_request_id() -> str:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    """Attaches the current request id to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


def safe_destination(conn_str: str | None) -> str:
    """Reduce a connection string / URL to scheme+host, dropping credentials.

    Connection strings here contain passwords, so anything logged about a
    destination must go through this first.
    """
    if not conn_str:
        return "unknown"
    try:
        parts = urlsplit(conn_str)
        if not parts.scheme:
            return "unknown"
        # parts.hostname excludes user:password and the port.
        host = parts.hostname or ""
        return f"{parts.scheme}://{host}" if host else f"{parts.scheme}://"
    except ValueError:
        return "unknown"


def configure_logging(level: str | None = None) -> None:
    """Idempotent root logger setup writing to stdout."""
    resolved = (level or settings.LOG_LEVEL or "INFO").upper()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    # Replace our own handler on repeated calls instead of stacking duplicates.
    for existing in list(root.handlers):
        if getattr(existing, "_data_agent_handler", False):
            root.removeHandler(existing)
    handler._data_agent_handler = True  # type: ignore[attr-defined]

    root.addHandler(handler)
    root.setLevel(getattr(logging, resolved, logging.INFO))
