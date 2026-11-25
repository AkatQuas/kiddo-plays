from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_table_ref


def detect_outliers(
    session_id: str,
    dataset_name: str,
    metric: str,
    dimension_cols: list[str] | None = None,
    method: str = "z_score",
    threshold: float = 3.0,
    top_k: int = 10,
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()

    clock = Stopwatch()
    metric_col = safe_ident(metric)
    table_ref = safe_table_ref(dataset_name)
    dim_clause = safe_columns(dimension_cols) if dimension_cols else ""
    select_clause = ", ".join(filter(None, [dim_clause, metric_col]))
    sql = f"SELECT {select_clause} FROM {table_ref} WHERE {metric_col} IS NOT NULL"
    rows_scanned = int(con.execute(f"SELECT COUNT(*) FROM {table_ref}").fetchone()[0])
    df = con.execute(sql).df()
    rows_used = len(df)

    vals = df[metric].values
    mean_v = float(np.mean(vals))
    std_v = float(np.std(vals))
    outlier_rows = []

    if method.lower() == "z_score":
        z_scores = (vals - mean_v) / (std_v if std_v > 0 else 1.0)
        df["_z_score"] = z_scores
        outliers_df = df[np.abs(df["_z_score"]) >= threshold].copy()
        outliers_df["_abs_z"] = np.abs(outliers_df["_z_score"])
        outliers_df = outliers_df.sort_values(by="_abs_z", ascending=False)
        population_count = len(outliers_df)
        outliers_df = outliers_df.head(top_k)

        for _, r in outliers_df.iterrows():
            item = {
                "value": float(r[metric]),
                "z_score": round(float(r["_z_score"]), 2),
                "deviation_from_mean": round(float(r[metric] - mean_v), 2),
            }
            if dimension_cols:
                item["dimensions"] = {d: str(r[d]) for d in dimension_cols}
            outlier_rows.append(item)

    elif method.lower() == "iqr":
        q25, q75 = np.percentile(vals, 25), np.percentile(vals, 75)
        iqr = q75 - q25
        lower_bound = q25 - 1.5 * iqr
        upper_bound = q75 + 1.5 * iqr
        outliers_df = df[(df[metric] < lower_bound) | (df[metric] > upper_bound)]
        population_count = len(outliers_df)
        outliers_df = outliers_df.head(top_k)
        for _, r in outliers_df.iterrows():
            item = {
                "value": float(r[metric]),
                "lower_bound": round(lower_bound, 2),
                "upper_bound": round(upper_bound, 2),
            }
            if dimension_cols:
                item["dimensions"] = {d: str(r[d]) for d in dimension_cols}
            outlier_rows.append(item)

    elif method.lower() == "isolation_forest":
        iso = IsolationForest(contamination=0.01, random_state=42)
        preds = iso.fit_predict(vals.reshape(-1, 1))
        df["_is_outlier"] = preds == -1
        outliers_df = df[df["_is_outlier"]]
        population_count = len(outliers_df)
        outliers_df = outliers_df.head(top_k)
        for _, r in outliers_df.iterrows():
            item = {"value": float(r[metric]), "anomaly_score": "High"}
            if dimension_cols:
                item["dimensions"] = {d: str(r[d]) for d in dimension_cols}
            outlier_rows.append(item)

    if method.lower() not in {"z_score", "iqr", "isolation_forest"}:
        population_count = 0
    return {
        "metric": metric,
        "method": method,
        "baseline_mean": round(mean_v, 2),
        "baseline_std": round(std_v, 2),
        "outlier_count": int(population_count),
        "outlier_sample_size": len(outlier_rows),
        "outliers": outlier_rows,
        "evidence": evidence(
            operator="outlier_detection",
            method=method,
            sql=[sql],
            rows_scanned=rows_scanned,
            rows_used=rows_used,
            nulls_dropped=rows_scanned - rows_used,
            duration_ms=clock.ms(),
            caveats=["outlier_count is the full population. outliers is the top-k sample."],
        ),
    }
