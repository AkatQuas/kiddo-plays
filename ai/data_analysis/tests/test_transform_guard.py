"""Injection guards on the transform layer (data_cleaner / pipeline_dag / materializer).

These three modules are reachable from POST /api/v1/transform/* and the
execute_data_cleaning / run_dag_pipeline MCP tools, so every caller-supplied
identifier and value must be validated or bound.
"""

import duckdb
import pytest

from data_analysis.transform.data_cleaner import DataCleaner
from data_analysis.transform.materializer import Materializer
from data_analysis.transform.pipeline_dag import DAGModel, PipelineDAG


@pytest.fixture
def con():
    c = duckdb.connect(":memory:")
    c.execute("CREATE TABLE victim AS SELECT 1 AS keep_me")
    c.execute(
        "CREATE TABLE raw AS SELECT * FROM (VALUES "
        "(1, 10.0, 'a'), (1, 10.0, 'a'), (2, NULL, 'b'), (3, 9999.0, 'c')"
        ") t(uid, amount, tag)"
    )
    return c


def _tables(con):
    return {r[0] for r in con.execute("SELECT table_name FROM duckdb_tables()").fetchall()}


def test_cleaner_rejects_injected_table_name(con):
    with pytest.raises(ValueError, match="Invalid"):
        DataCleaner.clean_table(con, "raw; DROP TABLE victim", "out")
    assert "victim" in _tables(con)


def test_cleaner_rejects_injected_target_name(con):
    with pytest.raises(ValueError, match="Invalid"):
        DataCleaner.clean_table(con, "raw", "out AS SELECT 1; DROP TABLE victim")
    assert "victim" in _tables(con)


def test_cleaner_rejects_injected_dedup_key(con):
    with pytest.raises(ValueError, match="Invalid"):
        DataCleaner.clean_table(con, "raw", "out", dedup_keys=['uid") ; DROP TABLE victim --'])
    assert "victim" in _tables(con)


def test_cleaner_binds_fillna_string_value(con):
    # A quote-bearing fill value must land as data, not as SQL.
    res = DataCleaner.clean_table(con, "raw", "out_fill", fillna_rules={"tag": "it's fine"})
    assert res["cleaned_rows"] == 4
    assert "victim" in _tables(con)


def test_cleaner_fillna_rejects_unsupported_type(con):
    with pytest.raises(ValueError, match="unsupported type"):
        DataCleaner.clean_table(con, "raw", "out", fillna_rules={"amount": {"nested": 1}})


def test_cleaner_mean_fill_and_clip_still_work(con):
    res = DataCleaner.clean_table(
        con,
        "raw",
        "out_clean",
        dedup_keys=["uid"],
        fillna_rules={"amount": "MEAN"},
        outlier_clip_cols={"amount": {"min": 0.0, "max": 100.0}},
    )
    assert res["original_rows"] == 4
    assert res["cleaned_rows"] == 3
    rows = con.execute("SELECT amount FROM out_clean ORDER BY uid").fetchall()
    assert all(r[0] is not None and 0.0 <= r[0] <= 100.0 for r in rows)


def test_dag_rejects_injected_model_name(con):
    pipe = PipelineDAG.get_instance()
    pipe.clear_models()
    pipe.register_model(DAGModel(name="victim", sql="SELECT 1 AS x", materialization="table"))
    # name is interpolated into DROP TABLE / ALTER TABLE RENAME
    with pytest.raises(ValueError, match="Invalid"):
        pipe._execute_single_model(con, DAGModel(name='m" ; DROP TABLE victim --', sql="SELECT 1"))
    assert "victim" in _tables(con)
    pipe.clear_models()


def test_dag_rejects_chained_model_sql(con):
    pipe = PipelineDAG.get_instance()
    pipe.clear_models()
    with pytest.raises(ValueError, match="1 statement"):
        pipe._execute_single_model(con, DAGModel(name="m1", sql="SELECT 1; DROP TABLE victim"))
    assert "victim" in _tables(con)
    pipe.clear_models()


def test_dag_rejects_non_select_model_sql(con):
    pipe = PipelineDAG.get_instance()
    pipe.clear_models()
    with pytest.raises(ValueError, match="read-only"):
        pipe._execute_single_model(con, DAGModel(name="m2", sql="DROP TABLE victim"))
    assert "victim" in _tables(con)
    pipe.clear_models()


def test_materializer_rejects_injected_join_predicate(con):
    con.execute("CREATE TABLE dim_u AS SELECT 1 AS id, 30 AS age")
    with pytest.raises(ValueError, match="statement terminator"):
        Materializer.create_wide_table(
            con,
            "wide",
            "raw",
            [{"dim_table": "dim_u", "on": "raw.uid = dim_u.id; DROP TABLE victim"}],
        )
    assert "victim" in _tables(con)


def test_materializer_happy_path(con):
    con.execute("CREATE TABLE dim_u AS SELECT 1 AS id, 30 AS age")
    res = Materializer.create_wide_table(
        con,
        "wide_ok",
        "raw",
        [{"dim_table": "dim_u", "on": "raw.uid = dim_u.id", "select_cols": ["dim_u.age"]}],
    )
    assert res["status"] == "SUCCESS"
    assert res["row_count"] == 4
