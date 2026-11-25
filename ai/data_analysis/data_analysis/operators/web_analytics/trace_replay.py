import json
from typing import Any

from data_analysis.operators.web_analytics.session_source import records, resolve_table


def get_trace_waterfall(session_id: str, table_name: str, trace_id: str) -> dict[str, Any]:
    """Reconstruct an OpenTelemetry span waterfall for a trace_id from a session table."""
    con, tbl = resolve_table(session_id, table_name)
    sql = f"""
    SELECT
        span_id, trace_id, parent_span_id,
        event_name AS name, service_name,
        COALESCE(status_code, 'OK') AS status_code,
        COALESCE(duration_ms, 0.0) AS duration_ms,
        created_at AS start_time,
        properties AS attributes
    FROM {tbl}
    WHERE trace_id = ? AND span_id IS NOT NULL
    ORDER BY timestamp_ms ASC, created_at ASC
    """
    spans = records(con.execute(sql, [trace_id]))
    return {"trace_id": trace_id, "total_spans": len(spans), "spans": spans}


def get_session_action_replay(
    session_id: str, table_name: str, telemetry_session_id: str
) -> dict[str, Any]:
    """Chronological breadcrumb timeline for one telemetry session from a session table."""
    con, tbl = resolve_table(session_id, table_name)
    sql = f"""
    SELECT
        event_id, trace_id, event_type, event_name, page_path, page_url,
        properties, created_at, timestamp_ms
    FROM {tbl}
    WHERE session_id = ?
    ORDER BY timestamp_ms ASC
    """
    events = records(con.execute(sql, [telemetry_session_id]))

    actions = []
    for ev in events:
        props = ev.get("properties")
        if isinstance(props, str):
            try:
                props = json.loads(props)
            except (ValueError, TypeError):
                props = {}
        actions.append(
            {
                "event_id": ev["event_id"],
                "event_type": ev["event_type"],
                "event_name": ev["event_name"],
                "page_path": ev["page_path"],
                "created_at": str(ev["created_at"]),
                "timestamp_ms": ev["timestamp_ms"],
                "properties": props or {},
            }
        )

    return {
        "session_id": telemetry_session_id,
        "action_count": len(actions),
        "timeline": actions,
    }


def list_recent_sessions(session_id: str, table_name: str, limit: int = 20) -> list[dict[str, Any]]:
    """List recent telemetry sessions with event counts and error flags."""
    con, tbl = resolve_table(session_id, table_name)
    sql = f"""
    SELECT
        session_id,
        user_id,
        min(created_at) as start_time,
        max(created_at) as end_time,
        count(*) as event_count,
        count(CASE WHEN event_type = 'error' THEN 1 END) as error_count,
        min(page_path) as entry_path,
        max(page_path) as exit_path
    FROM {tbl}
    WHERE session_id IS NOT NULL
    GROUP BY session_id, user_id
    ORDER BY max(created_at) DESC
    LIMIT ?
    """
    return records(con.execute(sql, [limit]))
