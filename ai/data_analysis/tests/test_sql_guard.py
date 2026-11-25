import duckdb
import pyarrow as pa
import pytest

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_predicate, safe_table_ref
from data_analysis.operators.sandbox import run_duckdb_sql
from data_analysis.retl.destination_sync import DestinationSync


def test_safe_ident():
    assert safe_ident("user_id") == '"user_id"'
    for bad in ["a; DROP TABLE t", 'a"b', "1abc", "", "a b"]:
        with pytest.raises(ValueError):
            safe_ident(bad)


def test_safe_table_ref_and_columns():
    assert safe_table_ref("analytics.orders") == '"analytics"."orders"'
    assert safe_table_ref("orders") == '"orders"'
    assert safe_columns(["customer_id", "sales"]) == '"customer_id", "sales"'
    with pytest.raises(ValueError):
        safe_table_ref("orders; DROP TABLE t")


def test_safe_predicate_accepts_legit_fragments():
    ok = "amount > 100 AND status = 'DELETED'"
    assert safe_predicate(ok) == ok
    assert safe_predicate("updated_at > '2026-01-01'") == "updated_at > '2026-01-01'"


def test_safe_predicate_rejects_injection():
    for bad in ["1=1; DROP TABLE t", "1=1 --", "1=1 /* x */", "1=1 OR (DELETE FROM t)"]:
        with pytest.raises(ValueError):
            safe_predicate(bad)


def test_sandbox_blocks_multi_statement_injection_and_table_survives():
    sess = SessionManager().get_or_create_session("sql_guard_test_session")
    tbl = pa.table({"i": [1, 2, 3]})
    sess.register_dataset("guard_src", tbl)
    con = sess.get_duckdb_conn()
    con.execute("CREATE OR REPLACE TABLE victim AS SELECT * FROM guard_src")

    with pytest.raises(PermissionError):
        run_duckdb_sql("sql_guard_test_session", "SELECT 1; DROP TABLE victim")
    with pytest.raises(PermissionError):
        run_duckdb_sql("sql_guard_test_session", "DROP TABLE victim")

    # Table must still exist with all rows.
    assert con.execute("SELECT count(*) FROM victim").fetchone()[0] == 3

    res = run_duckdb_sql("sql_guard_test_session", "SELECT i FROM victim", limit=10)
    assert res["row_count"] == 3

    SessionManager().drop_session("sql_guard_test_session")


def test_destination_sync_unsupported_scheme_raises():
    con = duckdb.connect(":memory:")
    con.execute("CREATE TABLE src AS SELECT 1 AS i")
    with pytest.raises(NotImplementedError):
        DestinationSync.sync_table_to_destination(
            con=con,
            source_table="src",
            dest_conn_str="snowflake://user@acct/db",
            dest_table_name="sink",
        )


def test_known_quote_scanner_preserves_literals_and_refuses_ambiguous_dialects():
    from data_analysis.engine.sql_guard import normalize_bridge_identifier_quotes as norm

    assert (
        norm("SELECT '`source`', `i` FROM `source` -- `unknown`", {"source", "i"})
        == 'SELECT \'`source`\', "i" FROM "source" -- `unknown`'
    )
    assert (
        norm("SELECT 'it''s `source`', `i` FROM `source` /* `unknown` */", {"source", "i"})
        == "SELECT 'it''s `source`', \"i\" FROM \"source\" /* `unknown` */"
    )
    for query in [
        "SELECT `missing` FROM `source`",
        "SELECT * FROM `s3://b/k`",
        "SELECT $$`source`$$ FROM `source`",
        "SELECT * FROM `source` /* outer /* inner */ */",
        "SELECT 'unterminated `source`",
    ]:
        assert norm(query, {"source", "i"}) is None
