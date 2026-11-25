from typing import Any

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.distributed_ops.dist_eda import DistributedEDA


def run_eda_profile(session_id: str, dataset_name: str) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.require_session(session_id)
    con = sess.get_duckdb_conn()
    return DistributedEDA.profile_table(con, dataset_name)
