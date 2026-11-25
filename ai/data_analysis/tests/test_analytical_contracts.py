"""Financial identities, calendar semantics, robust sensitivity and API parity."""

import json

import pytest
from pydantic import ValidationError

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.operators.analytical_tools import (
    analyze_sensitivity,
    compare_metric,
    decompose_change,
)
from data_analysis.schemas.requests import (
    DecompositionRequest,
    MetricCompareRequest,
    SensitivityRequest,
)
from data_analysis.schemas.responses import AnalyticalToolResponse


@pytest.fixture
def sample():
    s = SessionManager().get_or_create_session()
    c = s.get_duckdb_conn()
    c.execute("CREATE TABLE t(dt VARCHAR,g VARCHAR,id VARCHAR,n DOUBLE,d DOUBLE)")
    c.executemany(
        "INSERT INTO t VALUES (?,?,?,?,?)",
        [
            ("2024-01-01", "A", "u1", 10, 2),
            ("2024-01-02", "B", "u1", 20, 4),
            ("2024-02-01", "A", "u1", 30, 3),
            ("2024-02-02", "B", "u2", 400, 4),
        ],
    )
    yield s
    SessionManager().drop_session(s.session_id)


def args(s, **changes):
    a = dict(
        session_id=s.session_id,
        dataset_name="t",
        metric={"kind": "sum", "column": "n"},
        time={
            "column": "dt",
            "base_start": "2024-01-01",
            "base_end": "2024-02-01",
            "current_start": "2024-02-01",
            "current_end": "2024-03-01",
            "complete_until": "2024-03-01",
        },
    )
    a.update(changes)
    return a


def test_ratio_aggregates_components_not_row_ratios(sample):
    req = MetricCompareRequest(
        **args(sample, metric={"kind": "ratio", "numerator": "n", "denominator": "d"})
    )
    r = compare_metric(req)
    assert r["result"]["comparison"]["current_value"] == pytest.approx(430 / 7)
    assert r["result"]["comparison"]["base_value"] == 5
    assert not r["evidence"]["metric_semantics"]["additive_over_time"]
    AnalyticalToolResponse(**r)


def test_zero_ratio_null_and_decomposition_rejected(sample):
    sample.get_duckdb_conn().execute("UPDATE t SET d=0 WHERE dt<'2024-02-01'")
    a = args(sample, metric={"kind": "ratio", "numerator": "n", "denominator": "d"})
    r = compare_metric(MetricCompareRequest(**a))
    assert r["result"]["comparison"]["base_value"] is None
    assert r["result"]["comparison"]["delta"] is None
    assert any("undefined" in w for w in r["evidence"]["warnings"])
    with pytest.raises(ValueError, match="zero"):
        decompose_change(DecompositionRequest(**a, mode="ratio"))


def test_distinct_not_additive_across_groups(sample):
    a = args(sample, metric={"kind": "distinct_count", "column": "id"})
    r = compare_metric(MetricCompareRequest(**a))["result"]["comparison"]
    assert r["base_value"] == 1 and r["current_value"] == 2
    with pytest.raises(ValidationError):
        DecompositionRequest(**a, mode="dimension", dimension="g")


def test_closing_balance_last_per_entity_not_sum(sample):
    r = compare_metric(
        MetricCompareRequest(
            **args(sample, metric={"kind": "closing_balance", "column": "n", "entity_keys": ["id"]})
        )
    )
    assert r["result"]["comparison"]["base_value"] == 20
    assert r["result"]["comparison"]["base_rows_used"] == 1
    assert r["evidence"]["population"]["base_rows"] == 2
    assert r["result"]["comparison"]["current_value"] == 430


def test_duplicate_snapshots_rejected(sample):
    sample.get_duckdb_conn().execute("INSERT INTO t VALUES ('2024-01-02','A','u1',40,1)")
    with pytest.raises(ValueError, match="Duplicate"):
        compare_metric(
            MetricCompareRequest(
                **args(
                    sample, metric={"kind": "closing_balance", "column": "n", "entity_keys": ["id"]}
                )
            )
        )


def test_watermark_required_not_max_observation(sample):
    a = args(sample)
    del a["time"]["complete_until"]
    with pytest.raises(ValidationError, match="watermark"):
        MetricCompareRequest(**a)
    a["time"]["completeness"] = "warn"
    r = compare_metric(MetricCompareRequest(**a))
    assert any("unknown" in w for w in r["evidence"]["warnings"])


def test_partial_or_unequal_windows_explicit_opt_in(sample):
    a = args(sample)
    a["time"]["base_end"] = "2024-01-20"
    with pytest.raises(ValueError, match="align"):
        compare_metric(MetricCompareRequest(**a))
    a["time"].update(require_aligned=False, require_equal_buckets=False)
    r = compare_metric(MetricCompareRequest(**a))
    assert any("partial" in w for w in r["evidence"]["warnings"])


def test_months_with_different_days_are_equal_calendar_windows(sample):
    r = compare_metric(MetricCompareRequest(**args(sample)))
    assert r["evidence"]["time_semantics"]["base_buckets"] == 1
    assert r["evidence"]["time_semantics"]["current_buckets"] == 1


def test_end_exclusive_and_missing_buckets(sample):
    sample.get_duckdb_conn().execute("INSERT INTO t VALUES ('2024-03-01','A','u3',9999,1)")
    a = args(sample)
    a["time"]["grain"] = "day"
    a["time"]["require_equal_buckets"] = False
    r = compare_metric(MetricCompareRequest(**a))
    assert r["result"]["comparison"]["current_value"] == 430
    assert len(r["result"]["series"]) == 60
    assert r["result"]["series"][2]["value"] is None


def test_timezone_aware_timestamp_cross_day(sample):
    c = sample.get_duckdb_conn()
    c.execute("DELETE FROM t")
    c.execute(
        "INSERT INTO t VALUES ('2024-01-31T23:30:00Z','A','u',10,1),('2024-02-01T23:30:00Z','A','u',20,1)"
    )
    a = args(sample)
    a["time"].update(
        input_mode="aware_timestamp",
        timezone="Asia/Shanghai",
        grain="day",
        base_start="2024-02-01",
        base_end="2024-02-02",
        current_start="2024-02-02",
        current_end="2024-02-03",
    )
    r = compare_metric(MetricCompareRequest(**a))["result"]["comparison"]
    assert r["base_value"] == 10 and r["current_value"] == 20
    c.execute("UPDATE t SET dt=REPLACE(dt,'Z','')")
    with pytest.raises(ValueError, match="Invalid time"):
        compare_metric(MetricCompareRequest(**a))


def test_invalid_rows_reject_or_accounted_exclusion(sample):
    sample.get_duckdb_conn().execute(
        "INSERT INTO t VALUES ('bad','A','u',1,1),('2024-01-05','A','u','NaN',1)"
    )
    with pytest.raises(ValueError):
        compare_metric(MetricCompareRequest(**args(sample)))
    r = compare_metric(MetricCompareRequest(**args(sample, invalid_rows="exclude")))
    assert r["evidence"]["population"]["invalid_time_rows"] == 1
    assert r["evidence"]["population"]["invalid_metric_rows"] == 1
    assert r["result"]["comparison"]["delta"] == 400


def test_top_k_omitted_contribution_closes(sample):
    r = decompose_change(DecompositionRequest(**args(sample), dimension="g", top_k=1))
    assert r["evidence"]["truncation"] == {"truncated": True, "returned": 1, "total": 2}
    q = r["result"]["reconciliation"]
    assert q["shown_contributions"] == 380 and q["omitted_contributions"] == 20
    assert q["reconciliation_error"] == pytest.approx(0)


def test_ratio_midpoint_closes(sample):
    r = decompose_change(
        DecompositionRequest(
            **args(sample, metric={"kind": "ratio", "numerator": "n", "denominator": "d"}),
            mode="ratio",
        )
    )
    assert abs(r["result"]["effects"]["reconciliation_error"]) < 1e-10


@pytest.mark.parametrize("method", ["mad", "iqr", "zscore"])
def test_sensitivity_known_spike_and_no_mutation(sample, method):
    r = analyze_sensitivity(SensitivityRequest(**args(sample), anomaly_column="n", method=method))
    assert r["result"]["counts"]["flagged_rows"] >= 1
    assert r["result"]["original"]["current_value"] == 430
    assert r["result"]["reviewed"]["current_value"] in (30, None)
    assert sample.get_duckdb_conn().execute("SELECT COUNT(*) FROM t").fetchone()[0] == 4
    assert isinstance(r["result"]["impact"]["delta_difference"], (float, type(None)))


@pytest.mark.parametrize("method", ["mad", "zscore"])
def test_zero_dispersion_unscored_not_normal(sample, method):
    sample.get_duckdb_conn().execute("UPDATE t SET n=10 WHERE dt<'2024-02-01'")
    r = analyze_sensitivity(SensitivityRequest(**args(sample), anomaly_column="n", method=method))
    assert r["result"]["counts"]["unscored_rows"] == 4
    assert r["result"]["counts"]["flagged_rows"] == 0
    assert r["evidence"]["warnings"]


def test_entity_exclusion_includes_normal_rows(sample):
    sample.get_duckdb_conn().execute("INSERT INTO t VALUES ('2024-02-03','A','u2',10,1)")
    r = analyze_sensitivity(
        SensitivityRequest(**args(sample), anomaly_column="n", removal="entity", entity_column="id")
    )
    assert r["result"]["counts"]["flagged_rows"] == 1
    assert r["result"]["counts"]["removed_rows"] == 2
    assert r["result"]["reviewed"]["current_value"] == 30


def test_missing_reference_group_unscored(sample):
    sample.get_duckdb_conn().execute("UPDATE t SET g='new' WHERE dt>='2024-02-01'")
    r = analyze_sensitivity(SensitivityRequest(**args(sample), anomaly_column="n", group_by="g"))
    assert (
        r["result"]["counts"]["unscored_rows"] == 4
    )  # baseline groups also each have only one row
    assert r["result"]["reviewed"]["current_value"] == 430


def test_filters_escaped_and_session_isolation(sample):
    sample.get_duckdb_conn().execute("UPDATE t SET g='O''Brien'")
    r = compare_metric(MetricCompareRequest(**args(sample, filters={"g": "O'Brien"})))
    assert r["result"]["comparison"]["delta"] == 400
    with pytest.raises(ValueError):
        compare_metric(MetricCompareRequest(**args(sample, filters={"g": "x' OR TRUE --"})))
    other = SessionManager().get_or_create_session()
    try:
        with pytest.raises(ValueError):
            compare_metric(MetricCompareRequest(**{**args(sample), "session_id": other.session_id}))
    finally:
        SessionManager().drop_session(other.session_id)


def test_injection_names_rejected(sample):
    with pytest.raises(ValueError, match="Unknown column"):
        compare_metric(
            MetricCompareRequest(
                **args(sample, metric={"kind": "sum", "column": 'n"; DROP TABLE t; --'})
            )
        )


def test_profit_tool_shared_with_report(sample):
    from data_analysis.examples.o2c import build_fact, generate_frames, register_frames
    from data_analysis.operators.business_report import generate_business_report
    from data_analysis.schemas.requests import BusinessReportRequest

    register_frames(sample.get_duckdb_conn(), generate_frames())
    build_fact(sample.get_duckdb_conn())
    mapping = dict(
        product="product_id",
        quantity="quantity",
        price="unit_price",
        discount="discount",
        sales="sales",
        cost="cogs",
        order="order_id",
    )
    t = dict(
        column="order_date",
        base_start="2024-01-01",
        base_end="2025-01-01",
        current_start="2025-01-01",
        current_end="2026-01-01",
        complete_until="2026-01-01",
        grain="year",
    )
    r = decompose_change(
        DecompositionRequest(
            session_id=sample.session_id,
            dataset_name="o2c_sales",
            metric={"kind": "sum", "column": "profit"},
            time=t,
            mode="profit",
            mapping=mapping,
        )
    )
    report = generate_business_report(
        BusinessReportRequest(
            session_id=sample.session_id,
            dataset_name="o2c_sales",
            metric="profit",
            time_column="order_date",
            mapping=mapping,
            **{
                k: v
                for k, v in t.items()
                if k in ("base_start", "base_end", "current_start", "current_end")
            },
        )
    )
    for x, y in zip(r["result"]["profit_bridge"], report["profit_bridge"], strict=False):
        assert x["delta"] == pytest.approx(y["delta"])
        assert abs(x["reconciliation_error"]) < 1e-6
        assert x["discount_effect"] == pytest.approx(y["discount_effect"])


@pytest.mark.parametrize(
    "name,model,kwargs",
    [
        ("compare_metric", MetricCompareRequest, {}),
        ("decompose_change", DecompositionRequest, {"dimension": "g"}),
        ("analyze_sensitivity", SensitivityRequest, {"anomaly_column": "n"}),
    ],
)
def test_rest_mcp_same_contract(sample, name, model, kwargs):
    from fastapi.testclient import TestClient

    import data_analysis.mcp_server as mcp
    from data_analysis.config import settings
    from data_analysis.main import app

    old = settings.API_KEYS
    settings.API_KEYS = "test-api-key"
    try:
        req = model(**args(sample), **kwargs)
        client = TestClient(app, headers={"X-API-Key": "test-api-key"})
        http = client.post("/api/v1/tools/" + name, json=req.model_dump(mode="json"))
        assert http.status_code == 200, http.text
        response = http.json()
        body = getattr(mcp, name + "_tool")(req)
        assert response["result"] == body["result"]
        a = response["evidence"]
        b = body["evidence"]
        a.pop("duration_ms")
        b.pop("duration_ms")
        assert a == b
        assert a["schema_version"] == "2.0" and a["causal_claim"] is False
        assert len(a["query_sha256"]) == 64
        assert client.post("/api/v1/tools/" + name, json={}).status_code == 422
        assert (
            TestClient(app)
            .post("/api/v1/tools/" + name, json=req.model_dump(mode="json"))
            .status_code
            == 401
        )
    finally:
        settings.API_KEYS = old


def test_all_current_rows_removed_are_null_not_zero(sample):
    sample.get_duckdb_conn().execute("UPDATE t SET n=1000 WHERE dt>='2024-02-01'")
    r = analyze_sensitivity(SensitivityRequest(**args(sample), anomaly_column="n", limit=1))
    assert r["result"]["reviewed"]["current_value"] is None
    assert r["result"]["reviewed"]["delta"] is None
    assert r["result"]["impact"]["delta_difference"] is None
    assert r["evidence"]["truncation"]["truncated"]
    assert r["evidence"]["truncation"]["total"] == 2


def test_report_retains_old_fields_and_v2_evidence(sample):
    from data_analysis.operators.business_report import generate_business_report
    from data_analysis.schemas.requests import BusinessReportRequest
    from data_analysis.schemas.responses import ToolEvidence

    r = generate_business_report(
        BusinessReportRequest(
            session_id=sample.session_id,
            dataset_name="t",
            metric="n",
            time_column="dt",
            base_start="2024-01-01",
            base_end="2024-02-01",
            current_start="2024-02-01",
            current_end="2024-03-01",
        )
    )
    ToolEvidence(**r["evidence"])
    assert r["evidence"]["request"] and r["evidence"]["queries"]
    assert r["evidence"]["time_semantics"]["completeness"] == "unknown"


def test_real_mcp_transport_schema_and_execution(sample):
    import asyncio

    from fastmcp import Client

    from data_analysis.mcp_server import mcp

    async def check():
        async with Client(mcp) as client:
            tools = {t.name: t for t in await client.list_tools()}
            for name in ["compare_metric", "decompose_change", "analyze_sensitivity"]:
                assert "request" in tools[name].inputSchema["properties"]
            result = await client.call_tool("compare_metric", {"request": args(sample)})
            data = json.loads(result.content[0].text)
            assert data["result"]["comparison"]["delta"] == 400
            assert data["evidence"]["schema_version"] == "2.0"
            bad = args(sample)
            del bad["time"]["complete_until"]
            result = await client.call_tool(
                "compare_metric", {"request": bad}, raise_on_error=False
            )
            assert result.is_error

    asyncio.run(check())
