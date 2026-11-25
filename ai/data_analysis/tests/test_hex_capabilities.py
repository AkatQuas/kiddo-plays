"""End-to-end tests for P0-P3 Hex-inspired capabilities:
- P0: Context Studio (4-layer hierarchy, Workspace Rules, Guides, Endorsements, Endorsed Mode guardrails)
- P1: Analysis Trail Ledger & Parameterizable Playbooks (export & replay with overrides)
- P2: dbt Semantic Layer (MetricFlow) YAML import/export + DuckDB/JSON connector support
- P3: Context Observability & Health Auditor (audit_agent_context_health)
"""

import json

import duckdb
import pyarrow as pa
import pytest
from fastapi.testclient import TestClient

import data_analysis.mcp_server as mcp_mod
from data_analysis.catalog.context_studio import ContextGuide, get_context_studio
from data_analysis.catalog.meta_registry import TableAsset, get_meta_registry
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.connectors import duckdb_scanner as scanner
from data_analysis.connectors.factory import ConnectorFactory
from data_analysis.copilot.analysis_trail import get_trail_ledger
from data_analysis.main import app
from data_analysis.operators.sandbox import run_duckdb_sql


@pytest.fixture
def client():
    key = settings.api_key_list[0] if settings.api_key_list else "test-api-key"
    return TestClient(app, headers={"X-API-Key": key})


def _seed_sales_session(session_id: str) -> str:
    mgr = SessionManager()
    sess = mgr.get_or_create_session(session_id)
    tbl = pa.table(
        {
            "order_id": ["O1", "O2", "O3", "O4"],
            "order_date": ["2025-01-10", "2025-01-15", "2025-02-10", "2025-02-18"],
            "region": ["East", "West", "East", "West"],
            "sales": [100.0, 200.0, 150.0, 250.0],
            "profit": [20.0, 50.0, 35.0, 45.0],
        }
    )
    sess.register_dataset("orders", tbl)
    get_meta_registry(session_id).register_table(
        TableAsset(
            dataset_name="orders",
            display_name="Orders Fact",
            row_count=4,
            column_count=5,
            endorsement_status="draft",
        )
    )
    return session_id


def test_p0_context_studio_hierarchy_and_endorsed_guardrails(client):
    sid = _seed_sales_session("sess_p0_ctx")
    studio = get_context_studio(sid)

    # 1. Configure Workspace Rules & Business Guide
    studio.set_workspace_rules(
        system_rules="Always report monetary amounts in USD; exclude draft tables in executive reports.",
        endorsed_only_default=False,
        naming_conventions={"metric_prefix": "kpi_"},
    )
    studio.register_guide(
        ContextGuide(
            name="discount_accounting_sop",
            title="Discount & Profit Accounting SOP",
            content="Gross profit is sales minus COGS. Discounts are fractions in [0, 1].",
            scope="table",
            target_names=["orders"],
            tags=["finance", "sop"],
            endorsement_status="endorsed",
        )
    )

    # 2. Querying draft table in non-strict mode returns endorsement_warnings
    res_draft = run_duckdb_sql(sid, "SELECT SUM(sales) AS s FROM orders", endorsed_only=False)
    assert res_draft["data"][0]["s"] == 700.0
    assert any("not endorsed" in w for w in res_draft.get("endorsement_warnings", []))

    # 3. Querying draft table with endorsed_only=True is blocked
    with pytest.raises(PermissionError, match="Endorsed mode requires 'endorsed' tables"):
        run_duckdb_sql(sid, "SELECT SUM(sales) AS s FROM orders", endorsed_only=True)

    # 4. Endorse table via REST API and verify endorsed_only=True succeeds
    resp_endorse = client.post(
        "/api/v1/context/endorse",
        json={
            "session_id": sid,
            "asset_type": "table",
            "name": "orders",
            "status": "endorsed",
            "endorsement_note": "Verified by Data Governance team",
            "endorsed_by": "alice",
        },
    )
    assert resp_endorse.status_code == 200
    assert resp_endorse.json()["status"] == "endorsed"

    res_endorsed = run_duckdb_sql(sid, "SELECT SUM(sales) AS s FROM orders", endorsed_only=True)
    assert res_endorsed["data"][0]["s"] == 700.0
    assert "endorsement_warnings" not in res_endorsed

    # 5. Resolve 4-layer hierarchy via REST & MCP
    resp_resolve = client.post(
        "/api/v1/context/resolve",
        json={
            "session_id": sid,
            "dataset_name": "orders",
            "endorsed_only": True,
        },
    )
    assert resp_resolve.status_code == 200
    body = resp_resolve.json()
    assert body["endorsed_mode"] is True
    h = body["hierarchy"]
    assert "USD" in h["1_workspace_context"]["system_rules"]
    assert len(h["2_guides"]) == 1
    assert h["2_guides"][0]["name"] == "discount_accounting_sop"
    assert h["4_endorsements"]["endorsed_table_count"] == 1


def test_p2_dbt_semantic_yaml_import_export_and_endorsed_compile(client):
    sid = _seed_sales_session("sess_p2_dbt")
    get_context_studio(sid).endorse_asset("table", "orders", status="endorsed")

    dbt_yaml = """
semantic_models:
  - name: orders_semantic
    model: ref('orders')
    description: Core orders semantic model
    defaults:
      agg_time_dimension: order_date
    entities:
      - name: order
        type: primary
        expr: order_id
    dimensions:
      - name: region
        type: categorical
      - name: order_date
        type: time
    measures:
      - name: total_sales
        agg: sum
        expr: sales
        create_metric: true
      - name: total_profit
        agg: sum
        expr: profit
        create_metric: true
      - name: distinct_orders
        agg: count_distinct
        expr: order_id

metrics:
  - name: profit_margin
    label: Profit Margin
    type: ratio
    type_params:
      numerator: total_profit
      denominator: total_sales
  - name: net_contribution
    type: derived
    type_params:
      expr: total_sales - total_profit
      metrics:
        - name: total_sales
        - name: total_profit
  - name: cumulative_sales
    type: cumulative
    type_params:
      measure: total_sales
"""
    resp = client.post(
        "/api/v1/catalog/semantic/import_yaml",
        json={
            "session_id": sid,
            "yaml_content": dbt_yaml,
            "default_endorsement_status": "endorsed",
        },
    )
    assert resp.status_code == 200
    imported = resp.json()
    assert imported["models_imported"] == 1
    assert imported["metrics_imported"] >= 5

    # Query governed ratio & simple metrics by dimension
    q_resp = client.post(
        "/api/v1/catalog/metrics/query",
        json={
            "session_id": sid,
            "metric_names": ["total_sales", "total_profit", "profit_margin"],
            "dimensions": ["region"],
            "endorsed_only": True,
        },
    )
    assert q_resp.status_code == 200
    q_data = q_resp.json()
    assert q_data["governed"] is True
    by_region = {r["region"]: r for r in q_data["data"]}
    assert by_region["East"]["total_sales"] == 250.0
    assert by_region["East"]["total_profit"] == 55.0
    assert abs(by_region["East"]["profit_margin"] - (55.0 / 250.0)) < 1e-6

    # Export back to YAML
    exp_resp = client.get("/api/v1/catalog/semantic/export_yaml", params={"session_id": sid})
    assert exp_resp.status_code == 200
    yaml_out = exp_resp.json()["yaml_content"]
    assert "orders_semantic" in yaml_out
    assert "profit_margin" in yaml_out


def test_p2_duckdb_and_json_connectors(tmp_path):
    # 1. Local .duckdb database file via duckdb:// URI and scanner
    db_file = tmp_path / "warehouse.duckdb"
    con = duckdb.connect(str(db_file))
    con.execute("CREATE TABLE items (sku VARCHAR, price DOUBLE)")
    con.execute("INSERT INTO items VALUES ('A', 12.5), ('B', 30.0)")
    con.close()

    conn = ConnectorFactory.get_connector(f"duckdb:///{db_file}")
    assert conn.test_connection() is True
    assert "items" in conn.list_tables()
    schema = conn.introspect_schema("items")
    assert [c.name for c in schema.columns] == ["sku", "price"]
    tbl = conn.fetch_to_arrow("items", filter_sql="price > 20")
    assert tbl.column("sku").to_pylist() == ["B"]

    # Also verify scanner attach_clause for duckdb and motherduck
    assert (
        scanner.attach_clause("duckdb", f"duckdb:///{db_file}", alias="wh")
        == f"ATTACH '{db_file}' AS wh (READ_ONLY)"
    )
    assert (
        scanner.attach_clause("motherduck", "motherduck://my_cloud_db", alias="md_src")
        == "ATTACH 'md:my_cloud_db' AS md_src"
    )

    # 2. Local JSON / NDJSON file via file://
    ndjson_file = tmp_path / "events.ndjson"
    ndjson_file.write_text(
        '{"event": "view", "ms": 10}\n{"event": "buy", "ms": 40}\n', encoding="utf-8"
    )
    j_conn = ConnectorFactory.get_connector(f"file://{ndjson_file}")
    j_schema = j_conn.introspect_schema("events")
    assert "event" in [c.name for c in j_schema.columns]
    j_tbl = j_conn.fetch_to_arrow("events", filter_sql="ms > 20")
    assert j_tbl.column("event").to_pylist() == ["buy"]


def test_p1_analysis_trail_and_playbook_replay_with_overrides(client):
    sid = _seed_sales_session("sess_p1_trail")
    ledger = get_trail_ledger(sid)
    ledger.clear_steps()

    # Step 1: compare_metric over Jan vs Feb 2025
    cmp_resp = client.post(
        "/api/v1/tools/compare_metric",
        json={
            "session_id": sid,
            "dataset_name": "orders",
            "metric": {"kind": "sum", "column": "sales"},
            "time": {
                "column": "order_date",
                "grain": "month",
                "base_start": "2025-01-01",
                "base_end": "2025-02-01",
                "current_start": "2025-02-01",
                "current_end": "2025-03-01",
                "completeness": "warn",
            },
        },
    )
    assert cmp_resp.status_code == 200

    # Step 2: decompose_change by region
    dec_resp = client.post(
        "/api/v1/tools/decompose_change",
        json={
            "session_id": sid,
            "dataset_name": "orders",
            "metric": {"kind": "sum", "column": "sales"},
            "time": {
                "column": "order_date",
                "grain": "month",
                "base_start": "2025-01-01",
                "base_end": "2025-02-01",
                "current_start": "2025-02-01",
                "current_end": "2025-03-01",
                "completeness": "warn",
            },
            "mode": "dimension",
            "dimension": "region",
        },
    )
    assert dec_resp.status_code == 200

    # Verify trail captured the steps
    trail_resp = client.get("/api/v1/trail/steps", params={"session_id": sid})
    assert trail_resp.status_code == 200
    steps = trail_resp.json()["steps"]
    ops = [s["operator"] for s in steps if s["operator"] in ("compare_metric", "decompose_change")]
    assert ops == ["compare_metric", "decompose_change"]
    selected_ids = [
        s["step_id"] for s in steps if s["operator"] in ("compare_metric", "decompose_change")
    ]

    # Export to Playbook
    exp_resp = client.post(
        "/api/v1/trail/playbooks/export",
        json={
            "session_id": sid,
            "title": "Monthly Regional Sales Review",
            "description": "Compare and decompose sales by region",
            "step_ids": selected_ids,
            "playbook_id": "pb_monthly_sales",
        },
    )
    assert exp_resp.status_code == 200
    pb = exp_resp.json()["playbook"]
    assert pb["playbook_id"] == "pb_monthly_sales"
    assert len(pb["steps"]) == 2

    # Replay playbook with parameter override: filter to East region only and switch metric to profit!
    rep_resp = client.post(
        "/api/v1/trail/playbooks/replay",
        json={
            "playbook_id": "pb_monthly_sales",
            "parameter_overrides": {
                "metric": {"kind": "sum", "column": "profit"},
                "filters": {"region": "East"},
            },
        },
    )
    assert rep_resp.status_code == 200
    rep_body = rep_resp.json()
    assert rep_body["steps_executed"] == 2
    cmp_out = rep_body["results"][0]["output"]["result"]["comparison"]
    # East profit: Jan = 20.0, Feb = 35.0, delta = +15.0
    assert cmp_out["base_value"] == 20.0
    assert cmp_out["current_value"] == 35.0
    assert cmp_out["delta"] == 15.0


def test_p3_context_health_auditor_and_mcp_tools(client):
    sid = _seed_sales_session("sess_p3_health")
    # Execute an ungoverned SQL query on an unendorsed table without guides or metrics
    run_duckdb_sql(sid, "SELECT * FROM orders")

    resp = client.get("/api/v1/observability/context_health", params={"session_id": sid})
    assert resp.status_code == 200
    health = resp.json()
    assert health["context_health_score"] < 90.0
    codes = {w["code"] for w in health["proactive_warnings"]}
    assert "UNGOVERNED_SQL_USAGE" in codes
    assert "UNENDORSED_ASSET_QUERIED" in codes
    assert "MISSING_SEMANTIC_METRICS" in codes
    assert "EMPTY_BUSINESS_CONTEXT" in codes
    assert len(health["recommendations"]) >= 3

    # Now endorse table, add guide, add metric, and verify score improves
    mcp_mod.endorse_context_asset(
        asset_type="table", name="orders", status="endorsed", session_id=sid
    )
    mcp_mod.register_context_guide(
        name="g1", title="Orders Guide", content="Orders SOP", session_id=sid
    )
    mcp_mod.register_semantic_metric(
        session_id=sid,
        name="m_sales",
        table_name="orders",
        formula="SUM(sales)",
        endorsement_status="endorsed",
    )
    raw_mcp_health = json.loads(mcp_mod.audit_agent_context_health(session_id=sid))
    assert raw_mcp_health["context_health_score"] > health["context_health_score"]


def test_mcp_and_rest_edge_cases_for_hex_features(client):
    sid = _seed_sales_session("sess_edge_hex")

    # 1. Workspace rules via MCP & REST GET
    mcp_rule = json.loads(
        mcp_mod.set_workspace_context_rules(
            session_id=sid,
            system_rules="Strict governance mode",
            endorsed_only_default=True,
            naming_conventions={"table_prefix": "fct_"},
        )
    )
    assert mcp_rule["status"] == "success"
    get_rule_resp = client.get("/api/v1/context/rules", params={"session_id": sid})
    assert get_rule_resp.status_code == 200
    assert get_rule_resp.json()["rule"]["endorsed_only_default"] is True

    # 2. With endorsed_only_default=True, compare_metric on draft table 'orders' is blocked
    cmp_blocked = client.post(
        "/api/v1/tools/compare_metric",
        json={
            "session_id": sid,
            "dataset_name": "orders",
            "metric": {"kind": "sum", "column": "sales"},
            "time": {
                "column": "order_date",
                "grain": "month",
                "base_start": "2025-01-01",
                "base_end": "2025-02-01",
                "current_start": "2025-02-01",
                "current_end": "2025-03-01",
                "completeness": "warn",
            },
        },
    )
    assert cmp_blocked.status_code == 400
    assert "Endorsed mode requires 'endorsed' dataset" in cmp_blocked.json()["detail"]

    # 3. Disable endorsed_only_default, mark table as deprecated, verify warning in compare_metric
    mcp_mod.set_workspace_context_rules(
        session_id=sid, system_rules="", endorsed_only_default=False
    )
    mcp_mod.endorse_context_asset(
        asset_type="table",
        name="orders",
        status="deprecated",
        endorsement_note="Use fct_orders_v2",
        session_id=sid,
    )
    cmp_warn = client.post(
        "/api/v1/tools/compare_metric",
        json={
            "session_id": sid,
            "dataset_name": "orders",
            "metric": {"kind": "sum", "column": "sales"},
            "time": {
                "column": "order_date",
                "grain": "month",
                "base_start": "2025-01-01",
                "base_end": "2025-02-01",
                "current_start": "2025-02-01",
                "current_end": "2025-03-01",
                "completeness": "warn",
            },
        },
    )
    assert cmp_warn.status_code == 200
    assert any("DEPRECATED" in w for w in cmp_warn.json()["evidence"]["warnings"])

    # 4. Test MCP YAML import/export, resolve_session_context, list_analysis_trail, export & replay playbook
    mcp_mod.endorse_context_asset(
        asset_type="table", name="orders", status="endorsed", session_id=sid
    )
    yaml_res = json.loads(
        mcp_mod.import_dbt_semantic_yaml(
            yaml_content="""
semantic_models:
  - name: orders_sm
    model: ref('orders')
    entities:
      - name: order_id
        type: primary
    dimensions:
      - name: region
        type: categorical
    measures:
      - name: rev
        agg: sum
        expr: sales
        create_metric: true
""",
            session_id=sid,
            default_endorsement_status="endorsed",
        )
    )
    assert yaml_res["status"] == "success"
    assert yaml_res["metrics_imported"] == 1

    exp_yaml = json.loads(mcp_mod.export_dbt_semantic_yaml(session_id=sid))
    assert exp_yaml["status"] == "success"
    assert "orders_sm" in exp_yaml["yaml_content"]

    ctx_res = json.loads(
        mcp_mod.resolve_session_context(session_id=sid, dataset_name="orders", endorsed_only=True)
    )
    assert ctx_res["status"] == "success"
    assert ctx_res["endorsed_mode"] is True

    trail_res = json.loads(mcp_mod.list_analysis_trail(session_id=sid))
    assert trail_res["step_count"] >= 1

    pb_res = json.loads(
        mcp_mod.export_analysis_playbook(
            session_id=sid,
            title="MCP Exported Playbook",
            playbook_id="pb_mcp_test",
        )
    )
    assert pb_res["status"] == "success"

    list_pb_resp = client.get("/api/v1/trail/playbooks", params={"session_id": sid})
    assert list_pb_resp.status_code == 200
    assert any(p["playbook_id"] == "pb_mcp_test" for p in list_pb_resp.json()["playbooks"])

    rep_mcp = json.loads(
        mcp_mod.replay_analysis_playbook(
            playbook_id="pb_mcp_test",
            target_session_id=sid,
        )
    )
    assert rep_mcp["status"] == "success"
    assert rep_mcp["steps_executed"] >= 1
