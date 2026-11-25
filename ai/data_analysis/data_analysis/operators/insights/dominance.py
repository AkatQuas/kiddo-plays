from typing import Any

import numpy as np

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref


def detect_dominance(
    session_id: str, dataset_name: str, category_col: str, metric: str, top_k: int = 5
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()

    cat_ref = safe_ident(category_col)
    metric_ref = safe_ident(metric)
    sql = f"""
    SELECT {cat_ref}, SUM({metric_ref}) AS total_val
    FROM {safe_table_ref(dataset_name)}
    WHERE {metric_ref} IS NOT NULL
    GROUP BY 1
    ORDER BY total_val DESC
    """
    df = con.execute(sql).df()

    vals = df["total_val"].values
    total_sum = np.sum(vals)
    n = len(vals)

    if n == 0 or total_sum == 0:
        return {"gini_coefficient": 0.0, "top_k_share_pct": 0.0}

    sorted_vals = np.sort(vals)
    cum_vals = np.cumsum(sorted_vals)
    gini = float((n + 1 - 2 * np.sum(cum_vals) / cum_vals[-1]) / n)

    top_k_sum = np.sum(vals[:top_k])
    top_k_share = float((top_k_sum / total_sum) * 100)

    cum_share = np.cumsum(vals) / total_sum
    pareto_80_idx = int(np.searchsorted(cum_share, 0.80)) + 1
    pareto_category_ratio = round((pareto_80_idx / n) * 100, 2)

    top_items = [
        {
            "category": str(df[category_col].iloc[i]),
            "value": round(float(vals[i]), 2),
            "share_percentage": round(float(vals[i] * 100 / total_sum), 2),
        }
        for i in range(min(top_k, n))
    ]

    return {
        "category_col": category_col,
        "metric": metric,
        "total_categories": n,
        "gini_coefficient": round(gini, 3),
        "top_k_concentration_share_pct": round(top_k_share, 2),
        "pareto_80_rule_ratio": f"Top {pareto_category_ratio}% categories contribute 80% of total volume",
        "top_contributors": top_items,
    }
