import pytest
from fastapi.testclient import TestClient

from data_analysis.catalog.lineage_tracker import get_lineage_tracker
from data_analysis.catalog.meta_registry import ColumnMeta, TableAsset, get_meta_registry
from data_analysis.catalog.semantic_store import MetricDefinition, get_semantic_store
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.main import app
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.observability.schema_drift import SchemaDrifter
from data_analysis.retl.audience_exporter import AudienceExporter
from data_analysis.retl.destination_sync import DestinationSync
from data_analysis.retl.webhook_pusher import WebhookPusher
from data_analysis.transform.data_cleaner import DataCleaner
from data_analysis.transform.pipeline_dag import DAGModel, get_pipeline_engine

client = TestClient(app)


@pytest.fixture
def mds_session():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("mds_test_session")
    con = sess.get_duckdb_conn()
    con.execute("""
    CREATE TABLE IF NOT EXISTS raw_orders (
        order_id INTEGER,
        customer_id VARCHAR,
        region VARCHAR,
        sales DOUBLE,
        profit DOUBLE,
        created_date DATE
    );
    DELETE FROM raw_orders;
    INSERT INTO raw_orders VALUES 
    (1, 'C01', 'East', 100.0, 20.0, '2026-01-01'),
    (2, 'C02', 'East', 200.0, 50.0, '2026-01-02'),
    (2, 'C02', 'East', 200.0, 50.0, '2026-01-02'), -- Duplicate row
    (3, 'C03', 'West', 300.0, NULL, '2026-01-03'), -- Null profit
    (4, 'C04', 'West', 9999.0, 10.0, '2026-01-04'); -- Outlier sales
    """)
    return con


def test_data_catalog_and_lineage():
    cat = get_meta_registry()
    asset = TableAsset(
        dataset_name="raw_orders",
        display_name="原始订单表",
        description="Core orders table",
        row_count=5,
        column_count=6,
        columns=[
            ColumnMeta(name="order_id", data_type="INTEGER", semantic_type="IDENTIFIER"),
            ColumnMeta(name="sales", data_type="DOUBLE", semantic_type="MEASURE"),
        ],
        tags=["core", "sales"],
    )
    cat.register_table(asset)
    fetched = cat.get_table("raw_orders")
    assert fetched is not None
    assert fetched.display_name == "原始订单表"

    # Lineage
    lineage = get_lineage_tracker()
    lineage.parse_and_record_sql_lineage(
        "fct_orders",
        "SELECT * FROM raw_orders JOIN dim_customer ON raw_orders.customer_id = dim_customer.id",
    )
    graph = lineage.get_lineage_graph()
    assert len(graph["nodes"]) >= 2
    impact = lineage.get_impact_analysis("raw_orders")
    assert "fct_orders" in impact["affected_tables"]


def test_semantic_metric_store(mds_session):
    store = get_semantic_store()
    store.register_metric(
        MetricDefinition(
            name="total_revenue",
            table_name="raw_orders",
            formula="SUM(sales)",
            aggregation_type="SUM",
        )
    )
    store.register_metric(
        MetricDefinition(
            name="avg_sales", table_name="raw_orders", formula="AVG(sales)", aggregation_type="AVG"
        )
    )

    sql = store.compile_query(
        metric_names=["total_revenue", "avg_sales"], dimensions=["region"], filters="sales > 50"
    )
    assert "SUM(sales)" in sql
    assert "GROUP BY 1" in sql

    df = mds_session.execute(sql).df()
    assert len(df) > 0


def test_data_cleaner(mds_session):
    res = DataCleaner.clean_table(
        con=mds_session,
        source_table="raw_orders",
        target_table="cleaned_orders",
        dedup_keys=["order_id"],
        fillna_rules={"profit": "MEAN"},
        outlier_clip_cols={"sales": {"max": 1000.0}},
    )
    assert res["cleaned_rows"] == 4  # Removed 1 duplicate
    assert res["removed_duplicates"] == 1

    # Verify no nulls in profit and sales is clipped
    null_p = mds_session.execute(
        "SELECT count(*) FROM cleaned_orders WHERE profit IS NULL"
    ).fetchone()[0]
    assert null_p == 0
    max_s = mds_session.execute("SELECT max(sales) FROM cleaned_orders").fetchone()[0]
    assert max_s <= 1000.0


def test_pipeline_dag(mds_session):
    pipe = get_pipeline_engine()
    pipe.register_model(
        DAGModel(
            name="stg_orders",
            sql="SELECT order_id, customer_id, region, sales FROM raw_orders WHERE sales < 5000",
            materialization="table",
            depends_on=["raw_orders"],
        )
    )
    pipe.register_model(
        DAGModel(
            name="marts_region_sales",
            sql="SELECT region, sum(sales) as region_sales FROM stg_orders GROUP BY region",
            materialization="table",
            depends_on=["stg_orders"],
        )
    )

    order = pipe.get_execution_order()
    assert order.index("stg_orders") < order.index("marts_region_sales")

    exec_res = pipe.run_pipeline(mds_session, models=["stg_orders", "marts_region_sales"])
    assert exec_res["total_models"] >= 2
    row_cnt = mds_session.execute("SELECT count(*) FROM marts_region_sales").fetchone()[0]
    assert row_cnt > 0


def test_reverse_etl_and_audience(mds_session):
    # Destination Sync to SQLite
    sync_res = DestinationSync.sync_table_to_destination(
        con=mds_session,
        source_table="raw_orders",
        dest_conn_str="sqlite:///data/test_reverse_sync.db",
        dest_table_name="orders_sink",
        mode="replace",
    )
    assert sync_res["status"] == "SUCCESS"
    assert sync_res["synced_rows"] == 5

    # Audience Export
    aud = AudienceExporter.export_cohort(
        con=mds_session,
        source_table="raw_orders",
        filter_sql="region = 'East'",
        export_columns=["customer_id", "sales"],
        format_type="json",
    )
    assert aud["total_audience_count"] == 3

    # Webhook Alert
    hook = WebhookPusher.send_alert(
        webhook_url="http://127.0.0.1:8000/mock_webhook",
        title="Test Alert",
        message="Test alert message",
        platform="feishu",
        extra_metrics={"Anomaly": "Spike"},
    )
    # Loopback is refused before any network I/O (SSRF guard, see test_reach_guards.py).
    assert hook["status"] == "FAILED" and hook["rejected"] is True and hook["attempts"] == 0


def test_data_quality_and_schema_drift(mds_session):
    # Quality Assertions
    res = DataQualityAssertions.run_suite(
        con=mds_session,
        table="raw_orders",
        rules=[
            {"type": "not_null", "column": "order_id"},
            {"type": "between", "column": "sales", "min_val": 0, "max_val": 20000},
            {"type": "row_count", "min_rows": 1, "max_rows": 100},
        ],
    )
    assert res["all_passed"] is True
    assert res["data_health_score"] == 100.0

    # Schema Drift
    drift = SchemaDrifter.detect_drift(
        con=mds_session,
        table="raw_orders",
        baseline_schema={"order_id": "INTEGER", "sales": "DOUBLE", "old_col": "VARCHAR"},
    )
    assert drift["has_drift"] is True
    assert len(drift["removed_columns"]) == 1  # old_col removed
