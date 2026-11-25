"""Aggregation, variance split, attribution, and t/F on one slice."""

import duckdb
import pytest

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.distributed_ops.dist_eda import DistributedEDA
from data_analysis.distributed_ops.ray_exec import (
    group_moment_partition,
    merge_group_moments,
    pearson_partition,
)
from data_analysis.distributed_ops.variance_decomp import VarianceDecomposition
from data_analysis.operators.spss.hypothesis import run_spss_hypothesis_test
from data_analysis.operators.variance import run_variance_decomposition


def test_moments_stay_null_when_undefined_and_quantiles_are_ordered():
    con = duckdb.connect()
    con.execute("CREATE TABLE moments (bucket VARCHAR, skewed DOUBLE, flat DOUBLE)")
    con.execute(
        "INSERT INTO moments VALUES "
        "('a', 1, 5), ('b', 1, 5), ('c', 1, 5), ('d', 1, 5), ('e', 10, 5)"
    )
    report = DistributedEDA.profile_table(con, "moments")
    skewed = report["columns"]["skewed"]
    flat = report["columns"]["flat"]
    assert skewed["semantic_type"] == "MEASURE"
    assert skewed["skewness"] > 1
    assert skewed["kurtosis"] is not None
    assert skewed["quantile_method"] == "quantile_cont"
    quantiles = skewed["quantiles"]
    assert quantiles["p25"] <= quantiles["p50"] <= quantiles["p75"]
    assert flat["std"] == 0.0
    assert flat["skewness"] is None
    assert flat["kurtosis"] is None
    assert any("not filled in as 0" in item for item in report["evidence"]["caveats"])
    assert any("flat" in item for item in report["evidence"]["caveats"])
    con.close()


def test_variance_split_matches_hand_totals_and_order_sensitive_shapley():
    con = duckdb.connect()
    con.execute("CREATE TABLE vd (region VARCHAR, category VARCHAR, y DOUBLE)")
    con.execute(
        "INSERT INTO vd VALUES "
        "('E','E',1), ('E','E',3), ('W','W',10), ('W','W',12), ('E', NULL, 99)"
    )
    res = VarianceDecomposition.decompose(con, "vd", "y", ["region", "category"])
    assert res["n"] == 4
    assert res["evidence"]["rows_scanned"] == 5
    assert res["evidence"]["nulls_dropped"] == 1
    assert abs(res["ss_total"] - 85) < 1e-6
    assert abs(res["population_variance"] - 21.25) < 1e-6
    region = next(item for item in res["factors"] if item["dimension"] == "region")
    assert region["closes"] is True
    assert abs(region["ss_between"] - 81) < 1e-6
    assert abs(region["ss_within"] - 4) < 1e-6
    assert (
        abs(
            region["population_variance_between"]
            + region["population_variance_within"]
            - res["population_variance"]
        )
        < 1e-6
    )
    assert abs(region["f_statistic"] - 40.5) < 1e-4
    assert region["p_value"] < 0.05
    assert res["sequential"]["closes"] is True
    assert abs(res["sequential"]["steps"][0]["ss_incremental"] - 81) < 1e-6
    assert abs(res["sequential"]["steps"][1]["ss_incremental"] - 0) < 1e-6
    shapley = res["sun_shapley"]
    assert shapley["orderings_used"] == 2
    assert shapley["order_invariant"] is False
    assert shapley["closes"] is True
    shares = {item["dimension"]: item["ss"] for item in shapley["dimensions"]}
    assert abs(shares["region"] - 40.5) < 1e-6
    assert abs(shares["category"] - 40.5) < 1e-6
    assert abs(shapley["ss_explained"] + shapley["ss_residual"] - res["ss_total"]) < 1e-6

    con.execute("CREATE TABLE one_way (g VARCHAR, y DOUBLE)")
    con.execute("INSERT INTO one_way VALUES ('A',1),('A',2),('A',3),('B',5),('B',7)")
    one = VarianceDecomposition.decompose(con, "one_way", "y", ["g"])
    assert abs(one["ss_total"] - 23.2) < 1e-6
    factor = one["factors"][0]
    assert abs(factor["ss_between"] - 19.2) < 1e-6
    assert abs(factor["ss_within"] - 4) < 1e-6
    assert abs(factor["f_statistic"] - 14.4) < 1e-4
    assert one["sun_shapley"]["orderings_used"] == 1
    assert one["sun_shapley"]["order_invariant"] is True

    con.execute("CREATE TABLE grid (a VARCHAR, b VARCHAR, y DOUBLE)")
    con.execute(
        "INSERT INTO grid VALUES "
        "('A','X',1),('A','X',3),('A','Y',5),('A','Y',7),"
        "('B','X',2),('B','X',4),('B','Y',8),('B','Y',10)"
    )
    grid = VarianceDecomposition.decompose(con, "grid", "y", ["a", "b"])
    interaction = grid["interaction"]
    assert interaction["balanced"] is True
    assert interaction["closes"] is True
    assert abs(grid["ss_total"] - 68) < 1e-6
    assert abs(interaction["ss_a"] - 8) < 1e-6
    assert abs(interaction["ss_b"] - 50) < 1e-6
    assert abs(interaction["ss_interaction"] - 2) < 1e-6
    assert abs(interaction["ss_within"] - 8) < 1e-6

    con.execute("CREATE TABLE unbalanced (a VARCHAR, b VARCHAR, y DOUBLE)")
    con.execute("INSERT INTO unbalanced VALUES ('A','X',1),('A','X',2),('A','Y',3),('B','X',4)")
    uneven = VarianceDecomposition.decompose(con, "unbalanced", "y", ["a", "b"])
    assert uneven["interaction"]["balanced"] is False
    assert uneven["interaction"]["ss_interaction"] is None

    only_e = VarianceDecomposition.decompose(con, "vd", "y", ["category"], filters="category = 'E'")
    assert only_e["n"] == 2
    assert only_e["evidence"]["rows_scanned"] == 2
    assert abs(only_e["ss_total"] - 2) < 1e-6

    con.execute(
        "CREATE TABLE wide_dim (d1 VARCHAR, d2 VARCHAR, d3 VARCHAR, d4 VARCHAR, d5 VARCHAR, y DOUBLE)"
    )
    con.execute(
        "INSERT INTO wide_dim VALUES "
        "('a','a','a','a','z',1), ('a','a','a','a','z',3), "
        "('b','b','b','b','z',10), ('b','b','b','b','z',12)"
    )
    wide = VarianceDecomposition.decompose(con, "wide_dim", "y", ["d1", "d2", "d3", "d4", "d5"])
    assert wide["skipped_dimensions"] == ["d5"]
    assert wide["sun_shapley"]["orderings_used"] == 24
    wide_shares = [item["ss"] for item in wide["sun_shapley"]["dimensions"]]
    assert len(wide_shares) == 4
    assert all(abs(item - 20.25) < 1e-4 for item in wide_shares)
    assert abs(sum(wide_shares) - 81) < 1e-4
    con.close()


def test_partition_merge_matches_one_group_scan(tmp_path, monkeypatch):
    path = tmp_path / "cells.parquet"
    scan = duckdb.connect()
    scan.execute(
        "COPY (SELECT i % 3 AS region, i % 2 AS category, i * 1.0 AS __y FROM range(40) t(i)) "
        f"TO '{path.as_posix()}' (FORMAT PARQUET)"
    )
    tasks = [
        {"parquet": str(path), "part": index, "parts": 4, "dimensions": ["region", "category"]}
        for index in range(4)
    ]
    merged = merge_group_moments([group_moment_partition(task) for task in tasks])
    n = sum(cell["n"] for cell in merged)
    sum_y = sum(cell["s"] for cell in merged)
    sum_yy = sum(cell["ss"] for cell in merged)
    direct = scan.execute(
        "SELECT COUNT(__y), SUM(__y), SUM(__y * __y) FROM read_parquet(?)",
        [str(path)],
    ).fetchone()
    assert int(n) == int(direct[0])
    assert abs(sum_y - float(direct[1])) < 1e-6
    assert abs(sum_yy - float(direct[2])) < 1e-6

    scan.execute(
        "CREATE TABLE part_src AS SELECT i % 3 AS region, i % 2 AS category, i * 1.0 AS y FROM range(40) t(i)"
    )
    single = VarianceDecomposition.decompose(scan, "part_src", "y", ["region", "category"])

    def local_only(tasks, worker=None):
        fn = worker or pearson_partition
        return [fn(task) for task in tasks], "local"

    monkeypatch.setattr("data_analysis.distributed_ops.ray_exec.run_partition_tasks", local_only)
    monkeypatch.setattr(settings, "RAY_ENABLED", True)
    monkeypatch.setattr(settings, "RAY_MIN_ROWS", 1)
    monkeypatch.setattr(settings, "RAY_PARTITIONS", 4)
    parted = VarianceDecomposition.decompose(scan, "part_src", "y", ["region", "category"])
    assert parted["n"] == single["n"]
    assert abs(parted["ss_total"] - single["ss_total"]) < 1e-6
    assert abs(parted["factors"][0]["ss_between"] - single["factors"][0]["ss_between"]) < 1e-6
    assert any("backend=" in item for item in parted["evidence"]["caveats"])
    scan.close()


def test_hypothesis_exposes_closing_split_and_rejects_bad_inputs():
    session_id = "slice_hypothesis"
    sess = SessionManager().get_or_create_session(session_id)
    con = sess.get_duckdb_conn()
    con.execute("CREATE OR REPLACE TABLE slice_groups (g VARCHAR, score DOUBLE)")
    con.execute("INSERT INTO slice_groups VALUES ('A',1),('A',2),('A',3),('B',5),('B',7),('C',9)")
    anova = run_spss_hypothesis_test(session_id, "slice_groups", "one_way_anova", "score", "g")
    factor = anova["variance_decomposition"]["factors"][0]
    assert factor["closes"] is True
    assert factor["ss_between"] + factor["ss_within"] == pytest.approx(factor["ss_total"])
    assert anova["f_statistic"] == pytest.approx(factor["f_statistic"], abs=1e-3)

    con.execute("CREATE OR REPLACE TABLE slice_grid (y DOUBLE, a VARCHAR, b VARCHAR)")
    con.execute(
        "INSERT INTO slice_grid VALUES "
        "(1,'A','X'),(3,'A','X'),(5,'A','Y'),(7,'A','Y'),"
        "(2,'B','X'),(4,'B','X'),(8,'B','Y'),(10,'B','Y')"
    )
    two = run_spss_hypothesis_test(
        session_id, "slice_grid", "two_way_anova", "y", "a", factor_b="b"
    )
    interaction = two["variance_decomposition"]["interaction"]
    assert interaction["balanced"] is True
    assert interaction["closes"] is True
    assert abs(interaction["ss_interaction"] - 2) < 1e-6

    wrapped = run_variance_decomposition(session_id, "slice_groups", "score", ["g"])
    assert wrapped["factors"][0]["closes"] is True
    assert wrapped["evidence"]["operator"] == "variance_decomposition"

    with pytest.raises(ValueError, match="exactly 2 distinct groups"):
        run_spss_hypothesis_test(session_id, "slice_groups", "mann_whitney", "score", "g")

    driver = DistributedDriverAnalysis.analyze_driver(
        con, "slice_groups", "score", ["g"], "g = 'A' OR g = 'B'", "g = 'C'", top_k=3
    )
    assert driver["method"] == "additive_contribution"
    assert driver["hierarchy"][0]["closes"] is True


def test_hypothesis_refuses_a_table_past_the_cell_cap(monkeypatch):
    session_id = "slice_cap"
    sess = SessionManager().get_or_create_session(session_id)
    con = sess.get_duckdb_conn()
    con.execute("CREATE OR REPLACE TABLE slice_cap (g VARCHAR, score DOUBLE)")
    con.execute("INSERT INTO slice_cap VALUES ('A', 1), ('B', 2)")
    monkeypatch.setattr("data_analysis.operators.spss.hypothesis._MAX_CELLS", 1)
    with pytest.raises(ValueError, match="请先聚合再检验"):
        run_spss_hypothesis_test(session_id, "slice_cap", "independent_t_test", "score", "g")
