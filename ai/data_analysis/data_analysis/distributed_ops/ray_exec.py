"""Partition a numeric scan and merge the sums.

Ray is optional. When `DATA_ANALYSIS_RAY_ENABLED` is on and the `ray` package
imports, each partition runs as a Ray task. Otherwise the same worker function
runs in this process. Either way the merged sums match one DuckDB scan.
Remote workers have to see the spill parquet; a local Ray on this machine does.
"""

import os
import shutil
import tempfile
from typing import Any

import duckdb

from data_analysis.config import settings
from data_analysis.engine.sql_guard import safe_ident


def merge_sum_rows(pieces: list[dict[str, Any]]) -> dict[str, float]:
    merged: dict[str, float] = {}
    for piece in pieces:
        for key, value in piece.items():
            merged[key] = merged.get(key, 0.0) + float(value or 0.0)
    if "__n" in merged:
        merged["__n"] = float(int(merged["__n"]))
    return merged


def _sum_select(columns: list[str]) -> tuple[str, str]:
    quoted = [safe_ident(name) for name in columns]
    select_parts = ["COUNT(*) AS __n"]
    for i, column in enumerate(quoted):
        select_parts.append(f"SUM({column}) AS __s{i}")
        select_parts.append(f"SUM({column} * {column}) AS __ss{i}")
        for j in range(i + 1, len(quoted)):
            select_parts.append(f"SUM({column} * {quoted[j]}) AS __sp{i}_{j}")
    return ", ".join(select_parts), quoted[0]


def pearson_partition(task: dict[str, Any]) -> dict[str, float]:
    """Sufficient statistics for one hash slice of a parquet file."""
    columns = list(task["columns"])
    select_list, first = _sum_select(columns)
    parts = int(task["parts"])
    part = int(task["part"])
    path = str(task["parquet"]).replace("'", "''")
    sql = (
        f"SELECT {select_list} FROM read_parquet('{path}') "
        f"WHERE (hash(CAST({first} AS VARCHAR)) % {parts}) = {part}"
    )
    con = duckdb.connect(database=":memory:")
    try:
        rel = con.execute(sql)
        row = rel.fetchone()
        names = [item[0] for item in rel.description]
    finally:
        con.close()
    return {name: float(value or 0.0) for name, value in zip(names, row, strict=False)}


def _import_ray():
    try:
        import ray
    except ImportError:
        return None
    return ray


def _ray_map(ray_mod, tasks: list[dict[str, Any]], worker) -> list[Any]:
    if not ray_mod.is_initialized():
        kwargs = {"ignore_reinit_error": True, "include_dashboard": False}
        if settings.RAY_ADDRESS:
            ray_mod.init(address=settings.RAY_ADDRESS, **kwargs)
        else:
            ray_mod.init(num_cpus=min(4, os.cpu_count() or 2), **kwargs)
    remote = ray_mod.remote(worker)
    return ray_mod.get([remote.remote(task) for task in tasks])


def run_partition_tasks(tasks: list[dict[str, Any]], worker=None) -> tuple[list[Any], str]:
    fn = worker or pearson_partition
    ray_mod = _import_ray()
    if ray_mod is not None:
        try:
            return _ray_map(ray_mod, tasks, fn), "ray"
        except Exception:
            pass
    return [fn(task) for task in tasks], "local"


def partition_count() -> int:
    configured = int(settings.RAY_PARTITIONS or 0)
    if configured > 0:
        return max(2, min(16, configured))
    return max(2, min(8, os.cpu_count() or 2))


def _session_hash_merge(
    con, select_sql: str, columns: list[str], parts: int
) -> tuple[dict[str, float], str]:
    """Same merge when this connection can no longer write a spill file.

    DuckDB refuses to turn enable_external_access back on after the sandbox
    has turned it off, so COPY is unavailable for the rest of that connection.
    """
    select_list, first = _sum_select(columns)
    pieces = []
    for part in range(parts):
        sql = (
            f"SELECT {select_list} FROM ({select_sql}) AS _slice "
            f"WHERE (hash(CAST({first} AS VARCHAR)) % {parts}) = {part}"
        )
        rel = con.execute(sql)
        row = rel.fetchone()
        names = [item[0] for item in rel.description]
        pieces.append({name: float(value or 0.0) for name, value in zip(names, row, strict=False)})
    note = (
        f"Pearson sufficient statistics were merged from {parts} partitions "
        "(backend=session). External access is off on this connection, so the slices stayed here."
    )
    return merge_sum_rows(pieces), note


def partitioned_pearson_sums(
    con, select_sql: str, columns: list[str], parts: int
) -> tuple[dict[str, float], str]:
    directory = tempfile.mkdtemp(prefix="ray-scan-")
    path = os.path.join(directory, "cols.parquet")
    try:
        escaped = path.replace("'", "''")
        try:
            con.execute(f"COPY ({select_sql}) TO '{escaped}' (FORMAT PARQUET)")
        except duckdb.Error:
            return _session_hash_merge(con, select_sql, columns, parts)
        tasks = [
            {"parquet": path, "part": index, "parts": parts, "columns": list(columns)}
            for index in range(parts)
        ]
        pieces, backend = run_partition_tasks(tasks)
        note = (
            f"Pearson sufficient statistics were merged from {parts} partitions "
            f"(backend={backend})."
        )
        return merge_sum_rows(pieces), note
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def merge_group_moments(pieces: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Add per-group (n, sum, sum of squares) across partitions."""
    merged: dict[tuple[str, ...], dict[str, Any]] = {}
    for piece in pieces:
        for row in piece:
            key = tuple(str(part) for part in row["key"])
            current = merged.get(key)
            if current is None:
                merged[key] = {
                    "key": key,
                    "n": float(row["n"] or 0.0),
                    "s": float(row["s"] or 0.0),
                    "ss": float(row["ss"] or 0.0),
                }
                continue
            current["n"] += float(row["n"] or 0.0)
            current["s"] += float(row["s"] or 0.0)
            current["ss"] += float(row["ss"] or 0.0)
    return list(merged.values())


def _moment_rows(rel, n_dims: int) -> list[dict[str, Any]]:
    cells = []
    for row in rel.fetchall():
        n_value = row[n_dims]
        if n_value is None or float(n_value) == 0.0:
            continue
        cells.append(
            {
                "key": [str(row[i]) for i in range(n_dims)],
                "n": float(n_value),
                "s": float(row[n_dims + 1] or 0.0),
                "ss": float(row[n_dims + 2] or 0.0),
            }
        )
    return cells


def _group_moment_sql(dimensions: list[str], source_sql: str, parts: int, part: int) -> str:
    dim_sql = ", ".join(safe_ident(name) for name in dimensions)
    hash_args = ", ".join(
        f"CAST({safe_ident(name)} AS VARCHAR)" for name in [*list(dimensions), "__y"]
    )
    group_by = ", ".join(str(i + 1) for i in range(len(dimensions)))
    return (
        f"SELECT {dim_sql}, COUNT(__y), SUM(__y), SUM(__y * __y) "
        f"FROM ({source_sql}) AS _slice "
        f"WHERE (hash({hash_args}) % {int(parts)}) = {int(part)} "
        f"GROUP BY {group_by}"
    )


def group_moment_partition(task: dict[str, Any]) -> list[dict[str, Any]]:
    """Group moments for one hash slice of a parquet spill."""
    dimensions = list(task["dimensions"])
    parts = int(task["parts"])
    part = int(task["part"])
    path = str(task["parquet"]).replace("'", "''")
    source = f"SELECT * FROM read_parquet('{path}')"
    sql = _group_moment_sql(dimensions, source, parts, part)
    con = duckdb.connect(database=":memory:")
    try:
        rel = con.execute(sql)
        return _moment_rows(rel, len(dimensions))
    finally:
        con.close()


def _session_group_merge(
    con, select_sql: str, dimensions: list[str], parts: int
) -> tuple[list[dict[str, Any]], str]:
    pieces = []
    for part in range(parts):
        sql = _group_moment_sql(dimensions, select_sql, parts, part)
        pieces.append(_moment_rows(con.execute(sql), len(dimensions)))
    note = (
        f"Variance group moments were merged from {parts} partitions "
        "(backend=session). External access is off on this connection, so the slices stayed here."
    )
    return merge_group_moments(pieces), note


def partitioned_group_moments(
    con, select_sql: str, dimensions: list[str], parts: int
) -> tuple[list[dict[str, Any]], str]:
    """Spill the metric and dimensions, then merge group moments across hash slices."""
    directory = tempfile.mkdtemp(prefix="ray-var-")
    path = os.path.join(directory, "cols.parquet")
    try:
        escaped = path.replace("'", "''")
        try:
            con.execute(f"COPY ({select_sql}) TO '{escaped}' (FORMAT PARQUET)")
        except duckdb.Error:
            return _session_group_merge(con, select_sql, dimensions, parts)
        tasks = [
            {"parquet": path, "part": index, "parts": parts, "dimensions": list(dimensions)}
            for index in range(parts)
        ]
        pieces, backend = run_partition_tasks(tasks, group_moment_partition)
        note = f"Variance group moments were merged from {parts} partitions (backend={backend})."
        return merge_group_moments(pieces), note
    finally:
        shutil.rmtree(directory, ignore_errors=True)
