import duckdb

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.operators.eda import run_eda_profile


def test_eda_profiling_and_nlg():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_eda_sess")

    con = duckdb.connect(":memory:")
    con.execute("""
    CREATE TABLE sales_data AS 
    SELECT 
        range AS order_id,
        CASE WHEN range % 3 = 0 THEN 'East' WHEN range % 3 = 1 THEN 'North' ELSE 'South' END AS region,
        CASE WHEN range % 2 = 0 THEN 'Digital' ELSE 'Food' END AS category,
        (range * 1.5 + (range % 10))::DOUBLE AS revenue,
        (range * 0.3)::DOUBLE AS profit,
        CASE WHEN range % 20 = 0 THEN NULL ELSE (range * 0.05)::DOUBLE END AS discount
    FROM range(1000);
    """)
    arrow_tbl = con.execute("SELECT * FROM sales_data").arrow()
    sess.register_dataset("sales_data", arrow_tbl)

    res = run_eda_profile("test_eda_sess", "sales_data")
    assert res["total_rows"] == 1000
    assert res["total_columns"] == 6
    assert "revenue" in res["columns"]
    assert res["columns"]["revenue"]["semantic_type"] == "MEASURE"

    narrative = NarrativeBuilder.generate_eda_narrative(res)
    assert "数据资产画像" in narrative
    assert "1,000" in narrative
