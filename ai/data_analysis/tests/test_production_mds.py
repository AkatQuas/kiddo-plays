import duckdb
import pytest

from data_analysis.catalog.lineage_tracker import LineageTracker
from data_analysis.catalog.meta_registry import MetaRegistry
from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.transform.pipeline_dag import DAGModel, PipelineDAG


@pytest.fixture
def prod_con():
    con = duckdb.connect(":memory:")
    con.execute("""
    CREATE TABLE fct_sales (
        id INTEGER,
        user_id VARCHAR,
        amount DOUBLE,
        created_at TIMESTAMP
    );
    INSERT INTO fct_sales VALUES
    (1, 'U01', 100.0, '2026-01-01 10:00:00'),
    (2, 'U02', 200.0, '2026-01-02 11:00:00'),
    (3, 'U03', 500.0, '2026-01-03 12:00:00');
    """)
    return con


def test_metadata_persistence():
    db = MetadataDB(db_path="data/test_catalog_metadata.db")
    db.save_table_asset(
        {
            "dataset_name": "persisted_orders",
            "display_name": "持久化订单表",
            "row_count": 1000,
            "column_count": 5,
            "tags": ["prod", "sales"],
        }
    )

    # Verify retrieval
    asset = db.get_table_asset("persisted_orders")
    assert asset is not None
    assert asset["display_name"] == "持久化订单表"
    assert "prod" in asset["tags"]

    # Verify reload across MetaRegistry instance
    reg = MetaRegistry.get_instance()
    reg.db = db
    tbl = reg.get_table("persisted_orders")
    assert tbl is not None
    assert tbl.row_count == 1000


def test_complex_cte_lineage():
    lineage = LineageTracker()
    sql_with_cte = """
    WITH regional_users AS (
        SELECT id, name, region FROM dim_users WHERE active = true
    ),
    order_summary AS (
        SELECT user_id, sum(amount) as total_spent FROM fct_sales GROUP BY user_id
    )
    SELECT r.name, r.region, s.total_spent
    FROM regional_users r
    JOIN order_summary s ON r.id = s.user_id
    JOIN dim_region d ON r.region = d.code
    """
    lineage.parse_and_record_sql_lineage("marts_customer_360", sql_with_cte)
    graph = lineage.get_lineage_graph()

    node_ids = {n["id"] for n in graph["nodes"]}
    # Base tables MUST be detected
    assert "dim_users" in node_ids
    assert "fct_sales" in node_ids
    assert "dim_region" in node_ids
    # CTE names MUST NOT be treated as external source tables
    assert "regional_users" not in node_ids
    assert "order_summary" not in node_ids


def test_dag_stages_and_atomic_swap(prod_con):
    dag = PipelineDAG()
    dag._models.clear()

    # Stage 0
    dag.register_model(
        DAGModel(
            name="stg_sales",
            sql="SELECT id, user_id, amount FROM fct_sales WHERE amount > 50",
            depends_on=["fct_sales"],
        )
    )
    dag.register_model(
        DAGModel(
            name="stg_users",
            sql="SELECT 'U01' as user_id, 'Alice' as name UNION ALL SELECT 'U02', 'Bob'",
            depends_on=[],
        )
    )
    # Stage 1
    dag.register_model(
        DAGModel(
            name="marts_sales_users",
            sql="SELECT s.*, u.name FROM stg_sales s LEFT JOIN stg_users u ON s.user_id = u.user_id",
            depends_on=["stg_sales", "stg_users"],
        )
    )

    stages = dag.get_execution_stages()
    assert len(stages) == 2
    # stg_sales and stg_users in Stage 0
    assert set(stages[0]) == {"stg_sales", "stg_users"}
    assert stages[1] == ["marts_sales_users"]

    # Run pipeline
    res = dag.run_pipeline(prod_con)
    assert res["total_models"] == 3
    assert res["total_stages"] == 2

    cnt = prod_con.execute("SELECT count(*) FROM marts_sales_users").fetchone()[0]
    assert cnt == 3


def test_dag_atomic_rollback_on_failure(prod_con):
    dag = PipelineDAG()
    dag._models.clear()

    # Create valid table first
    prod_con.execute("CREATE OR REPLACE TABLE important_marts AS SELECT 123 as val")

    # Register invalid model
    dag.register_model(
        DAGModel(
            name="important_marts",
            sql="SELECT * FROM non_existing_table_xyz",  # Will fail
            depends_on=[],
        )
    )

    with pytest.raises(RuntimeError) as exc_info:
        dag.run_pipeline(prod_con)

    assert "failed" in str(exc_info.value)

    # Verify original table was preserved by atomic rollback
    preserved_val = prod_con.execute("SELECT val FROM important_marts").fetchone()[0]
    assert preserved_val == 123


def test_consolidated_single_pass_quality_assertions(prod_con):
    res = DataQualityAssertions.run_suite(
        con=prod_con,
        table="fct_sales",
        rules=[
            {"type": "not_null", "column": "id"},
            {"type": "not_null", "column": "user_id"},
            {"type": "unique", "column": "id"},
            {"type": "between", "column": "amount", "min_val": 0, "max_val": 1000},
            {"type": "row_count", "min_rows": 1, "max_rows": 10000},
        ],
    )
    assert res["total_assertions"] == 5
    assert res["passed_assertions"] == 5
    assert res["all_passed"] is True
    assert res["data_health_score"] == 100.0
    assert "scan_duration_ms" in res
