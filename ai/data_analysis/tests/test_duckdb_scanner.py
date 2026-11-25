import sqlite3

import pyarrow as pa
import pytest

from data_analysis.connectors import duckdb_scanner as scanner
from data_analysis.connectors.mysql import MySQLConnector
from data_analysis.connectors.postgres import PostgresConnector

# ---- attach clause / DSN construction (pure, no live DB) ----


def test_attach_clause_postgres_passes_uri_through():
    clause = scanner.attach_clause("postgres", "postgresql://u:p@host:5432/db", alias="src")
    assert clause == "ATTACH 'postgresql://u:p@host:5432/db' AS src (TYPE POSTGRES, READ_ONLY)"


def test_attach_clause_mysql_builds_key_value_dsn():
    clause = scanner.attach_clause("mysql", "mysql://root:pw@10.0.0.5:3306/warehouse", alias="src")
    assert "TYPE MYSQL" in clause and "READ_ONLY" in clause
    assert "host=10.0.0.5" in clause and "port=3306" in clause
    assert "user=root" in clause and "password=pw" in clause and "database=warehouse" in clause
    assert "mysql://" not in clause  # URI must be converted, not passed through


def test_attach_clause_sqlite_uses_path_without_readonly():
    clause = scanner.attach_clause("sqlite", "sqlite:///data/x.db", alias="src")
    assert clause == "ATTACH 'data/x.db' AS src (TYPE SQLITE)"


def test_unsupported_source_raises():
    with pytest.raises(ValueError):
        scanner.attach_clause("oracle", "oracle://x")


# ---- end-to-end scanner mechanism via bundled SQLite (real ATTACH + pushdown) ----


def test_fetch_via_scanner_sqlite_end_to_end(tmp_path):
    db = tmp_path / "s.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE t (region TEXT, sales REAL, qty INTEGER)")
    con.executemany(
        "INSERT INTO t VALUES (?,?,?)", [("East", 120.5, 3), ("West", 90.0, 2), ("North", 300.0, 7)]
    )
    con.commit()
    con.close()

    # Projection + predicate are pushed into the query DuckDB runs on the attached DB.
    tbl = scanner.fetch_via_scanner(
        "sqlite", f"sqlite:///{db}", "SELECT region, sales FROM t WHERE sales > 100"
    )
    assert isinstance(tbl, pa.Table)
    assert set(tbl.column_names) == {"region", "sales"}
    regions = set(tbl.column("region").to_pylist())
    assert regions == {"East", "North"}  # West (90.0) filtered out at source


# ---- connector routing: scanner vs materialize ----


def test_postgres_scanner_mode_routes_to_duckdb_scanner(monkeypatch):
    captured = {}

    def fake_scan(db_type, conn_str, pushdown_sql, alias="src"):
        captured.update(db_type=db_type, conn_str=conn_str, sql=pushdown_sql)
        return pa.table({"x": [1]})

    monkeypatch.setattr("data_analysis.connectors.postgres.fetch_via_scanner", fake_scan)
    conn = PostgresConnector("postgresql://u:p@host/db")
    conn.fetch_to_arrow(
        query_or_table="orders", select_cols=["a"], filter_sql="a > 1", limit=5, mode="scanner"
    )

    assert captured["db_type"] == "postgres"
    assert captured["conn_str"] == "postgresql://u:p@host/db"
    assert 'SELECT "a"' in captured["sql"] or "SELECT a" in captured["sql"]
    assert "a > 1" in captured["sql"] and "LIMIT 5" in captured["sql"]


def test_mysql_scanner_mode_routes_to_duckdb_scanner(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        "data_analysis.connectors.mysql.fetch_via_scanner",
        lambda db_type, conn_str, sql, alias="src": (
            captured.update(db_type=db_type) or pa.table({"x": [1]})
        ),
    )
    MySQLConnector("mysql://root:pw@h/db").fetch_to_arrow(query_or_table="t", mode="scanner")
    assert captured["db_type"] == "mysql"


def test_default_mode_uses_connectorx_not_scanner(monkeypatch):
    calls = {"cx": 0, "scan": 0}
    monkeypatch.setattr(
        "data_analysis.connectors.postgres.cx.read_sql",
        lambda *a, **k: calls.__setitem__("cx", calls["cx"] + 1) or pa.table({"x": [1]}),
    )
    monkeypatch.setattr(
        "data_analysis.connectors.postgres.fetch_via_scanner",
        lambda *a, **k: calls.__setitem__("scan", calls["scan"] + 1) or pa.table({"x": [1]}),
    )
    PostgresConnector("postgresql://u:p@host/db").fetch_to_arrow(
        query_or_table="orders"
    )  # default mode
    assert calls == {"cx": 1, "scan": 0}
