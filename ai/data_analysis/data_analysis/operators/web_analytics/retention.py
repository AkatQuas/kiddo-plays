from typing import Any

import pandas as pd

from data_analysis.operators.web_analytics.session_source import CREATED_AT_TS, resolve_table
from data_analysis.schemas.charts import ChartSpecBuilder


def calculate_retention(session_id: str, table_name: str, days: int = 7) -> dict[str, Any]:
    """Cohort retention heatmap matrix over a session-resident event table."""
    con, tbl = resolve_table(session_id, table_name)

    sql = f"""
    WITH normalized AS (
        SELECT user_id, {CREATED_AT_TS} AS ts FROM {tbl} WHERE user_id IS NOT NULL
    ),
    first_active AS (
        SELECT
            user_id,
            min(strftime(ts, '%Y-%m-%d')) AS cohort_date,
            min(ts) AS first_time
        FROM normalized
        GROUP BY user_id
    ),
    activity AS (
        SELECT DISTINCT
            e.user_id,
            f.cohort_date,
            datediff('day', f.first_time, e.ts) AS day_diff
        FROM normalized e
        JOIN first_active f ON e.user_id = f.user_id
        WHERE datediff('day', f.first_time, e.ts) BETWEEN 0 AND ?
    )
    SELECT
        cohort_date,
        day_diff,
        count(DISTINCT user_id) as active_users
    FROM activity
    GROUP BY cohort_date, day_diff
    ORDER BY cohort_date ASC, day_diff ASC
    """

    rows = con.execute(sql, [days]).df().to_dict(orient="records")
    if not rows:
        return {"cohorts": [], "retention_matrix": []}

    df = pd.DataFrame(rows)
    cohort_sizes = df[df["day_diff"] == 0].set_index("cohort_date")["active_users"].to_dict()

    matrix = []
    for c_date, group in df.groupby("cohort_date"):
        c_size = cohort_sizes.get(c_date, 1)
        row_dict = {"cohort_date": str(c_date), "cohort_size": int(c_size)}
        for d in range(days + 1):
            day_match = group[group["day_diff"] == d]
            if not day_match.empty:
                cnt = int(day_match.iloc[0]["active_users"])
                rate = round(cnt / c_size, 4) if c_size > 0 else 0.0
                row_dict[f"day_{d}"] = {"count": cnt, "rate": rate}
            else:
                row_dict[f"day_{d}"] = {"count": 0, "rate": 0.0}
        matrix.append(row_dict)

    return {
        "cohorts": list(cohort_sizes.keys()),
        "days_analyzed": days,
        "retention_matrix": matrix,
        "chart_spec": ChartSpecBuilder.build_retention_heatmap(matrix),
    }
