from typing import Any

from data_analysis.operators.web_analytics.session_source import records, resolve_table
from data_analysis.schemas.charts import ChartSpecBuilder


def calculate_user_flow(session_id: str, table_name: str, limit_paths: int = 15) -> dict[str, Any]:
    """Page transition matrix and Sankey nodes/links over a session-resident table."""
    con, tbl = resolve_table(session_id, table_name)

    sql = f"""
    WITH ordered_pages AS (
        SELECT
            session_id,
            page_path AS source_page,
            LEAD(page_path) OVER (PARTITION BY session_id ORDER BY timestamp_ms ASC) AS target_page
        FROM {tbl}
        WHERE event_type = 'pageview' AND event_name = '$pageview'
    )
    SELECT
        source_page,
        target_page,
        count(*) AS flow_volume
    FROM ordered_pages
    WHERE target_page IS NOT NULL AND source_page != target_page
    GROUP BY source_page, target_page
    ORDER BY flow_volume DESC
    LIMIT ?
    """

    raw_flows = records(con.execute(sql, [limit_paths]))

    nodes_set = set()
    links = []
    for row in raw_flows:
        src = str(row["source_page"])
        tgt = str(row["target_page"])
        val = int(row["flow_volume"])
        nodes_set.add(src)
        nodes_set.add(tgt)
        links.append({"source": src, "target": tgt, "value": val})

    nodes = [{"name": n} for n in sorted(nodes_set)]

    return {
        "nodes": nodes,
        "links": links,
        "total_transitions": sum(link["value"] for link in links),
        "chart_spec": ChartSpecBuilder.build_sankey_chart(nodes, links),
    }
