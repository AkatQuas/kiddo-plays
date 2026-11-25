from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_table_ref


def run_kmeans_clustering(
    session_id: str,
    dataset_name: str,
    feature_cols: list[str],
    n_clusters: int | None = None,
    auto_k_range: list[int] | None = None,
) -> dict[str, Any]:
    if auto_k_range is None:
        auto_k_range = [2, 6]
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()

    cols_sql = safe_columns(feature_cols)
    df = con.execute(f"SELECT {cols_sql} FROM {safe_table_ref(dataset_name)}").df().dropna()

    if len(df) < 10:
        raise ValueError("At least 10 sample records required for clustering")

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df)

    best_k = n_clusters or 3
    best_score = -1.0
    k_evals = []

    if n_clusters is None:
        min_k, max_k = auto_k_range[0], min(auto_k_range[1], len(df) - 1)
        for k in range(min_k, max_k + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(scaled_data)
            score = silhouette_score(scaled_data, km.labels_)
            k_evals.append({"k": k, "silhouette_score": round(float(score), 4)})
            if score > best_score:
                best_score = score
                best_k = k

    final_km = KMeans(n_clusters=best_k, random_state=42, n_init=10).fit(scaled_data)
    df["cluster"] = final_km.labels_

    cluster_profiles = []
    for c_id in range(best_k):
        c_df = df[df["cluster"] == c_id]
        profile = {
            "cluster_id": c_id,
            "size": len(c_df),
            "percentage": round((len(c_df) / len(df)) * 100, 2),
            "feature_means": {col: round(float(c_df[col].mean()), 2) for col in feature_cols},
        }
        cluster_profiles.append(profile)

    return {
        "optimal_k": best_k,
        "silhouette_score": round(float(best_score), 4) if best_score > 0 else None,
        "k_evaluations": k_evals,
        "cluster_profiles": cluster_profiles,
        "total_samples": len(df),
    }


def run_rfm_segmentation(
    session_id: str, dataset_name: str, user_col: str, date_col: str, amount_col: str
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()

    sql = f"""
    WITH rfm_raw AS (
        SELECT
            {safe_ident(user_col)} AS uid,
            DATEDIFF('day', MAX({safe_ident(date_col)}::DATE), CURRENT_DATE) AS recency,
            COUNT(*) AS frequency,
            SUM({safe_ident(amount_col)}) AS monetary
        FROM {safe_table_ref(dataset_name)}
        GROUP BY 1
    )
    SELECT uid, recency, frequency, monetary FROM rfm_raw
    """
    df = con.execute(sql).df()

    df["R_Score"] = 5 - np.digitize(df["recency"], np.percentile(df["recency"], [25, 50, 75]))
    df["F_Score"] = np.digitize(df["frequency"], np.percentile(df["frequency"], [25, 50, 75])) + 1
    df["M_Score"] = np.digitize(df["monetary"], np.percentile(df["monetary"], [25, 50, 75])) + 1

    df["RFM_Total"] = (
        df["R_Score"].astype(str) + df["F_Score"].astype(str) + df["M_Score"].astype(str)
    )

    segment_counts = {
        "Champions (重要价值客户)": len(
            df[(df["R_Score"] >= 3) & (df["F_Score"] >= 3) & (df["M_Score"] >= 3)]
        ),
        "Loyal Customers (重要保持客户)": len(df[(df["R_Score"] >= 2) & (df["F_Score"] >= 3)]),
        "Potential Loyalists (重要发展客户)": len(df[(df["R_Score"] >= 3) & (df["M_Score"] >= 3)]),
        "At Risk (重要挽留客户)": len(df[(df["R_Score"] <= 2) & (df["M_Score"] >= 3)]),
        "Lost (流失客户)": len(df[(df["R_Score"] <= 2) & (df["F_Score"] <= 2)]),
    }

    return {
        "total_customers": len(df),
        "segments": segment_counts,
        "average_metrics": {
            "avg_recency_days": round(float(df["recency"].mean()), 1),
            "avg_frequency": round(float(df["frequency"].mean()), 1),
            "avg_monetary": round(float(df["monetary"].mean()), 2),
        },
    }
