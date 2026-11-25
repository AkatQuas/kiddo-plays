from typing import Any

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.distributed_ops.dist_olap import DistributedOLAP
from data_analysis.engine.arrow_utils import ArrowUtils


def run_olap_query(
    session_id: str,
    dataset_name: str,
    dimensions: list[str],
    metrics: list[str],
    agg_funcs: list[str] | None = None,
    filters: str | None = None,
    rollup: bool = False,
    cube: bool = False,
    order_by: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()

    arrow_res = DistributedOLAP.aggregate(
        con=con,
        table_name=dataset_name,
        dimensions=dimensions,
        metrics=metrics,
        agg_funcs=agg_funcs,
        filters=filters,
        rollup=rollup,
        cube=cube,
        order_by=order_by,
        limit=limit,
    )

    return {
        "total_records": len(arrow_res),
        "schema": arrow_res.column_names,
        "records": ArrowUtils.table_to_compact_preview(arrow_res, limit=limit),
    }


def run_pivot_table(
    session_id: str,
    dataset_name: str,
    rows: list[str],
    columns: str,
    values: str,
    agg_func: str = "SUM",
    filters: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()

    arrow_res = DistributedOLAP.pivot_table(
        con=con,
        table_name=dataset_name,
        rows=rows,
        columns=columns,
        values=values,
        agg_func=agg_func,
        filters=filters,
    )

    return {
        "total_records": len(arrow_res),
        "schema": arrow_res.column_names,
        "records": ArrowUtils.table_to_compact_preview(arrow_res, limit=limit),
    }
