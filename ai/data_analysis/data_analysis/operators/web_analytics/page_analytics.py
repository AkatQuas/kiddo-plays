import math
from typing import Any

from data_analysis.operators.web_analytics.session_source import records, resolve_table


def calculate_page_metrics(session_id: str, table_name: str, limit: int = 20) -> dict[str, Any]:
    """Pageview (PV), Unique Visitors (UV), and dwell time by page path."""
    con, tbl = resolve_table(session_id, table_name)

    sql = f"""
    SELECT
        page_path,
        count(*) as pv,
        count(DISTINCT user_id) as uv,
        count(DISTINCT session_id) as sessions,
        avg(CASE WHEN event_name = '$page_leave' THEN CAST(json_extract(properties, '$.dwell_time_seconds') AS DOUBLE) ELSE NULL END) as avg_dwell_time_sec
    FROM {tbl}
    WHERE page_path IS NOT NULL
    GROUP BY page_path
    ORDER BY pv DESC
    LIMIT ?
    """

    rows = records(con.execute(sql, [limit]))
    pages = []
    for r in rows:
        # avg() over a group with no valid dwell values yields NaN/Inf, neither of
        # which is None; isfinite collapses both so json.dumps cannot 500.
        dwell = r.get("avg_dwell_time_sec")
        dwell_val = float(dwell) if dwell is not None else 0.0
        if not math.isfinite(dwell_val):
            dwell_val = 0.0
        pages.append(
            {
                "page_path": r["page_path"],
                "pv": int(r["pv"]),
                "uv": int(r["uv"]),
                "sessions": int(r["sessions"]),
                "avg_dwell_seconds": round(dwell_val, 1),
            }
        )

    summary_sql = f"""
    SELECT
        count(*) as total_events,
        count(DISTINCT user_id) as total_uv,
        count(DISTINCT session_id) as total_sessions,
        count(CASE WHEN event_type = 'error' THEN 1 END) as total_errors
    FROM {tbl}
    """
    summary = records(con.execute(summary_sql))
    sum_data = summary[0] if summary else {}

    return {
        "summary": {
            "total_events": int(sum_data.get("total_events", 0)),
            "total_uv": int(sum_data.get("total_uv", 0)),
            "total_sessions": int(sum_data.get("total_sessions", 0)),
            "total_errors": int(sum_data.get("total_errors", 0)),
        },
        "pages": pages,
    }
