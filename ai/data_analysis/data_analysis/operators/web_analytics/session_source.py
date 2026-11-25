"""Shared access to a session-resident trace/event table.

Trace analytics used to read a dedicated on-disk event_store. After the refactor
they run on whatever trace dataset was imported into the in-memory analytical
session, so the DB-connector path and the trace path share one analysis engine.
"""

from typing import Any

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.arrow_utils import ArrowUtils
from data_analysis.engine.sql_guard import safe_table_ref

# created_at arrives as an ISO string from import; TRY_CAST tolerates the trailing
# 'Z' and the 'T' separator and yields NULL (not an error) on anything unparseable.
CREATED_AT_TS = "TRY_CAST(created_at AS TIMESTAMP)"


def resolve_table(session_id: str, table_name: str):
    """Return (duckdb_conn, safe_table_ref) or raise if the session is missing."""
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    return sess.get_duckdb_conn(), safe_table_ref(table_name)


def records(cur) -> list[dict[str, Any]]:
    """DuckDB cursor -> JSON-safe list of dicts (NaN/Inf collapsed to None)."""
    return ArrowUtils.df_to_records(cur.df())
