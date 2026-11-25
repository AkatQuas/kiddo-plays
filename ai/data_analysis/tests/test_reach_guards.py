"""What a caller can make the service read, write or call.

Each test is an attack that worked before: reading server files through the SQL
sandbox or a DAG model, escaping the upload directory, importing an arbitrary
server path over HTTP, exporting to an arbitrary path, and using the webhook
sender to reach internal addresses.
"""

import io
import os

import pyarrow as pa
import pytest
from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.connectors.local import LocalFileConnector
from data_analysis.engine.reach_guard import (
    assert_public_http_url,
    resolve_inside,
    safe_upload_name,
)
from data_analysis.engine.sql_guard import assert_mutation_sql, safe_model_sql
from data_analysis.main import app
from data_analysis.ontology.action_type import ActionType
from data_analysis.ontology.ontology_engine import get_ontology_engine
from data_analysis.operators.sandbox import run_duckdb_sql
from data_analysis.retl.destination_sync import DestinationSync
from data_analysis.retl.webhook_pusher import WebhookPusher

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


@pytest.fixture()
def session():
    sess = SessionManager().get_or_create_session("reach_guard_sess")
    sess.register_dataset("orders", pa.table({"id": [1, 2, 3], "amount": [10.0, 20.0, 30.0]}))
    sess.register_dataset("orders.csv", pa.table({"id": [7]}))
    return sess


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM read_csv_auto('/etc/passwd')",
        "SELECT * FROM read_text('/etc/hostname')",
        "SELECT * FROM '/etc/passwd'",
        "SELECT * FROM 'secrets.csv'",
        "SELECT * FROM glob('/**')",
        "WITH x AS (SELECT * FROM read_blob('/etc/passwd')) SELECT * FROM x",
        "SELECT (SELECT count(*) FROM read_parquet('s3://bucket/key.parquet')) AS n",
        "SELECT o.id FROM orders o JOIN read_json_auto('/tmp/x.json') j ON true",
        "SELECT getenv('DATA_ANALYSIS_API_KEYS')",
        "SELECT * FROM duckdb_secrets()",
        "EXPLAIN ANALYZE SELECT * FROM read_csv_auto('/etc/passwd')",
        "SELECT /* read_csv */ * FROM read_csv_auto('/etc/passwd') -- orders",
    ],
)
def test_sql_sandbox_cannot_reach_outside_the_session(session, sql):
    with pytest.raises(PermissionError):
        run_duckdb_sql("reach_guard_sess", sql)


def test_sql_sandbox_still_runs_ordinary_analytics(session):
    assert run_duckdb_sql("reach_guard_sess", "SELECT sum(amount) AS s FROM orders")["data"] == [
        {"s": 60.0}
    ]
    assert run_duckdb_sql("reach_guard_sess", "SELECT * FROM range(3)")["row_count"] == 3
    assert run_duckdb_sql("reach_guard_sess", "DESCRIBE orders")["row_count"] == 2
    assert run_duckdb_sql("reach_guard_sess", "SHOW TABLES")["row_count"] >= 1
    # A dataset whose *name* looks like a file is still that dataset.
    assert run_duckdb_sql("reach_guard_sess", 'SELECT id FROM "orders.csv"')["data"] == [{"id": 7}]


def test_sql_sandbox_over_http_is_403_not_500(session):
    res = client.post(
        "/api/v1/tools/sql",
        json={
            "session_id": "reach_guard_sess",
            "sql_query": "SELECT * FROM read_text('/etc/hostname')",
        },
    )
    assert res.status_code == 403
    assert "read_text" in res.json()["detail"]
    bad = client.post(
        "/api/v1/tools/sql", json={"session_id": "reach_guard_sess", "sql_query": "SELEC 1"}
    )
    assert bad.status_code == 400


def test_sql_mistakes_come_back_as_400_with_duckdbs_hint(session):
    res = client.post(
        "/api/v1/tools/sql",
        json={"session_id": "reach_guard_sess", "sql_query": "SELECT amout FROM orders"},
    )
    assert res.status_code == 400
    assert "amout" in res.json()["detail"] and "amount" in res.json()["detail"]  # candidate binding


def test_limit_detection_uses_the_parse_tree_not_a_substring(session, monkeypatch):
    big = pa.table({"name": ["nolimitx"] * 50, "n": list(range(50))})
    SessionManager().get_session("reach_guard_sess").register_dataset("big", big)
    # 'LIMIT' appearing inside a string literal used to switch the row cap off.
    out = run_duckdb_sql("reach_guard_sess", "SELECT * FROM big WHERE name = 'nolimitx'", limit=5)
    assert out["row_count"] == 5
    # The caller's own LIMIT / ORDER BY are honoured, under the service ceiling.
    out = run_duckdb_sql("reach_guard_sess", "SELECT n FROM big ORDER BY n DESC LIMIT 3", limit=100)
    assert [r["n"] for r in out["data"]] == [49, 48, 47]
    monkeypatch.setattr(settings, "MAX_RESULT_ROWS", 10)
    assert (
        run_duckdb_sql("reach_guard_sess", "SELECT * FROM big LIMIT 40", limit=1_000_000)[
            "row_count"
        ]
        == 10
    )
    assert (
        run_duckdb_sql("reach_guard_sess", "SELECT * FROM big", limit=1_000_000)["row_count"] == 10
    )


def test_dag_model_sql_cannot_read_files():
    with pytest.raises(ValueError):
        safe_model_sql("SELECT * FROM read_csv_auto('/etc/passwd')")
    assert safe_model_sql("SELECT id, amount * 2 AS double_amount FROM stg_orders")


def test_upload_filename_cannot_escape_the_upload_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    target = tmp_path / "pwned.csv"
    res = client.post(
        "/api/v1/import/file",
        data={"dataset_name": "up", "session_id": "reach_upload_sess"},
        files={"file": (f"../{target.name}", io.BytesIO(b"a,b\n1,2\n"), "text/csv")},
    )
    assert res.status_code == 200 and res.json()["row_count"] == 1
    assert not target.exists()
    assert len(os.listdir(tmp_path / "uploads")) == 1
    assert res.json()["column_types"] == {"a": "int64", "b": "int64"}


def test_safe_upload_name():
    a, b = safe_upload_name("../../etc/订单 (1).XLSX"), safe_upload_name("../../etc/订单 (1).XLSX")
    assert a != b and a.endswith("_订单 (1).xlsx") and "/" not in a and ".." not in a
    assert safe_upload_name("").endswith("_upload")
    assert safe_upload_name("C:\\Users\\x\\.env").endswith("_env")


def test_rest_file_path_import_is_confined(tmp_path, monkeypatch):
    allowed = tmp_path / "inbox"
    allowed.mkdir()
    (allowed / "ok.csv").write_text("a\n1\n2\n")
    (tmp_path / "secret.csv").write_text("k\nv\n")
    monkeypatch.setattr(settings, "IMPORT_ALLOWED_DIRS", str(allowed))

    ok = client.post(
        "/api/v1/import/file",
        data={
            "file_path": str(allowed / "ok.csv"),
            "dataset_name": "d",
            "session_id": "reach_path_sess",
        },
    )
    assert ok.status_code == 200 and ok.json()["row_count"] == 2
    for path in [str(tmp_path / "secret.csv"), str(allowed / ".." / "secret.csv"), "/etc/passwd"]:
        res = client.post(
            "/api/v1/import/file",
            data={"file_path": path, "dataset_name": "d", "session_id": "reach_path_sess"},
        )
        assert res.status_code == 403, path

    link = allowed / "link.csv"
    link.symlink_to(tmp_path / "secret.csv")
    assert (
        client.post(
            "/api/v1/import/file",
            data={"file_path": str(link), "dataset_name": "d", "session_id": "reach_path_sess"},
        ).status_code
        == 403
    )


def test_legacy_xls_upload_is_a_400_with_guidance():
    res = client.post(
        "/api/v1/import/file",
        data={"dataset_name": "old", "session_id": "reach_xls_sess"},
        files={
            "file": (
                "old.xls",
                io.BytesIO(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64),
                "application/vnd.ms-excel",
            )
        },
    )
    assert res.status_code == 400 and "xlsx" in res.json()["detail"]


def test_csv_path_with_a_quote_is_data_not_sql(tmp_path):
    path = tmp_path / "o'brien.csv"
    path.write_text("a,b\n1,2\n")
    assert LocalFileConnector(f"file://{path}").fetch_to_arrow("x").num_rows == 1


def test_malformed_csv_rows_are_counted_not_silently_dropped(tmp_path):
    path = tmp_path / "dirty.csv"
    path.write_text(
        "id,amount\n"
        + "".join(f"{i},{i}.5\n" for i in range(200))
        + "201,1,2,3,4\n202,9.5,extra\n203,9.5\n"
    )
    connector = LocalFileConnector(f"file://{path}")
    tbl = connector.fetch_to_arrow("x")
    assert tbl.num_rows == 201
    assert connector.rejected_rows == 2

    res = client.post(
        "/api/v1/import/file",
        data={"dataset_name": "dirty", "session_id": "reach_dirty_sess"},
        files={"file": ("dirty.csv", io.BytesIO(path.read_bytes()), "text/csv")},
    )
    assert res.json()["row_count"] == 201 and res.json()["rejected_rows"] == 2
    assert "WARNING" in res.json()["summary"]


def test_reverse_etl_file_export_is_confined(tmp_path, monkeypatch, session):
    monkeypatch.setattr(settings, "EXPORT_DIR", str(tmp_path / "exports"))
    con = session.get_duckdb_conn()
    out = DestinationSync.sync_table_to_destination(
        con, "orders", "file://orders_out.csv", "orders_out"
    )
    assert out["synced_rows"] == 3 and (tmp_path / "exports" / "orders_out.csv").exists()
    for dest in [
        f"file://{tmp_path}/escape.csv",
        "file://../escape.parquet",
        "file://a/../../escape.csv",
    ]:
        with pytest.raises(PermissionError):
            DestinationSync.sync_table_to_destination(con, "orders", dest, "orders_out")
    assert not (tmp_path / "escape.csv").exists()

    # A sqlite URL's path is always taken relative to EXPORT_DIR, so an "absolute"
    # one cannot land where it points.
    outside = tmp_path / "escape.db"
    DestinationSync.sync_table_to_destination(con, "orders", f"sqlite:///{outside}", "orders_out")
    assert not outside.exists()
    assert any(
        name == "escape.db"
        for _root, _dirs, files in os.walk(tmp_path / "exports")
        for name in files
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8000/api/v1/tools/sql",
        "http://localhost/x",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.2.31.12/hook",
        "http://[::1]/x",
        "http://0.0.0.0/x",
        "file:///etc/passwd",
        "gopher://example.com/",
        "http://user:pass@example.com/",
        "http:///nohost",
    ],
)
def test_webhook_refuses_internal_and_non_http_targets(url):
    with pytest.raises(PermissionError):
        assert_public_http_url(url)
    sent = WebhookPusher.send_alert(url, "t", "m")
    assert sent["status"] == "FAILED" and sent["attempts"] == 0 and sent.get("rejected") is True


def test_webhook_allowlist_is_an_explicit_operator_decision():
    assert assert_public_http_url("http://127.0.0.1:9/hook", allowed_hosts=["127.0.0.1"])


def test_resolve_inside(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    assert resolve_inside(str(root / "a.csv"), [str(root)], "t") == os.path.realpath(root / "a.csv")
    with pytest.raises(PermissionError):
        resolve_inside(str(tmp_path / "rootkit" / "a.csv"), [str(root)], "t")  # prefix, not a child


def test_ontology_action_sql_is_limited_to_row_mutations():
    assert assert_mutation_sql("UPDATE dim SET tier = 'gold' WHERE id = 'c1'")
    for sql in [
        "DROP TABLE dim",
        "UPDATE dim SET a = 1; DROP TABLE dim",
        "COPY dim TO '/tmp/x.csv'",
        "ATTACH '/tmp/x.db' AS x",
        "UPDATE dim SET a = (SELECT content FROM read_text('/etc/passwd'))",
        "INSERT INTO dim SELECT getenv('HOME')",
    ]:
        with pytest.raises(ValueError):
            assert_mutation_sql(sql)

    engine = get_ontology_engine()
    with pytest.raises(ValueError):
        engine.register_action_type(
            ActionType(
                name="evil_action",
                target_object_type="Customer",
                handler_type="SQL_MUTATION",
                handler_config={"sql_template": "DROP TABLE {instance_id}"},
            )
        )
    res = client.post(
        "/api/v1/ontology/actions",
        json={
            "name": "evil_action_http",
            "target_object_type": "Customer",
            "handler_type": "SQL_MUTATION",
            "handler_config": {"sql_template": "COPY dim TO '/tmp/{instance_id}.csv'"},
        },
    )
    assert res.status_code == 400


def test_unimplemented_reverse_etl_action_no_longer_reports_success(session):
    engine = get_ontology_engine()
    engine.register_action_type(
        ActionType(
            name="fake_sync_action", target_object_type="Customer", handler_type="REVERSE_ETL_SYNC"
        )
    )
    audit = engine.execute_action(session.get_duckdb_conn(), "fake_sync_action", "c1", {})
    assert audit["status"] == "FAILED" and audit["execution_result"]["status"] == "NOT_IMPLEMENTED"
