import pytest
from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.connectors.trace_importer import TraceImporter
from data_analysis.main import app
from data_analysis.operators.web_analytics.flow import calculate_user_flow
from data_analysis.operators.web_analytics.funnel import calculate_funnel
from data_analysis.operators.web_analytics.page_analytics import calculate_page_metrics
from data_analysis.operators.web_analytics.retention import calculate_retention
from data_analysis.operators.web_analytics.trace_replay import (
    get_session_action_replay,
    get_trace_waterfall,
)

client = TestClient(app, headers={"X-API-Key": "test-api-key"})

WA_SESSION = "wa_test_session"
WA_TABLE = "telemetry"

# Synthetic user journeys imported as a trace *data source* into an analytical
# session — the same engine the DB-connector path uses.
TRACE_RECORDS = [
    {
        "event_id": "e_u1_1",
        "trace_id": "trace_100",
        "span_id": "span_101",
        "session_id": "sess_100",
        "user_id": "user_1",
        "event_type": "pageview",
        "event_name": "$pageview",
        "page_path": "/home",
        "timestamp_ms": 1000,
    },
    {
        "event_id": "e_u1_2",
        "trace_id": "trace_100",
        "span_id": "span_102",
        "parent_span_id": "span_101",
        "session_id": "sess_100",
        "user_id": "user_1",
        "event_type": "custom",
        "event_name": "view_item",
        "page_path": "/products/1",
        "timestamp_ms": 2000,
    },
    {
        "event_id": "e_u1_3",
        "trace_id": "trace_100",
        "span_id": "span_103",
        "parent_span_id": "span_102",
        "session_id": "sess_100",
        "user_id": "user_1",
        "event_type": "custom",
        "event_name": "add_to_cart",
        "page_path": "/cart",
        "timestamp_ms": 3000,
    },
    {
        "event_id": "e_u1_4",
        "trace_id": "trace_100",
        "span_id": "span_104",
        "parent_span_id": "span_103",
        "session_id": "sess_100",
        "user_id": "user_1",
        "event_type": "custom",
        "event_name": "purchase_success",
        "page_path": "/checkout/success",
        "timestamp_ms": 4000,
    },
    {
        "event_id": "e_u2_1",
        "trace_id": "trace_200",
        "span_id": "span_201",
        "session_id": "sess_200",
        "user_id": "user_2",
        "event_type": "pageview",
        "event_name": "$pageview",
        "page_path": "/home",
        "timestamp_ms": 1000,
    },
    {
        "event_id": "e_u2_2",
        "trace_id": "trace_200",
        "span_id": "span_202",
        "session_id": "sess_200",
        "user_id": "user_2",
        "event_type": "custom",
        "event_name": "view_item",
        "page_path": "/products/2",
        "timestamp_ms": 2000,
    },
    {
        "event_id": "e_u2_3",
        "trace_id": "trace_200",
        "span_id": "span_203",
        "session_id": "sess_200",
        "user_id": "user_2",
        "event_type": "custom",
        "event_name": "add_to_cart",
        "page_path": "/cart",
        "timestamp_ms": 3000,
    },
    {
        "event_id": "e_u3_1",
        "trace_id": "trace_300",
        "span_id": "span_301",
        "session_id": "sess_300",
        "user_id": "user_3",
        "event_type": "error",
        "event_name": "$error",
        "page_path": "/cart",
        "timestamp_ms": 1000,
        "properties": {"message": "NullPointerException"},
    },
]


@pytest.fixture(autouse=True)
def setup_trace_session():
    """Load the trace dataset into an analytical session before each test."""
    arrow_tbl = TraceImporter.load_source(records=TRACE_RECORDS)
    sess = SessionManager().get_or_create_session(WA_SESSION)
    sess.register_dataset(WA_TABLE, arrow_tbl)


def test_import_traces_rest_endpoint():
    resp = client.post(
        "/api/v1/import/traces",
        json={
            "records": TRACE_RECORDS,
            "dataset_name": "rest_traces",
            "session_id": "rest_sess",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["row_count"] == len(TRACE_RECORDS)
    assert "event_name" in body["columns"]


def test_funnel_operator_on_session():
    res = calculate_funnel(WA_SESSION, WA_TABLE, ["view_item", "add_to_cart", "purchase_success"])
    assert res["initial_users"] == 2
    assert res["final_converted_users"] == 1
    assert res["overall_conversion_rate"] == 0.5
    assert len(res["steps"]) == 3


def test_funnel_rest_endpoint_on_session():
    resp = client.post(
        "/api/v1/analytics/funnel",
        json={
            "session_id": WA_SESSION,
            "dataset_name": WA_TABLE,
            "steps": ["view_item", "add_to_cart", "purchase_success"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["overall_conversion_rate"] == 0.5


def test_flow_operator_on_session():
    res = calculate_user_flow(WA_SESSION, WA_TABLE)
    assert "nodes" in res
    assert "links" in res


def test_retention_and_page_metrics_on_session():
    ret = calculate_retention(WA_SESSION, WA_TABLE, days=3)
    assert "retention_matrix" in ret

    pages = calculate_page_metrics(WA_SESSION, WA_TABLE)
    assert "summary" in pages
    assert pages["summary"]["total_events"] > 0
    assert len(pages["pages"]) > 0


def test_trace_waterfall_and_replay_on_session():
    tr = get_trace_waterfall(WA_SESSION, WA_TABLE, "trace_100")
    assert tr["total_spans"] >= 4

    rep = get_session_action_replay(WA_SESSION, WA_TABLE, "sess_100")
    assert rep["action_count"] == 4


def test_page_metrics_rest_endpoint():
    resp = client.get(f"/api/v1/analytics/pages?session_id={WA_SESSION}&dataset_name={WA_TABLE}")
    assert resp.status_code == 200
    assert resp.json()["summary"]["total_events"] > 0


def test_trace_waterfall_rest_is_json_safe():
    # Sparse trace tables have all-NULL columns (e.g. service_name); pandas turns
    # those into NaN, which must be sanitized or the JSON response 500s.
    resp = client.get(
        f"/api/v1/analytics/trace/trace_100?session_id={WA_SESSION}&dataset_name={WA_TABLE}"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_spans"] >= 4
    assert body["spans"][0]["service_name"] is None


def test_audience_export_rest_is_json_safe():
    resp = client.post(
        "/api/v1/retl/audience",
        json={
            "session_id": WA_SESSION,
            "source_table": WA_TABLE,
            "filter_sql": "event_type = 'custom'",
            "format_type": "json",
            "limit": 50,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["total_audience_count"] > 0


def test_dashboard_endpoint():
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "DATA" in resp.text
    # The pipeline stage rail is the dashboard's skeleton; a missing stage means
    # the navigation was broken. Stage labels may change; the data-stage keys are
    # the contract asserted here.
    for stage in ("ingest", "transform", "model", "analyze", "quality", "activate"):
        assert f'data-stage="{stage}"' in resp.text
