"""Deep session contract: finishing one query must not block the next register."""

import pyarrow as pa

from data_analysis.cluster.session_manager import SessionManager


def test_fetchone_then_register_still_works():
    session = SessionManager().get_or_create_session()
    try:
        connection = session.get_duckdb_conn()
        assert connection.execute("select 1").fetchone() == (1,)
        session.register_dataset("after_fetch", pa.table({"a": [1]}))
        rows = session.execute_sql("select a from after_fetch")
        assert rows.column("a").to_pylist() == [1]
    finally:
        SessionManager().drop_session(session.session_id)
