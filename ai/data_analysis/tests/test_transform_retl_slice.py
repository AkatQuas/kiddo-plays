"""Closed loop: clean / DAG materialize -> reverse sync and activation.

Covers gaps that used to drop rows, ignore unknown columns, or send the wrong webhook body.
"""

import json
import sqlite3
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

import duckdb
import pytest

from data_analysis.retl.audience_exporter import AudienceExporter
from data_analysis.retl.destination_sync import DestinationSync
from data_analysis.retl.webhook_pusher import WebhookPusher
from data_analysis.transform.data_cleaner import DataCleaner
from data_analysis.transform.materializer import Materializer
from data_analysis.transform.pipeline_dag import DAGModel, PipelineDAG, get_pipeline_engine


@pytest.fixture
def con():
    return duckdb.connect(":memory:")


def _tables(con):
    return {row[0] for row in con.execute("SELECT table_name FROM duckdb_tables()").fetchall()}


def test_cleaner_rejects_unknown_columns_and_inverted_clip(con):
    con.execute("CREATE TABLE raw AS SELECT 1 AS uid, 10.0 AS amount")
    con.execute("CREATE TABLE victim AS SELECT 1 AS keep_me")
    with pytest.raises(ValueError, match="Unknown dedup"):
        DataCleaner.clean_table(con, "raw", "out", dedup_keys=["missing"])
    with pytest.raises(ValueError, match="Unknown fillna"):
        DataCleaner.clean_table(con, "raw", "out", fillna_rules={"missing": 0})
    with pytest.raises(ValueError, match="min"):
        DataCleaner.clean_table(
            con, "raw", "out", outlier_clip_cols={"amount": {"min": 10, "max": 1}}
        )
    assert "out" not in _tables(con)
    assert "victim" in _tables(con)


def test_materializer_aliases_colliding_dimension_columns(con):
    con.execute("CREATE TABLE fact AS SELECT 1 AS id, 10 AS age")
    con.execute("CREATE TABLE dimu AS SELECT 1 AS id, 99 AS age, 'bj' AS city")
    res = Materializer.create_wide_table(
        con,
        "wide",
        "fact",
        [
            {
                "dim_table": "dimu",
                "on": "fact.id = dimu.id",
                "select_cols": ["dimu.age", "dimu.city"],
            }
        ],
    )
    assert res["status"] == "SUCCESS"
    assert res["columns"] == ["id", "age", "dimu_age", "city"]
    assert con.execute("SELECT age, dimu_age, city FROM wide").fetchone() == (10, 99, "bj")


def test_materializer_requires_join_keys(con):
    con.execute("CREATE TABLE fact AS SELECT 1 AS id")
    with pytest.raises(ValueError, match="dim_table"):
        Materializer.create_wide_table(con, "wide", "fact", [{"dim_table": "fact"}])


def test_global_pipeline_engine_is_one_object():
    assert PipelineDAG.get_instance() is get_pipeline_engine()
    assert PipelineDAG.get_instance() is get_pipeline_engine("_global")


def test_pipeline_subset_includes_ancestors_and_rejects_unknown_names(con):
    dag = PipelineDAG(session_id="slice-retl-closure", persistent=False)
    dag.register_model(DAGModel(name="stg_a", sql="SELECT 1 AS id", materialization="table"))
    dag.register_model(
        DAGModel(
            name="mart_b",
            sql="SELECT id FROM stg_a",
            materialization="table",
            depends_on=["stg_a"],
        )
    )
    dag.register_model(DAGModel(name="other", sql="SELECT 2 AS id", materialization="table"))

    res = dag.run_pipeline(con, models=["mart_b"])
    assert res["execution_order"] == ["stg_a", "mart_b"]
    assert "other" not in _tables(con)

    empty = dag.run_pipeline(con, models=[])
    assert empty["total_models"] == 0
    assert empty["execution_order"] == []

    with pytest.raises(ValueError, match="Unknown DAG model"):
        dag.run_pipeline(con, models=["missing_model"])


def test_incremental_unique_key_must_exist_in_output(con):
    dag = PipelineDAG(session_id="slice-retl-inc", persistent=False)
    dag.register_model(
        DAGModel(
            name="inc_bad",
            sql="SELECT 1 AS id",
            materialization="incremental",
            unique_key="missing",
        )
    )
    with pytest.raises(RuntimeError, match="unique_key"):
        dag.run_pipeline(con)
    assert "inc_bad" not in _tables(con)


def test_sqlite_streams_batches_appends_and_replace_clears_empty(tmp_path, con):
    con.execute("CREATE TABLE src (id INTEGER, name VARCHAR, score DOUBLE)")
    con.executemany(
        "INSERT INTO src VALUES (?, ?, ?)",
        [(1, "a'b", None), (2, "x", 1.5), (3, "y", 2.5), (4, "z", None), (5, "q", 0.0)],
    )
    db = tmp_path / "sink.db"
    url = "sqlite:///" + str(db)
    replaced = DestinationSync.sync_table_to_destination(
        con,
        "src",
        url,
        "landed",
        mode="replace",
        chunk_size=2,
    )
    assert replaced["status"] == "SUCCESS"
    assert replaced["synced_rows"] == 5
    assert db.is_file()

    with sqlite3.connect(db) as sink:
        rows = sink.execute("SELECT id, name, score FROM landed ORDER BY id").fetchall()
    assert rows[0] == (1, "a'b", None)
    assert rows[1] == (2, "x", 1.5)
    assert rows[4] == (5, "q", 0.0)

    con.execute("CREATE TABLE more AS SELECT 6 AS id, 'n' AS name, 3.0 AS score")
    appended = DestinationSync.sync_table_to_destination(
        con,
        "more",
        url,
        "landed",
        mode="append",
        chunk_size=2,
    )
    assert appended["synced_rows"] == 1
    with sqlite3.connect(db) as sink:
        assert sink.execute("SELECT count(*) FROM landed").fetchone()[0] == 6

    con.execute("CREATE TABLE empty AS SELECT * FROM src WHERE 1 = 0")
    cleared = DestinationSync.sync_table_to_destination(
        con,
        "empty",
        url,
        "landed",
        mode="replace",
        chunk_size=2,
    )
    assert cleared["synced_rows"] == 0
    with sqlite3.connect(db) as sink:
        assert sink.execute("SELECT count(*) FROM landed").fetchone()[0] == 0


def test_file_export_is_bound_and_append_does_not_touch_the_file(tmp_path, con):
    con.execute("CREATE TABLE src AS SELECT 1 AS i, 'v' AS t")
    con.execute("CREATE TABLE victim AS SELECT 1 AS keep_me")
    parquet = tmp_path / "out.parquet"
    parquet.write_bytes(b"keep")
    with pytest.raises(ValueError, match="replace"):
        DestinationSync.sync_table_to_destination(
            con,
            "src",
            str(parquet),
            "ignored",
            mode="append",
        )
    assert parquet.read_bytes() == b"keep"

    written = DestinationSync.sync_table_to_destination(
        con,
        "src",
        str(parquet),
        "ignored",
        mode="replace",
    )
    assert written["synced_rows"] == 1
    assert con.execute("SELECT i, t FROM read_parquet(?)", [str(parquet)]).fetchone() == (1, "v")

    evil = tmp_path / "a'; DROP TABLE victim; --.parquet"
    DestinationSync.sync_table_to_destination(con, "src", str(evil), "ignored", mode="replace")
    assert con.execute("SELECT keep_me FROM victim").fetchone() == (1,)
    assert evil.is_file()


def test_sqlite_decimal_binds_exact_digits(tmp_path, con):
    exact = "12345678901234567890.123456789012345678"
    con.execute(
        "CREATE TABLE src AS SELECT ?::DECIMAL(38, 18) AS amount",
        [exact],
    )
    db = tmp_path / "dec.db"
    res = DestinationSync.sync_table_to_destination(
        con,
        "src",
        "sqlite:///" + str(db),
        "landed",
        mode="replace",
        chunk_size=1,
    )
    assert res["synced_rows"] == 1
    with sqlite3.connect(db) as sink:
        stored_type, stored = sink.execute("SELECT typeof(amount), amount FROM landed").fetchone()
    assert stored_type == "text"
    assert Decimal(stored) == Decimal(exact)
    assert Decimal(stored) != Decimal(float(exact))


def test_sync_rejects_bad_chunk_size_and_unknown_mode(con):
    con.execute("CREATE TABLE src AS SELECT 1 AS i")
    with pytest.raises(ValueError, match="chunk_size"):
        DestinationSync.sync_table_to_destination(
            con,
            "src",
            "sqlite:///data/ignored.db",
            "t",
            chunk_size=0,
        )
    with pytest.raises(ValueError, match="chunk_size"):
        DestinationSync.sync_table_to_destination(
            con,
            "src",
            "sqlite:///data/ignored.db",
            "t",
            chunk_size=True,
        )
    with pytest.raises(ValueError, match="mode"):
        DestinationSync.sync_table_to_destination(
            con,
            "src",
            "sqlite:///data/ignored.db",
            "t",
            mode="upsert",
        )


def test_audience_count_is_not_capped_by_limit(con):
    con.execute(
        "CREATE TABLE users AS SELECT * FROM (VALUES (1, 'e'), (2, 'e'), (3, 'w')) t(id, region)"
    )
    res = AudienceExporter.export_cohort(
        con,
        "users",
        filter_sql="region = 'e'",
        export_columns=["id"],
        format_type="JSON",
        limit=1,
    )
    assert res["total_audience_count"] == 2
    assert res["exported_count"] == 1
    assert res["truncated"] is True
    assert res["format"] == "json"
    assert res["data"] == [{"id": 1}] or res["data"] == [{"id": 2}]

    csv_res = AudienceExporter.export_cohort(con, "users", format_type="csv", limit=10)
    assert csv_res["total_audience_count"] == 3
    assert csv_res["exported_count"] == 3
    assert "id,region" in csv_res["data"]

    with pytest.raises(ValueError, match="format"):
        AudienceExporter.export_cohort(con, "users", format_type="parquet")
    with pytest.raises(ValueError, match="limit"):
        AudienceExporter.export_cohort(con, "users", limit=0)


def test_webhook_payloads_for_slack_wecom_and_non_json_metrics():
    slack = WebhookPusher.build_payload(
        "告警", "销售额下降", platform="Slack", extra_metrics={"region": "East"}
    )
    assert slack == {"text": "*告警*\n销售额下降\n• region: East"}

    wecom = WebhookPusher.build_payload("标题", "正文", platform="wecom", extra_metrics={"k": 1})
    assert wecom["msgtype"] == "markdown"
    assert "### 标题" in wecom["markdown"]["content"]
    assert "> k: 1" in wecom["markdown"]["content"]

    feishu = WebhookPusher.build_payload(
        "T", "M", platform="feishu", extra_metrics={"Anomaly": "Spike"}
    )
    assert feishu["msg_type"] == "post"
    assert feishu["content"]["post"]["zh_cn"]["title"] == "T"

    captured = {}

    def _capture(req, timeout=5):
        captured["body"] = json.loads(req.data.decode())
        captured["timeout"] = timeout

        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def getcode(self):
                return 204

            def read(self, _n=-1):
                return b""

        return _Resp()

    with patch("data_analysis.retl.webhook_pusher._opener.open", _capture):
        res = WebhookPusher.send_alert(
            "http://hooks.example/alert",
            "t",
            "m",
            platform="generic",
            extra_metrics={"when": datetime(2026, 1, 2, 3, 4, 5)},
            max_retries=1,
        )
    assert res["status"] == "SUCCESS"
    assert captured["body"]["metrics"]["when"].startswith("2026-01-02")

    blocked = WebhookPusher.send_alert("file:///tmp/hook", "t", "m", max_retries=1)
    assert blocked["status"] == "FAILED" and blocked.get("rejected") is True
    assert "http" in blocked["error"].lower()
