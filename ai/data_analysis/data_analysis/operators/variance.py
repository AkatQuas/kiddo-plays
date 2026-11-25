from typing import Any

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.distributed_ops.variance_decomp import VarianceDecomposition


def run_variance_decomposition(
    session_id: str,
    dataset_name: str,
    metric: str,
    dimensions: list[str],
    filters: str | None = None,
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    return VarianceDecomposition.decompose(
        sess.get_duckdb_conn(),
        dataset_name,
        metric,
        dimensions,
        filters,
    )
