"""Contracts added with the engine upgrade. Existing suites keep their own asserts."""

import json

import duckdb
import pyarrow as pa
import pytest

from data_analysis.catalog.semantic_store import (
    EntityRef,
    MetricDefinition,
    SemanticModel,
    get_semantic_store,
)
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.copilot.insight_engine import discover_insights
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.engine.schema_infer import SchemaInferencer, SemanticType
from data_analysis.mcp_server import list_session_datasets, ontology_execute_action
from data_analysis.ontology.action_type import ActionParameter, ActionType
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType
from data_analysis.ontology.ontology_engine import get_ontology_engine
from data_analysis.operators.correlation import run_correlation_analysis
from data_analysis.operators.insights.outliers import detect_outliers
from data_analysis.operators.mining.timeseries import run_timeseries_forecast
from data_analysis.operators.sandbox import run_duckdb_sql
from data_analysis.operators.spss.hypothesis import run_spss_hypothesis_test
from data_analysis.operators.spss.regression import run_spss_regression
from data_analysis.transform.pipeline_dag import DAGModel, get_pipeline_engine

SID = "engine_upgrade_sess"


@pytest.fixture(scope="module")
def con():
    sess = SessionManager().get_or_create_session(SID)
    db = sess.get_duckdb_conn()
    db.execute("""
    CREATE OR REPLACE TABLE upgrade_pairs (before_v DOUBLE, after_v DOUBLE);
    INSERT INTO upgrade_pairs VALUES (1, 2), (2, 3), (3, 4), (4, 5), (5, 6);

    CREATE OR REPLACE TABLE upgrade_twoway (y DOUBLE, factor_a VARCHAR, factor_b VARCHAR);
    INSERT INTO upgrade_twoway VALUES
    (1, 'A', 'X'), (2, 'A', 'X'),
    (10, 'A', 'Y'), (11, 'A', 'Y'),
    (3, 'B', 'X'), (4, 'B', 'X'),
    (30, 'B', 'Y'), (32, 'B', 'Y');

    CREATE OR REPLACE TABLE upgrade_sales (
        month INTEGER, region VARCHAR, category VARCHAR, profit DOUBLE
    );
    INSERT INTO upgrade_sales VALUES
    (1, 'East', 'Digital', 5000),
    (1, 'East', 'Food', 2000),
    (1, 'North', 'Digital', 3000),
    (2, 'East', 'Digital', 2000),
    (2, 'East', 'Food', 2500),
    (2, 'North', 'Digital', 3200);

    CREATE OR REPLACE TABLE upgrade_price (
        month INTEGER, region VARCHAR, price DOUBLE, qty DOUBLE
    );
    INSERT INTO upgrade_price VALUES (1, 'East', 10, 2), (2, 'East', 12, 3);

    CREATE OR REPLACE TABLE upgrade_spike (sales DOUBLE);
    INSERT INTO upgrade_spike
    SELECT 0 FROM range(100)
    UNION ALL
    SELECT 9999 FROM range(3);

    CREATE OR REPLACE TABLE upgrade_corr (x DOUBLE, y DOUBLE, z DOUBLE);
    INSERT INTO upgrade_corr
    SELECT i, i * 2, random() FROM range(30) t(i);

    CREATE OR REPLACE TABLE u_customers (customer_id VARCHAR, region VARCHAR);
    INSERT INTO u_customers VALUES ('c1', 'East'), ('c2', 'West');
    CREATE OR REPLACE TABLE u_orders (order_id INTEGER, customer_id VARCHAR, amount DOUBLE, buyer_id VARCHAR, seller_id VARCHAR);
    INSERT INTO u_orders VALUES (1, 'c1', 10, 'b1', 's1'), (2, 'c1', 30, 'b1', 's1'), (3, 'c2', 5, 'b1', 's1');
    CREATE OR REPLACE TABLE u_lines (line_id INTEGER, order_id INTEGER, sku VARCHAR);
    INSERT INTO u_lines VALUES (1, 1, 'pen'), (2, 1, 'pad');

    CREATE OR REPLACE TABLE u_daily (order_date DATE, amount DOUBLE);
    INSERT INTO u_daily VALUES (DATE '2024-01-01', 10), (DATE '2024-01-03', 5);

    CREATE OR REPLACE TABLE upgrade_reg (y DOUBLE, x DOUBLE);
    INSERT INTO upgrade_reg VALUES (2, 1), (4, 2), (6, 3), (NULL, 4);

    CREATE OR REPLACE TABLE upgrade_forecast (day INTEGER, sales DOUBLE);
    INSERT INTO upgrade_forecast SELECT i, 10 + i FROM range(1, 25) t(i);

    CREATE OR REPLACE TABLE insight_src (region VARCHAR, sales DOUBLE, profit DOUBLE);
    INSERT INTO insight_src VALUES
    ('East', 10, 4), ('East', 12, 5), ('West', 8, 3), ('West', 9, 3), ('North', 11, 4);

    CREATE OR REPLACE TABLE src_inc (id INTEGER, v INTEGER);
    INSERT INTO src_inc VALUES (1, 10), (2, 20);

    CREATE OR REPLACE TABLE wb_customers (customer_id VARCHAR, tier VARCHAR, balance DOUBLE);
    INSERT INTO wb_customers VALUES ('C01', 'VIP', 1000);

    CREATE OR REPLACE TABLE dry_people (id VARCHAR, tier VARCHAR);
    INSERT INTO dry_people VALUES ('P1', 'STANDARD');

    CREATE OR REPLACE TABLE students (student_id VARCHAR, name VARCHAR);
    INSERT INTO students VALUES ('S1', 'Ann');
    CREATE OR REPLACE TABLE courses (course_id VARCHAR, title VARCHAR);
    INSERT INTO courses VALUES ('C1', 'Algebra'), ('C2', 'History');
    CREATE OR REPLACE TABLE enroll (student_id VARCHAR, course_id VARCHAR);
    INSERT INTO enroll VALUES ('S1', 'C1'), ('S1', 'C2');

    CREATE OR REPLACE TABLE shoppers (shopper_id VARCHAR, name VARCHAR);
    INSERT INTO shoppers VALUES ('S1', 'Ann');
    CREATE OR REPLACE TABLE purchases (purchase_id VARCHAR, shopper_id VARCHAR);
    INSERT INTO purchases VALUES ('P1', 'S1'), ('P2', 'S1');
    CREATE OR REPLACE TABLE items (item_id VARCHAR, purchase_id VARCHAR, sku VARCHAR);
    INSERT INTO items VALUES ('I1', 'P1', 'pen'), ('I2', 'P2', 'pad');
    """)
    return db


def test_identifier_rule_ignores_id_suffix_inside_words():
    infer = SchemaInferencer.infer_column_semantic_type
    assert infer("paid", pa.float64(), 40, 100) == SemanticType.MEASURE
    assert infer("valid", pa.float64(), 40, 100) == SemanticType.MEASURE
    assert infer("grid", pa.int64(), 40, 100) == SemanticType.MEASURE
    assert infer("order_id", pa.int64(), 100, 100) == SemanticType.IDENTIFIER


def test_outlier_count_is_the_population(con):
    res = detect_outliers(SID, "upgrade_spike", "sales", method="z_score", top_k=1)
    assert res["outlier_count"] == 3
    assert res["outlier_sample_size"] == 1
    assert len(res["outliers"]) == 1
    assert res["outliers"][0]["value"] == 9999.0


def test_paired_and_two_way(con):
    paired = run_spss_hypothesis_test(SID, "upgrade_pairs", "paired_t_test", "before_v", "after_v")
    assert paired["test_name"] == "Paired Samples T-Test"
    assert paired["n_pairs"] == 5
    assert paired["significant"] is True
    assert paired["p_value"] < 0.05

    two = run_spss_hypothesis_test(
        SID, "upgrade_twoway", "two_way_anova", "y", "factor_a", factor_b="factor_b"
    )
    assert two["test_name"] == "Two-Way ANOVA"
    assert two["n"] == 8
    assert any("C(a)" in effect["term"] and effect["significant"] for effect in two["effects"])
    assert two["significant"] is True


def test_attribution_closes_and_laspeyres_adds_up(con):
    res = DistributedDriverAnalysis.analyze_driver(
        con, "upgrade_sales", "profit", ["region", "category"], "month = 1", "month = 2", top_k=3
    )
    assert res["method"] == "additive_contribution"
    assert res["base_total"] == 10000.0
    assert res["diff_total"] == -2300.0
    level = res["hierarchy"][0]
    assert level["dimension_level"] == "region"
    assert level["closes"] is True
    assert level["top_negative_drivers"][0]["dimension_value"] == "East"
    deeper = res["hierarchy"][1]["top_negative_drivers"][0]["dimension_value"]
    assert deeper == "East / Digital"
    evidence = res["evidence"]
    for key in (
        "operator",
        "method",
        "sql",
        "rows_scanned",
        "rows_used",
        "nulls_dropped",
        "duration_ms",
        "caveats",
    ):
        assert key in evidence

    ratio = DistributedDriverAnalysis.analyze_driver(
        con,
        "upgrade_price",
        "price",
        ["region"],
        "month = 1",
        "month = 2",
        rate_col="price",
        volume_col="qty",
    )
    assert ratio["method"] == "laspeyres_rate_volume"
    branch = ratio["hierarchy"][0]["branches"][0]
    parts = branch["volume_effect"] + branch["rate_effect"] + branch["interaction_effect"]
    assert abs(parts - branch["diff_value"]) < 0.05
    assert abs(ratio["hierarchy"][0]["diff_sum"] - ratio["diff_total"]) < 0.05
    assert branch["volume_effect"] == 10.0
    assert branch["rate_effect"] == 4.0
    assert branch["interaction_effect"] == 2.0


def test_correlation_q_values_and_regression_row_counts(con):
    corr = run_correlation_analysis(SID, "upgrade_corr", columns=["x", "y", "z"])
    assert corr["multiple_testing"]["method"] == "benjamini_hochberg"
    pair = next(p for p in corr["high_correlation_pairs"] if {p["col1"], p["col2"]} == {"x", "y"})
    assert 0 <= pair["q_value"] <= 1
    assert "evidence" in corr

    reg = run_spss_regression(SID, "upgrade_reg", "y", ["x"])
    assert reg["rows_used"] == 3
    assert reg["nulls_dropped"] == 1
    assert reg["r_squared"] > 0.95


def test_sandbox_blocks_external_scans_and_marks_governance(con):
    with pytest.raises(PermissionError):
        run_duckdb_sql(SID, "SELECT * FROM read_csv('missing.csv')")
    free = run_duckdb_sql(SID, "SELECT 1 AS n")
    assert free["ungoverned_sql"] is True
    assert free["row_count"] == 1
    governed = run_duckdb_sql(SID, "SELECT 1 AS n", governed=True)
    assert governed["ungoverned_sql"] is False


def test_session_memory_budget_and_redacted_catalog(monkeypatch):
    sess = SessionManager().get_or_create_session(SID)
    sess.register_dataset(
        "listed_orders",
        pa.table({"id": [1, 2]}),
        {"conn_str": "postgresql://user:secret@db.example/app", "source": "orders"},
    )
    listed = json.loads(list_session_datasets(SID))
    match = next(row for row in listed["datasets"] if row["name"] == "listed_orders")
    assert match["source"]["conn_str"] == "***"
    assert "secret" not in json.dumps(match)

    # B semantics: MAX_MEMORY_PER_SESSION_MB=0 means unlimited; use a tiny positive cap.
    monkeypatch.setattr(settings, "MAX_MEMORY_PER_SESSION_MB", 1)
    with pytest.raises(Exception, match="(?i)memory|limit|budget|too large|exceed"):
        # ~2MB+ arrow should exceed 1MB cap
        sess.register_dataset("over_budget", pa.table({"x": list(range(300_000))}))


def test_semantic_fan_trap_matches_row_level_truth(con):
    store = get_semantic_store(SID)
    store.register_model(
        SemanticModel(
            name="customers_model",
            table_name="u_customers",
            grain=["customer_id"],
            columns=["customer_id", "region"],
            entities=[EntityRef(name="customer", type="primary", expr="customer_id")],
        )
    )
    store.register_model(
        SemanticModel(
            name="orders_model",
            table_name="u_orders",
            grain=["order_id"],
            columns=["order_id", "customer_id", "amount", "buyer_id", "seller_id"],
            entities=[
                EntityRef(name="customer", type="foreign", expr="customer_id"),
                EntityRef(name="party", type="foreign", expr="buyer_id"),
                EntityRef(name="party", type="foreign", expr="seller_id"),
            ],
        )
    )
    store.register_model(
        SemanticModel(
            name="buyers_model",
            table_name="u_buyers",
            grain=["buyer_id"],
            columns=["buyer_id", "desk"],
            entities=[EntityRef(name="party", type="primary", expr="buyer_id")],
        )
    )
    store.register_model(
        SemanticModel(
            name="sellers_model",
            table_name="u_sellers",
            grain=["seller_id"],
            columns=["seller_id", "desk"],
            entities=[EntityRef(name="party", type="primary", expr="seller_id")],
        )
    )
    store.register_metric(
        MetricDefinition(
            name="order_revenue",
            table_name="u_orders",
            formula="SUM(amount)",
            aggregation_type="SUM",
        )
    )
    store.register_model(
        SemanticModel(
            name="daily_model",
            table_name="u_daily",
            grain=["order_date"],
            columns=["order_date", "amount"],
            agg_time_dimension="order_date",
        )
    )
    store.register_metric(
        MetricDefinition(
            name="running_amount",
            table_name="u_daily",
            formula="SUM(amount)",
            aggregation_type="CUMULATIVE",
        )
    )

    open_sql = store.compile_query(["order_revenue"], ["region"])
    assert "SUM(amount)" in open_sql
    assert "GROUP BY 1" in open_sql
    locked = get_semantic_store("engine_upgrade_locked")
    locked.register_metric(
        MetricDefinition(
            name="locked_sales", table_name="t", formula="SUM(sales)", dimensions=["region"]
        )
    )
    with pytest.raises(ValueError, match="does not declare"):
        locked.compile_query(["locked_sales"], ["channel"])

    sql = store.compile_governed(["order_revenue"], ["region"])
    got = {row[0]: row[1] for row in con.execute(sql).fetchall()}
    truth = {
        row[0]: row[1]
        for row in con.execute("""
        SELECT c.region, SUM(o.amount)
        FROM u_orders o JOIN u_customers c ON o.customer_id = c.customer_id
        GROUP BY 1
    """).fetchall()
    }
    assert got.keys() == truth.keys()
    for key in truth:
        assert abs(got[key] - truth[key]) < 0.01

    with pytest.raises(ValueError, match="fan out|not reachable|Ambiguous"):
        store.compile_governed(["order_revenue"], ["sku"])
    with pytest.raises(ValueError, match="Ambiguous"):
        store.compile_governed(["order_revenue"], ["desk"])

    spine_sql = store.compile_governed(["running_amount"])
    spine = con.execute(spine_sql).fetchall()
    by_day = {str(day): value for day, value in spine}
    assert by_day["2024-01-01"] == 10
    assert by_day["2024-01-02"] == 10
    assert by_day["2024-01-03"] == 15


def test_forecast_holdout_is_extra(con):
    res = run_timeseries_forecast(
        SID, "upgrade_forecast", "day", "sales", horizon=6, model_type="arima"
    )
    assert len(res["forecasts"]) == 6
    assert res["forecasts"][0]["predicted_value"] > 0
    assert res["holdout"]["status"] == "ok"
    assert "model_mape" in res["holdout"]
    assert "naive_mape" in res["holdout"]
    assert "full series" in res["holdout"]["caveat"]


def test_insight_failures_become_caveats(con, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("forced outlier failure")

    monkeypatch.setattr("data_analysis.copilot.insight_engine.detect_outliers", boom)
    report = discover_insights(SID, "insight_src", intent="异常")
    assert any(
        item["action"] == "anomaly" and "forced outlier failure" in item["error"]
        for item in report["caveats"]
    )


def test_incremental_merge_and_ephemeral_view(con):
    pipe = get_pipeline_engine(SID)
    pipe.register_model(
        DAGModel(
            name="mart_inc",
            sql="SELECT * FROM src_inc",
            materialization="incremental",
            unique_key="id",
        )
    )
    pipe.register_model(
        DAGModel(
            name="eph_demo",
            sql="SELECT 1 AS x",
            materialization="ephemeral",
        )
    )
    first = pipe.run_pipeline(con)
    inc = next(row for row in first["results"] if row["model_name"] == "mart_inc")
    assert inc["incremental_mode"] == "full_refresh"
    assert inc["row_count"] == 2

    pipe._models["mart_inc"].sql = "SELECT 2 AS id, 99 AS v UNION ALL SELECT 3, 30"
    second = pipe.run_pipeline(con)
    merged = next(row for row in second["results"] if row["model_name"] == "mart_inc")
    assert merged["incremental_mode"] == "merge"
    rows = {
        row[0]: row[1] for row in con.execute("SELECT id, v FROM mart_inc ORDER BY id").fetchall()
    }
    assert rows == {1: 10, 2: 99, 3: 30}

    kind = con.execute(
        "SELECT table_type FROM information_schema.tables WHERE table_name = 'eph_demo'"
    ).fetchone()
    assert kind is not None
    assert "VIEW" in kind[0].upper()


def test_ontology_many_to_many_multihop_and_writeback(con):
    engine = get_ontology_engine()
    engine.register_object_type(
        ObjectType(name="Student", primary_key="student_id", backed_by_table="students")
    )
    engine.register_object_type(
        ObjectType(name="Course", primary_key="course_id", backed_by_table="courses")
    )
    engine.register_link_type(
        LinkType(
            name="student_courses",
            source_object_type="Student",
            target_object_type="Course",
            cardinality="MANY_TO_MANY",
            source_join_key="student_id",
            target_join_key="course_id",
            junction_table="enroll",
            junction_source_key="student_id",
            junction_target_key="course_id",
        )
    )
    courses = engine.traverse_links(con, "Student", "S1", "student_courses")
    assert sorted(row["course_id"] for row in courses["linked_instances"]) == ["C1", "C2"]
    assert courses["hop_counts"] == [2]
    saved = next(row for row in engine.db.list_ontology_links() if row["name"] == "student_courses")
    assert saved["junction_table"] == "enroll"
    assert saved["junction_source_key"] == "student_id"
    assert saved["junction_target_key"] == "course_id"

    engine.register_object_type(
        ObjectType(name="Shopper", primary_key="shopper_id", backed_by_table="shoppers")
    )
    engine.register_object_type(
        ObjectType(name="Purchase", primary_key="purchase_id", backed_by_table="purchases")
    )
    engine.register_object_type(
        ObjectType(name="Item", primary_key="item_id", backed_by_table="items")
    )
    engine.register_link_type(
        LinkType(
            name="shopper_purchases",
            source_object_type="Shopper",
            target_object_type="Purchase",
            cardinality="ONE_TO_MANY",
            source_join_key="shopper_id",
            target_join_key="shopper_id",
        )
    )
    engine.register_link_type(
        LinkType(
            name="purchase_items",
            source_object_type="Purchase",
            target_object_type="Item",
            cardinality="ONE_TO_MANY",
            source_join_key="purchase_id",
            target_join_key="purchase_id",
        )
    )
    items = engine.traverse_links(
        con,
        "Shopper",
        "S1",
        "shopper_purchases",
        link_path=["shopper_purchases", "purchase_items"],
    )
    assert items["hops"] == 2
    assert items["hop_counts"] == [2, 2]
    assert items["path"] == ["Shopper", "Purchase", "Item"]
    assert sorted(row["item_id"] for row in items["linked_instances"]) == ["I1", "I2"]

    engine.register_object_type(
        ObjectType(name="WbCustomer", primary_key="customer_id", backed_by_table="wb_customers")
    )
    engine.register_action_type(
        ActionType(
            name="NoteBalanceBesideSource",
            target_object_type="WbCustomer",
            parameters=[ActionParameter(name="value", data_type="string", required=True)],
            handler_type="SQL_MUTATION",
            handler_config={
                "writeback_table": "wb_edits",
                "set_column": "balance",
                "value_param": "value",
            },
        )
    )
    audit = engine.execute_action(con, "NoteBalanceBesideSource", "C01", {"value": "5"})
    assert audit["status"] == "SUCCESS"
    balance = con.execute("SELECT balance FROM wb_customers WHERE customer_id = 'C01'").fetchone()[
        0
    ]
    assert balance == 1000
    stored = con.execute("SELECT new_value FROM wb_edits").fetchone()[0]
    assert stored == "5"
    assert audit["execution_result"]["statement_hash"]
    assert audit["execution_result"]["before"]["balance"] == 1000
    assert audit["execution_result"]["after"]["new_value"] == "5"

    engine.register_object_type(
        ObjectType(name="DryPerson", primary_key="id", backed_by_table="dry_people")
    )
    engine.register_action_type(
        ActionType(
            name="UpgradeDryRunTier",
            target_object_type="DryPerson",
            parameters=[ActionParameter(name="new_tier", data_type="string", required=True)],
            handler_type="SQL_MUTATION",
            handler_config={
                "sql_template": "UPDATE dry_people SET tier = '{new_tier}' WHERE id = '{instance_id}'"
            },
        )
    )
    preview = json.loads(
        ontology_execute_action(SID, "UpgradeDryRunTier", "P1", {"new_tier": "GOLD"})
    )
    assert preview["action_audit"]["status"] == "SIMULATED"
    assert con.execute("SELECT tier FROM dry_people WHERE id = 'P1'").fetchone()[0] == "STANDARD"
    applied = json.loads(
        ontology_execute_action(SID, "UpgradeDryRunTier", "P1", {"new_tier": "GOLD"}, dry_run=False)
    )
    assert applied["action_audit"]["status"] == "SUCCESS"
    assert con.execute("SELECT tier FROM dry_people WHERE id = 'P1'").fetchone()[0] == "GOLD"
    applied_result = applied["action_audit"]["execution_result"]
    assert applied_result["before"]["tier"] == "STANDARD"
    assert applied_result["after"]["tier"] == "GOLD"
    assert len(applied_result["statement_hash"]) == 64

    engine.register_action_type(
        ActionType(
            name="NoDestSync",
            target_object_type="DryPerson",
            handler_type="REVERSE_ETL_SYNC",
            handler_config={},
        )
    )
    refused = engine.execute_action(con, "NoDestSync", "P1", {})
    # B security: ontology REVERSE_ETL_SYNC is intentionally NOT_IMPLEMENTED.
    assert refused["status"] == "FAILED"
    assert refused["execution_result"]["status"] == "NOT_IMPLEMENTED"


def test_remaining_operators_carry_evidence(con):
    paired = run_spss_hypothesis_test(SID, "upgrade_pairs", "paired_t_test", "before_v", "after_v")
    outliers = detect_outliers(SID, "upgrade_spike", "sales", method="z_score", top_k=1)
    fitted = run_spss_regression(SID, "upgrade_reg", "y", ["x"])
    forecast = run_timeseries_forecast(SID, "upgrade_forecast", "day", "sales", horizon=6)
    for payload in (paired, outliers, fitted, forecast):
        env = payload["evidence"]
        assert env["operator"]
        assert "duration_ms" in env
        assert isinstance(env["caveats"], list)
    assert outliers["evidence"]["rows_scanned"] == 103
    assert fitted["evidence"]["nulls_dropped"] == 1
    assert forecast["calendar"]["status"] == "not_a_date"
    assert "full series" in forecast["holdout"]["caveat"]


def test_simpson_caveat_when_group_sign_flips(con):
    con.execute("""
    CREATE OR REPLACE TABLE simpson_demo (grp VARCHAR, x DOUBLE, y DOUBLE);
    INSERT INTO simpson_demo VALUES
    ('A', 1, 5), ('A', 2, 4), ('A', 3, 3),
    ('B', 6, 10), ('B', 7, 9), ('B', 8, 8);
    """)
    corr = run_correlation_analysis(SID, "simpson_demo", columns=["x", "y"], group_col="grp")
    assert any(note.startswith("Simpson:") for note in corr["evidence"]["caveats"])


def test_ratio_metric_divides_aggregates_and_versions(con):
    con.execute("CREATE OR REPLACE TABLE ratio_src (sales DOUBLE, cost DOUBLE)")
    con.execute("INSERT INTO ratio_src VALUES (10, 2), (10, 8)")
    store = get_semantic_store(SID)
    store.register_metric(
        MetricDefinition(
            name="ratio_sales", table_name="ratio_src", formula="SUM(sales)", aggregation_type="SUM"
        )
    )
    store.register_metric(
        MetricDefinition(
            name="ratio_cost", table_name="ratio_src", formula="SUM(cost)", aggregation_type="SUM"
        )
    )
    store.register_metric(
        MetricDefinition(
            name="ratio_margin",
            table_name="ratio_src",
            formula="RATIO",
            aggregation_type="RATIO",
            numerator_metric="ratio_sales",
            denominator_metric="ratio_cost",
        )
    )
    sql = store.compile_governed(["ratio_margin"], [])
    assert "SUM(sales)" in sql and "SUM(cost)" in sql
    assert "AVG" not in sql.upper()
    value = con.execute(sql).fetchone()[0]
    assert abs(value - 2.0) < 1e-9
    assert store.metric_version("ratio_margin") == store.metric_version("ratio_margin")
    assert len(store.metric_version("ratio_margin")) == 16


def test_empty_depends_on_is_filled_from_sql(con):
    pipe = get_pipeline_engine(SID)
    pipe.register_model(
        DAGModel(name="auto_src", sql="SELECT * FROM src_inc", materialization="view")
    )
    pipe.register_model(
        DAGModel(
            name="keep_src",
            sql="SELECT * FROM src_inc",
            depends_on=["explicit_only"],
            materialization="view",
        )
    )
    auto = next(model for model in pipe.list_models() if model.name == "auto_src")
    kept = next(model for model in pipe.list_models() if model.name == "keep_src")
    assert auto.depends_on == ["src_inc"]
    assert kept.depends_on == ["explicit_only"]


def test_regression_asks_to_aggregate_before_a_wide_fit(con):
    with pytest.raises(ValueError, match="请先聚合再回归"):
        run_spss_regression(SID, "upgrade_reg", "y", [f"x{i}" for i in range(41)])


def test_large_table_distinct_is_approximate(con):
    from data_analysis.distributed_ops.dist_eda import DistributedEDA

    con.execute(
        "CREATE OR REPLACE TABLE wide_card AS "
        "SELECT i AS id, i % 7 AS bucket, i * 1.0 AS amount FROM range(100001) t(i)"
    )
    report = DistributedEDA.profile_table(con, "wide_card")
    assert report["columns"]["id"]["distinct_count_method"] == "approx_count_distinct"
    assert report["columns"]["id"]["distinct_count"] > 0
    assert report["columns"]["amount"]["quantile_method"] == "approx_quantile"
    assert any("approx_quantile" in item for item in report["evidence"]["caveats"])


def test_forecast_counts_a_missing_month(con):
    con.execute("CREATE OR REPLACE TABLE gap_months (ym VARCHAR, sales DOUBLE)")
    rows = []
    for i in range(24):
        year = 2023 + (i // 12)
        month = i % 12 + 1
        if year == 2023 and month == 6:
            continue
        rows.append(f"('{year}-{month:02d}', {10 + i})")
    con.execute("INSERT INTO gap_months VALUES " + ", ".join(rows))
    res = run_timeseries_forecast(SID, "gap_months", "ym", "sales", horizon=3, model_type="arima")
    assert res["calendar"]["missing_periods"] == 1
    assert res["calendar"]["seasonal_period"] == 12
    assert res["holdout"]["status"] == "ok"
    assert res["holdout"]["seasonal_naive_mape"] is not None
    assert len(res["forecasts"]) == 3


def test_erp_seed_revenue_locks(con):
    from data_analysis.examples.o2c import FACT, build_fact, generate_frames, register_frames

    register_frames(con, generate_frames(42))
    build_fact(con)
    store = get_semantic_store(SID)
    store.register_metric(
        MetricDefinition(
            name="erp_sales_amount",
            table_name=FACT,
            formula="SUM(sales)",
            aggregation_type="SUM",
            dimensions=["region"],
        )
    )
    sql = store.compile_query(["erp_sales_amount"], [])
    value = con.execute(sql).fetchone()[0]
    assert abs(float(value) - 4616575.71) < 0.02
    assert store.metric_version("erp_sales_amount")


def test_sun_shapley_averages_factor_orders_and_sum_dimensions(con):
    ratio = DistributedDriverAnalysis.analyze_driver(
        con,
        "upgrade_price",
        "price",
        ["region"],
        "month = 1",
        "month = 2",
        rate_col="price",
        volume_col="qty",
    )
    branch = ratio["hierarchy"][0]["branches"][0]
    assert branch["volume_effect"] == 10.0
    assert branch["rate_effect"] == 4.0
    assert branch["interaction_effect"] == 2.0
    assert branch["shapley_volume_effect"] == 11.0
    assert branch["shapley_rate_effect"] == 5.0
    assert (
        abs(branch["shapley_volume_effect"] + branch["shapley_rate_effect"] - branch["diff_value"])
        < 0.05
    )
    assert ratio["orderings_used"] == 1
    assert ratio["sun_shapley"]["orderings_used"] == 2
    assert ratio["sun_shapley"]["closes"] is True
    assert ratio["method"] == "laspeyres_rate_volume"

    summed = DistributedDriverAnalysis.analyze_driver(
        con, "upgrade_sales", "profit", ["region", "category"], "month = 1", "month = 2", top_k=3
    )
    assert summed["hierarchy"][0]["dimension_level"] == "region"
    assert summed["hierarchy"][1]["top_negative_drivers"][0]["dimension_value"] == "East / Digital"
    shapley = summed["sun_shapley"]
    assert shapley["orderings_used"] == 2
    assert shapley["order_invariant"] is True
    region = next(item for item in shapley["dimensions"] if item["dimension"] == "region")
    east = next(item for item in region["branches"] if item["dimension_value"] == "East")
    assert east["diff_value"] == -2500.0

    from data_analysis.mcp_server import driver_attribution_analysis

    tool_payload = json.loads(
        driver_attribution_analysis(
            SID,
            "upgrade_price",
            "price",
            ["region"],
            "month = 1",
            "month = 2",
            rate_col="price",
            volume_col="qty",
        )
    )
    assert tool_payload["method"] == "laspeyres_rate_volume"
    assert tool_payload["orderings_used"] == 1
    assert tool_payload["sun_shapley"]["orderings_used"] == 2
    assert tool_payload["sun_shapley"]["closes"] is True
    assert tool_payload["driver_hierarchy"][0]["branches"][0]["volume_effect"] == 10.0

    deeper = DistributedDriverAnalysis.analyze_driver(
        con,
        "upgrade_price",
        "price",
        ["region", "month"],
        "month = 1",
        "month = 2",
        rate_col="price",
        volume_col="qty",
    )
    assert len(deeper["hierarchy"]) == 1
    assert deeper["hierarchy"][0]["dimension_level"] == "region"
    assert any("first dimension" in item for item in deeper["evidence"]["caveats"])


def test_partition_merge_matches_one_duckdb_scan(con, monkeypatch):
    from data_analysis.distributed_ops.ray_exec import pearson_partition

    def local_only(tasks):
        return [pearson_partition(task) for task in tasks], "local"

    monkeypatch.setattr("data_analysis.distributed_ops.ray_exec.run_partition_tasks", local_only)
    monkeypatch.setattr(settings, "RAY_ENABLED", False)
    single = run_correlation_analysis(SID, "upgrade_corr", columns=["x", "y"])
    monkeypatch.setattr(settings, "RAY_ENABLED", True)
    monkeypatch.setattr(settings, "RAY_MIN_ROWS", 1)
    monkeypatch.setattr(settings, "RAY_PARTITIONS", 3)
    parted = run_correlation_analysis(SID, "upgrade_corr", columns=["x", "y"])
    note = next(item for item in parted["evidence"]["caveats"] if "partitions" in item)
    assert "backend=" in note
    assert parted["sample_size"] == single["sample_size"]
    for left, right in zip(single["matrix"], parted["matrix"], strict=False):
        for cell, other in zip(left, right, strict=False):
            assert abs(cell["r"] - other["r"]) < 1e-4


def test_parquet_hash_slices_add_up_to_one_scan(tmp_path):
    from data_analysis.distributed_ops.ray_exec import merge_sum_rows, pearson_partition

    path = tmp_path / "cols.parquet"
    scan = duckdb.connect()
    scan.execute(
        f"COPY (SELECT i AS x, i * 2.0 AS y FROM range(40) t(i)) TO '{path.as_posix()}' (FORMAT PARQUET)"
    )
    tasks = [
        {"parquet": str(path), "part": index, "parts": 4, "columns": ["x", "y"]}
        for index in range(4)
    ]
    merged = merge_sum_rows([pearson_partition(task) for task in tasks])
    direct = scan.execute(
        "SELECT COUNT(*), SUM(x), SUM(y), SUM(x * y) FROM read_parquet(?)", [str(path)]
    ).fetchone()
    assert int(merged["__n"]) == int(direct[0])
    assert abs(merged["__s0"] - float(direct[1])) < 1e-6
    assert abs(merged["__s1"] - float(direct[2])) < 1e-6
    assert abs(merged["__sp0_1"] - float(direct[3])) < 1e-6
    scan.close()


def test_llm_rank_reorders_ids_and_falls_back(monkeypatch):
    from data_analysis.copilot.llm_ranker import rank_insights

    insights = [
        {
            "id": "i0",
            "type": "anomaly",
            "title": "wide",
            "severity": 0.9,
            "statement": "a",
            "subject": {"columns": ["x"]},
            "evidence": {"operator": "outliers", "rows_used": 10, "caveats": []},
        },
        {
            "id": "i1",
            "type": "correlation",
            "title": "tight",
            "severity": 0.2,
            "statement": "b",
            "subject": {"columns": ["y"]},
            "evidence": {
                "operator": "correlation_analysis",
                "method": "pearson",
                "rows_used": 10,
                "caveats": ["Pearson r is a linear association."],
            },
        },
    ]
    monkeypatch.setattr(settings, "LLM_BASE_URL", "")
    ranked, meta = rank_insights(insights)
    assert meta["ranking_method"] == "severity"
    assert [item["id"] for item in ranked] == ["i0", "i1"]

    def transport(brief):
        dumped = json.dumps(brief)
        assert "statement" not in dumped
        assert "9999" not in dumped
        return ["i1", "i0"]

    monkeypatch.setattr(settings, "LLM_BASE_URL", "http://127.0.0.1:9")
    ranked, meta = rank_insights(insights, transport=transport)
    assert meta["ranking_method"] == "llm"
    assert [item["id"] for item in ranked] == ["i1", "i0"]

    def boom(_brief):
        raise TimeoutError("slow")

    ranked, meta = rank_insights(insights, transport=boom)
    assert meta["ranking_method"] == "severity"
    assert ranked[0]["id"] == "i0"
    assert "TimeoutError" in meta["caveat"]
