from typing import Any

import numpy as np
from scipy import stats

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref


def detect_trends(
    session_id: str, dataset_name: str, time_col: str, metric: str, group_col: str | None = None
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()
    clock = Stopwatch()

    group_clause = f", {safe_ident(group_col)}" if group_col else ""
    time_ref = safe_ident(time_col)
    metric_ref = safe_ident(metric)
    sql = f"""
    SELECT {time_ref}{group_clause}, SUM({metric_ref}) AS val
    FROM {safe_table_ref(dataset_name)}
    WHERE {metric_ref} IS NOT NULL
    GROUP BY {time_ref}{group_clause}
    ORDER BY {time_ref} ASC
    """
    df = con.execute(sql).df()

    x = np.arange(len(df))
    y = df["val"].values

    slope, _intercept, r_value, p_value, _std_err = stats.linregress(x, y)
    r_squared = r_value**2

    change_points = []
    if len(y) >= 6:
        half = len(y) // 2
        s1, _, _, _, _ = stats.linregress(np.arange(half), y[:half])
        s2, _, _, _, _ = stats.linregress(np.arange(len(y) - half), y[half:])
        if np.sign(s1) != np.sign(s2) and abs(s1 - s2) > 0.1:
            change_points.append(
                {
                    "index": half,
                    "time_point": str(df[time_col].iloc[half]),
                    "trend_before": "Upward" if s1 > 0 else "Downward",
                    "trend_after": "Upward" if s2 > 0 else "Downward",
                }
            )

    direction = (
        "Upward (Increasing)" if slope > 0 else ("Downward (Decreasing)" if slope < 0 else "Flat")
    )
    # r² of 0.01 is the small-effect floor. A tiny slope with a tiny p-value stays non-significant.
    effect_ok = bool(r_squared >= 0.01)
    significant = bool(p_value < 0.05 and effect_ok)

    return {
        "time_col": time_col,
        "metric": metric,
        "trend_direction": direction,
        "slope": round(float(slope), 4),
        "r_squared": round(float(r_squared), 4),
        "p_value": round(float(p_value), 6),
        "statistically_significant": significant,
        "change_points": change_points,
        "series_preview": [
            {"time": str(r[time_col]), "val": round(float(r["val"]), 2)}
            for _, r in df.head(20).iterrows()
        ],
        "evidence": evidence(
            operator="trend_detection",
            method="linregress",
            sql=[sql],
            rows_used=len(df),
            duration_ms=clock.ms(),
            caveats=[]
            if effect_ok
            else ["r squared is under 0.01, so the trend is not called significant."],
        ),
    }
