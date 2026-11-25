from typing import Any

from data_analysis.operators.web_analytics.session_source import CREATED_AT_TS, resolve_table
from data_analysis.schemas.charts import ChartSpecBuilder


def calculate_funnel(
    session_id: str,
    table_name: str,
    steps: list[str],
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """Multi-step sequential conversion funnel over a session-resident event table."""
    if not steps:
        return {"error": "Steps cannot be empty"}

    con, tbl = resolve_table(session_id, table_name)

    step_results = []
    prev_users: str | None = None
    prev_params: list[Any] = []

    for idx, step_name in enumerate(steps):
        where_clauses = ["event_name = ?"]
        step_params: list[Any] = [step_name]
        if date_from:
            where_clauses.append(f"{CREATED_AT_TS} >= ?")
            step_params.append(date_from)
        if date_to:
            where_clauses.append(f"{CREATED_AT_TS} <= ?")
            step_params.append(date_to)

        where_sql = " AND ".join(where_clauses)
        users_sql = f"SELECT DISTINCT user_id FROM {tbl} WHERE {where_sql}"

        if prev_users is None:
            sql = f"SELECT count(DISTINCT user_id) as count FROM {tbl} WHERE {where_sql}"
            res = con.execute(sql, list(step_params)).fetchone()
            count = res[0] if res else 0
            prev_users = users_sql
            prev_params = list(step_params)
        else:
            sql = f"SELECT count(DISTINCT user_id) as count FROM {tbl} WHERE {where_sql} AND user_id IN ({prev_users})"
            res = con.execute(sql, list(step_params) + prev_params).fetchone()
            count = res[0] if res else 0
            prev_users = f"{prev_users} INTERSECT {users_sql}"
            prev_params = prev_params + list(step_params)

        step_results.append(
            {
                "step_index": idx + 1,
                "step_name": step_name,
                "user_count": int(count or 0),
            }
        )

    first_count = step_results[0]["user_count"] if step_results else 0
    for idx, step in enumerate(step_results):
        if idx == 0:
            step["step_conversion_rate"] = 1.0
            step["overall_conversion_rate"] = 1.0 if first_count > 0 else 0.0
            step["drop_off_rate"] = 0.0
        else:
            prev_count = step_results[idx - 1]["user_count"]
            step["step_conversion_rate"] = (
                round(step["user_count"] / prev_count, 4) if prev_count > 0 else 0.0
            )
            step["overall_conversion_rate"] = (
                round(step["user_count"] / first_count, 4) if first_count > 0 else 0.0
            )
            step["drop_off_rate"] = round(1.0 - step["step_conversion_rate"], 4)

    return {
        "total_steps": len(steps),
        "initial_users": first_count,
        "final_converted_users": step_results[-1]["user_count"] if step_results else 0,
        "overall_conversion_rate": step_results[-1]["overall_conversion_rate"]
        if step_results
        else 0.0,
        "steps": step_results,
        "chart_spec": ChartSpecBuilder.build_funnel_chart(step_results),
    }
