"""DuckDB scanner-based extraction (ATTACH + predicate pushdown).

An alternative to ConnectorX materialization for RDBMS sources: instead of a Rust
client pulling the whole result, DuckDB ATTACHes the external database via its
native scanner extension (postgres/mysql/sqlite) and runs the query directly,
pushing projections/filters down to the source. Data is still returned as Arrow
for the in-memory session, but the extraction path is DuckDB-native — one SQL
dialect, fewer moving parts, and no dependency on ConnectorX for this path.

ConnectorX materialization stays the default; this is opt-in via mode="scanner".
"""

import re
from urllib.parse import unquote, urlparse

import duckdb
import pyarrow as pa

from data_analysis.engine.arrow_utils import ArrowUtils

_ALIAS_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_DSN_PLAIN = re.compile(r"[A-Za-z0-9_.~/-]+")

# DuckDB scanner extension name per source type.
_EXTENSION = {
    "postgres": "postgres",
    "postgresql": "postgres",
    "mysql": "mysql",
    "sqlite": "sqlite",
    "sqlite3": "sqlite",
    "duckdb": "duckdb",
    "md": "motherduck",
    "motherduck": "motherduck",
}
_ATTACH_TYPE = {
    "postgres": "POSTGRES",
    "postgresql": "POSTGRES",
    "mysql": "MYSQL",
    "sqlite": "SQLITE",
    "sqlite3": "SQLITE",
    "duckdb": "DUCKDB",
    "md": "MOTHERDUCK",
    "motherduck": "MOTHERDUCK",
}


def _dsn_pair(key: str, value: object) -> str:
    text = str(value)
    if _DSN_PLAIN.fullmatch(text):
        return f"{key}={text}"
    escaped = text.replace("\\", "\\\\").replace("'", "''")
    return f"{key}='{escaped}'"


def _mysql_dsn(conn_str: str) -> str:
    """DuckDB's MySQL scanner wants a key=value DSN, not a mysql:// URI."""
    p = urlparse(conn_str)
    parts = []
    if p.hostname:
        parts.append(_dsn_pair("host", unquote(p.hostname)))
    if p.port:
        parts.append(_dsn_pair("port", p.port))
    if p.username:
        parts.append(_dsn_pair("user", unquote(p.username)))
    if p.password:
        parts.append(_dsn_pair("password", unquote(p.password)))
    db = unquote((p.path or "").lstrip("/"))
    if db:
        parts.append(_dsn_pair("database", db))
    return " ".join(parts)


def _sqlite_path(conn_str: str) -> str:
    return conn_str.replace("sqlite:///", "").replace("sqlite://", "").replace("file://", "")


def _duckdb_path(conn_str: str) -> str:
    return conn_str.replace("duckdb:///", "").replace("duckdb://", "").replace("file://", "")


def attach_target(db_type: str, conn_str: str) -> str:
    """Return the connection payload DuckDB's ATTACH expects for this source.

    - Postgres: a libpq conninfo / postgresql:// URI is accepted as-is.
    - MySQL: converted to a key=value DSN.
    - SQLite: the file path.
    - DuckDB / MotherDuck: local .duckdb/.db path or md:database_name.
    """
    t = db_type.lower()
    if t in ("postgres", "postgresql"):
        return conn_str
    if t == "mysql":
        return _mysql_dsn(conn_str)
    if t in ("sqlite", "sqlite3"):
        return _sqlite_path(conn_str)
    if t == "duckdb":
        return _duckdb_path(conn_str)
    if t in ("md", "motherduck"):
        if conn_str.startswith("motherduck://"):
            return "md:" + conn_str[len("motherduck://") :]
        if conn_str.startswith("md://"):
            return "md:" + conn_str[len("md://") :]
        return conn_str
    raise ValueError(f"Unsupported scanner source type: {db_type}")


def attach_clause(db_type: str, conn_str: str, alias: str = "src", read_only: bool = True) -> str:
    """Build the DuckDB ATTACH statement (pure/testable)."""
    t = db_type.lower()
    if t not in _ATTACH_TYPE:
        raise ValueError(f"Unsupported scanner source type: {db_type}")
    if not _ALIAS_RE.fullmatch(alias):
        raise ValueError(f"Invalid ATTACH alias {alias!r}")
    target = attach_target(t, conn_str).replace("'", "''")
    if t in ("md", "motherduck"):
        return f"ATTACH '{target}' AS {alias}"
    opts = []
    if t != "duckdb":
        opts.append(f"TYPE {_ATTACH_TYPE[t]}")
    # SQLite ATTACH does not accept READ_ONLY as an option here; keep it for RDBMS/DuckDB.
    if read_only and t not in ("sqlite", "sqlite3"):
        opts.append("READ_ONLY")
    opt_str = f" ({', '.join(opts)})" if opts else ""
    return f"ATTACH '{target}' AS {alias}{opt_str}"


def fetch_via_scanner(
    db_type: str, conn_str: str, pushdown_sql: str, alias: str = "src"
) -> pa.Table:
    """ATTACH the external DB and run pushdown_sql against it, returning Arrow.

    pushdown_sql references bare table names; `USE <alias>` makes them resolve
    inside the attached database, so both a table read and a custom SELECT work.
    """
    t = db_type.lower()
    ext = _EXTENSION.get(t)
    if ext is None:
        raise ValueError(f"Unsupported scanner source type: {db_type}")

    con = duckdb.connect(":memory:")
    try:
        # Let DuckDB pull the scanner extension if it is not already present.
        try:
            con.execute("SET autoinstall_known_extensions=true")
            con.execute("SET autoload_known_extensions=true")
        except duckdb.Error:
            pass
        # sqlite and duckdb are bundled; postgres/mysql/motherduck may need an explicit install/load.
        if ext not in ("sqlite", "duckdb"):
            try:
                con.execute(f"INSTALL {ext}")
                con.execute(f"LOAD {ext}")
            except duckdb.Error:
                pass
        con.execute(attach_clause(t, conn_str, alias))
        con.execute(f"USE {alias}")
        return ArrowUtils.fetch_table(con.execute(pushdown_sql))
    finally:
        con.close()
