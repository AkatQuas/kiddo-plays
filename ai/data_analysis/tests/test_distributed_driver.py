from data_analysis.cluster.session_manager import SessionManager
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.nlg.narrative_builder import NarrativeBuilder


def test_driver_attribution():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_driver_sess")
    con = sess.get_duckdb_conn()

    con.execute("""
    CREATE TABLE monthly_sales (
        month INT,
        region VARCHAR,
        category VARCHAR,
        profit DOUBLE
    );
    INSERT INTO monthly_sales VALUES
    (1, 'East', 'Digital', 5000),
    (1, 'East', 'Food', 2000),
    (1, 'North', 'Digital', 3000),
    (2, 'East', 'Digital', 2000),
    (2, 'East', 'Food', 2500),
    (2, 'North', 'Digital', 3200);
    """)

    res = DistributedDriverAnalysis.analyze_driver(
        con=con,
        table_name="monthly_sales",
        target_metric="profit",
        dimension_path=["region", "category"],
        base_filter="month = 1",
        current_filter="month = 2",
        top_k=3,
    )

    assert res["base_total"] == 10000.0
    assert res["current_total"] == 7700.0
    assert res["diff_total"] == -2300.0

    l1 = res["hierarchy"][0]
    assert l1["dimension_level"] == "region"
    assert l1["top_negative_drivers"][0]["dimension_value"] == "East"

    narrative = NarrativeBuilder.generate_driver_narrative(res)
    assert "异动归因分析" in narrative
    assert "下滑" in narrative
