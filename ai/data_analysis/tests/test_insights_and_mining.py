import numpy as np

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.operators.insights.dominance import detect_dominance
from data_analysis.operators.insights.outliers import detect_outliers
from data_analysis.operators.insights.trends import detect_trends
from data_analysis.operators.mining.clustering import run_kmeans_clustering
from data_analysis.operators.mining.timeseries import run_timeseries_forecast


def test_insights_outliers_trends_dominance():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_insights_sess")
    con = sess.get_duckdb_conn()

    np.random.seed(42)
    # Generate clean trend data
    con.execute("""
    CREATE TABLE metric_data AS
    SELECT 
        range AS t_idx,
        strftime(DATE '2026-01-01' + INTERVAL (range) DAY, '%Y-%m-%d') AS date_str,
        CASE WHEN range % 5 = 0 THEN 'CatA' WHEN range % 5 = 1 THEN 'CatB' ELSE 'CatC' END AS cat,
        (range * 3.5 + 10)::DOUBLE AS sales
    FROM range(60);
    """)

    # 1. Trends
    trends = detect_trends("test_insights_sess", "metric_data", "date_str", "sales")
    assert "Upward" in trends["trend_direction"]
    assert trends["statistically_significant"] is True

    # 2. Inject spike outlier & test
    con.execute("INSERT INTO metric_data VALUES (61, '2026-03-05', 'CatA', 9999.0)")
    outliers = detect_outliers("test_insights_sess", "metric_data", "sales", method="z_score")
    assert outliers["outlier_count"] >= 1
    assert outliers["outliers"][0]["value"] == 9999.0

    # 3. Dominance
    dominance = detect_dominance("test_insights_sess", "metric_data", "cat", "sales")
    assert dominance["gini_coefficient"] >= 0.0
    assert len(dominance["top_contributors"]) > 0


def test_mining_clustering_and_forecast():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_mining_sess")
    con = sess.get_duckdb_conn()

    np.random.seed(42)
    con.execute("""
    CREATE TABLE cluster_data AS
    SELECT 
        (range % 3 * 10 + (range % 2))::DOUBLE AS f1,
        (range % 3 * 20 + (range % 5))::DOUBLE AS f2
    FROM range(60);
    """)

    # 1. KMeans with auto-k
    km_res = run_kmeans_clustering(
        "test_mining_sess", "cluster_data", ["f1", "f2"], auto_k_range=[2, 4]
    )
    assert km_res["optimal_k"] in [2, 3, 4]
    assert len(km_res["cluster_profiles"]) == km_res["optimal_k"]

    # 2. Timeseries forecast
    con.execute("""
    CREATE TABLE ts_data AS
    SELECT 
        strftime(DATE '2026-01-01' + INTERVAL (range) MONTH, '%Y-%m') AS ym,
        (100 + range * 5 + (range % 3))::DOUBLE AS val
    FROM range(24);
    """)
    fc_res = run_timeseries_forecast(
        "test_mining_sess", "ts_data", "ym", "val", horizon=6, model_type="arima"
    )
    assert len(fc_res["forecasts"]) == 6
    assert fc_res["forecasts"][0]["predicted_value"] > 0
