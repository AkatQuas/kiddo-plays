import inspect
import json

import duckdb
from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.connectors.trace_importer import TraceImporter
from data_analysis.main import app
from data_analysis.mcp_server import (
    detect_automated_insights,
    driver_attribution_analysis,
    import_traces,
    memory_olap_aggregation,
    variance_decomposition,
)
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.schemas.charts import ChartSpecBuilder
from data_analysis.schemas.requests import OntologyTraverseRequest

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


def test_chart_specs_match_vega_and_echarts_contracts():
    waterfall = ChartSpecBuilder.build_waterfall_chart(
        [{"category": "A", "diff": 2}, {"category": "B", "diff": -1}],
        "category",
        "diff",
    )
    assert waterfall["$schema"].endswith("vega-lite/v5.json")
    assert "" not in waterfall
    assert waterfall["encoding"]["y2"]["field"] == "end"

    forecast = ChartSpecBuilder.build_time_series_forecast_chart(
        [{"time": "2024-01", "value": 1.0}],
        [{"step": 1, "predicted_value": 2.0, "ci_95_lower": 1.0, "ci_95_upper": 3.0}],
        "t",
        "v",
    )
    assert forecast["layer"][0]["mark"]["type"] == "errorband"
    forecast_rows = [row for row in forecast["data"]["values"] if row["type"] == "Forecast"]
    assert forecast_rows[0]["lower"] == 1.0

    sankey = ChartSpecBuilder.build_sankey_chart(
        [{"name": "a"}, {"name": "b"}],
        [{"source": "a", "target": "b", "value": 1}],
    )
    assert sankey["series"][0]["type"] == "sankey"
    assert sankey["series"][0]["links"][0]["value"] == 1

    heat = ChartSpecBuilder.build_retention_heatmap(
        [
            {
                "cohort_date": "2024-01-01",
                "cohort_size": 2,
                "day_0": {"count": 2, "rate": 1},
                "day_1": {"count": 1, "rate": 0.5},
            }
        ]
    )
    assert heat["mark"] == "rect"
    assert {row["day"] for row in heat["data"]["values"]} == {0, 1}

    funnel = ChartSpecBuilder.build_funnel_chart([{"step_name": "view", "user_count": 3}])
    assert funnel["data"]["values"] == [{"step": "view", "users": 3}]


def test_narratives_follow_operator_fields():
    spss = NarrativeBuilder.generate_spss_narrative(
        {
            "test_name": "Independent Samples T-Test",
            "p_value": 0.01,
            "significant": False,
            "formal_conclusion": "effect too small",
        }
    )
    assert "fail to reject" in spss.lower() or "not significant" in spss.lower()
    assert ">= 0.05" not in spss
    assert "1.0000e-02" in spss

    logistic = NarrativeBuilder.generate_regression_narrative(
        {
            "model_type": "Binary Logistic Regression",
            "pseudo_r_squared": 0.42,
            "llr_p_value": 0.001,
            "coefficients": [{"variable": "x", "significant": True}],
        }
    )
    assert "Logistic" in logistic
    assert "0.4200" in logistic
    assert "multicollinearity" not in logistic.lower() or "VIF" not in logistic
    assert "VIF" not in logistic

    eda = NarrativeBuilder.generate_eda_narrative(
        {
            "total_rows": 10,
            "total_columns": 1,
            "quality_score": 90,
            "type_inference_sample_rows": 10,
            "columns": {
                "a": {
                    "semantic_type": "MEASURE",
                    "null_percentage": 0,
                    "distinct_count_method": "exact",
                    "quantile_method": "quantile_cont",
                }
            },
        }
    )
    assert "sample" in eda.lower() or "rows" in eda.lower()
    assert "exact" in eda
    assert "quantile_cont" in eda

    driver = NarrativeBuilder.generate_driver_narrative(
        {
            "target_metric": "profit",
            "diff_total": -1,
            "growth_rate_pct": -10,
            "method": "additive_contribution",
            "sun_shapley": None,
            "hierarchy": [{"dimension_level": "region", "closes": False}],
        }
    )
    assert "additive_contribution" in driver
    assert "sun_shapley" in driver.lower()
    assert "close" in driver.lower() or "unclosed" in driver.lower()


def test_unsupported_quality_rule_counts_as_failed():
    con = duckdb.connect()
    con.execute("CREATE TABLE proto_quality(id INTEGER)")
    con.execute("INSERT INTO proto_quality VALUES (1)")
    res = DataQualityAssertions.run_suite(
        con,
        "proto_quality",
        [{"type": "not_a_rule"}, {"type": "row_count", "min_rows": 1, "max_rows": 5}],
    )
    assert res["all_passed"] is False
    assert res["passed_assertions"] == 1
    assert res["failed_assertions"] == 1
    unsupported = [
        row for row in res["assertion_results"] if row["assertion"] == "unsupported_rule"
    ]
    assert unsupported[0]["rule_type"] == "not_a_rule"


def test_mcp_signatures_expose_landed_operator_params():
    olap = inspect.signature(memory_olap_aggregation)
    assert "cube" in olap.parameters
    assert "order_by" in olap.parameters
    insights = inspect.signature(detect_automated_insights)
    assert insights.parameters["outlier_method"].default == "z_score"
    assert "group_col" in insights.parameters
    assert "records" in inspect.signature(import_traces).parameters
    assert "link_path" in OntologyTraverseRequest.model_fields


def test_rest_attaches_chart_specs_beside_existing_fields():
    sess = SessionManager().get_or_create_session("proto_out_sess")
    arrow = TraceImporter.load_source(
        records=[
            {
                "event_id": "1",
                "session_id": "s",
                "user_id": "u",
                "event_type": "pageview",
                "event_name": "$pageview",
                "page_path": "/a",
                "timestamp_ms": 1,
            },
            {
                "event_id": "2",
                "session_id": "s",
                "user_id": "u",
                "event_type": "pageview",
                "event_name": "$pageview",
                "page_path": "/b",
                "timestamp_ms": 2,
            },
            {
                "event_id": "3",
                "session_id": "s",
                "user_id": "u",
                "event_type": "custom",
                "event_name": "view_item",
                "page_path": "/b",
                "timestamp_ms": 3,
            },
        ]
    )
    sess.register_dataset("proto_traces", arrow)

    flow = client.get(
        "/api/v1/analytics/flow",
        params={
            "session_id": "proto_out_sess",
            "dataset_name": "proto_traces",
        },
    )
    assert flow.status_code == 200
    flow_body = flow.json()
    assert "nodes" in flow_body
    assert flow_body["chart_spec"]["series"][0]["type"] == "sankey"

    funnel = client.post(
        "/api/v1/analytics/funnel",
        json={
            "session_id": "proto_out_sess",
            "dataset_name": "proto_traces",
            "steps": ["view_item"],
        },
    )
    assert funnel.status_code == 200
    funnel_body = funnel.json()
    assert funnel_body["initial_users"] == 1
    assert funnel_body["chart_spec"]["$schema"].endswith("vega-lite/v5.json")

    retention = client.get(
        "/api/v1/analytics/retention",
        params={
            "session_id": "proto_out_sess",
            "dataset_name": "proto_traces",
            "days": 1,
        },
    )
    assert retention.status_code == 200
    retention_body = retention.json()
    assert "retention_matrix" in retention_body
    assert retention_body["chart_spec"]["mark"] == "rect"

    con = sess.get_duckdb_conn()
    con.execute("CREATE TABLE proto_driver (month INT, region VARCHAR, profit DOUBLE)")
    con.execute("INSERT INTO proto_driver VALUES (1, 'East', 10), (2, 'East', 4)")
    driver = client.post(
        "/api/v1/tools/driver_analysis",
        json={
            "session_id": "proto_out_sess",
            "dataset_name": "proto_driver",
            "target_metric": "profit",
            "dimension_path": ["region"],
            "base_filter": "month = 1",
            "current_filter": "month = 2",
        },
    )
    assert driver.status_code == 200
    driver_body = driver.json()
    assert driver_body["chart_spec"]["$schema"].endswith("vega-lite/v5.json")
    assert "additive_contribution" in driver_body["summary_text"]

    con.execute("CREATE TABLE proto_ts (day VARCHAR, amount DOUBLE)")
    con.execute(
        "INSERT INTO proto_ts VALUES "
        + ", ".join(f"('2024-01-{day:02d}', {float(day)})" for day in range(1, 13))
    )
    forecast = client.post(
        "/api/v1/tools/timeseries",
        json={
            "session_id": "proto_out_sess",
            "dataset_name": "proto_ts",
            "time_col": "day",
            "value_col": "amount",
            "horizon": 2,
            "model_type": "arima",
        },
    )
    assert forecast.status_code == 200
    forecast_body = forecast.json()
    assert forecast_body["chart_spec"]["layer"][0]["mark"]["type"] == "errorband"
    assert forecast_body["statistics"]["forecasts"]


def test_insight_routes_use_analysis_response():
    sess = SessionManager().get_or_create_session("proto_insight_sess")
    con = sess.get_duckdb_conn()
    con.execute("CREATE TABLE proto_insight (month INT, region VARCHAR, sales DOUBLE)")
    con.execute("""
        INSERT INTO proto_insight VALUES
        (1, 'East', 10), (2, 'East', 12), (3, 'East', 11), (4, 'East', 13),
        (5, 'East', 14), (6, 'East', 400),
        (1, 'West', 1), (2, 'West', 1), (3, 'West', 1)
    """)
    base = {"session_id": "proto_insight_sess", "dataset_name": "proto_insight", "metric": "sales"}

    outliers = client.post(
        "/api/v1/insights/outliers", json={**base, "method": "z_score", "threshold": 2}
    )
    assert outliers.status_code == 200
    outliers_body = outliers.json()
    assert outliers_body["statistics"]["method"] == "z_score"
    assert outliers_body["statistics"]["outlier_count"] >= 1
    assert outliers_body["data_preview"]

    trends = client.post("/api/v1/insights/trends", json={**base, "time_col": "month"})
    assert trends.status_code == 200
    trends_body = trends.json()
    assert "slope" in trends_body["statistics"]
    assert trends_body["data_preview"][0]["time"]

    dominance = client.post(
        "/api/v1/insights/dominance", json={**base, "category_col": "region", "top_k": 2}
    )
    assert dominance.status_code == 200
    dominance_body = dominance.json()
    assert "gini_coefficient" in dominance_body["statistics"]
    assert dominance_body["data_preview"][0]["category"] == "East"


def test_variance_decomposition_and_driver_keep_evidence():
    sess = SessionManager().get_or_create_session("proto_var_sess")
    con = sess.get_duckdb_conn()
    con.execute("CREATE TABLE proto_var (g VARCHAR, y DOUBLE)")
    con.execute("INSERT INTO proto_var VALUES ('A',1),('A',2),('A',3),('B',5),('B',7)")

    http = client.post(
        "/api/v1/tools/variance_decomposition",
        json={
            "session_id": "proto_var_sess",
            "dataset_name": "proto_var",
            "metric": "y",
            "dimensions": ["g"],
        },
    )
    assert http.status_code == 200
    stats = http.json()["statistics"]
    assert stats["method"] == "law_of_total_variance"
    assert stats["factors"][0]["closes"] is True
    assert stats["evidence"]["operator"]

    mcp_body = json.loads(variance_decomposition("proto_var_sess", "proto_var", "y", ["g"]))
    assert mcp_body["variance_decomposition"]["n"] == stats["n"]
    assert mcp_body["variance_decomposition"]["evidence"]["operator"]

    con.execute("CREATE TABLE proto_drv (month INT, region VARCHAR, profit DOUBLE)")
    con.execute("INSERT INTO proto_drv VALUES (1, 'East', 10), (2, 'East', 4)")
    driver = json.loads(
        driver_attribution_analysis(
            "proto_var_sess",
            "proto_drv",
            "profit",
            ["region"],
            "month = 1",
            "month = 2",
        )
    )
    assert driver["evidence"]["operator"] == "driver_attribution_analysis"
    assert driver["method"] == "additive_contribution"
