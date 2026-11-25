import threading
import time
from typing import Any

import duckdb
from pydantic import BaseModel, Field

from data_analysis.catalog.lineage_tracker import _lineage_sources, get_lineage_tracker
from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.engine.sql_guard import safe_ident, safe_model_sql


class DAGModel(BaseModel):
    name: str
    sql: str
    materialization: str = "table"  # table, view, ephemeral, incremental
    depends_on: list[str] = Field(default_factory=list)
    description: str | None = ""
    # Rows whose unique_key appears in the new SQL replace the stored row.
    # Without it, incremental does a full refresh.
    unique_key: str | None = None


class PipelineDAG:
    """dbt-style DAG engine. The default ("_global") namespace persists models to
    the shared DB; per-session namespaces are in-memory and isolated so a
    pipeline run only materializes that session's own models (never another
    tenant's models against this session's connection)."""

    _instance = None
    _lock = threading.RLock()
    _session_instances: dict[str, "PipelineDAG"] = {}

    def __init__(self, session_id: str = "_global", persistent: bool = True):
        self.session_id = session_id
        self.persistent = persistent
        self._models: dict[str, DAGModel] = {}
        self.db = MetadataDB.get_instance() if persistent else None
        if persistent:
            self._restore_from_db()

    @classmethod
    def get_instance(cls) -> "PipelineDAG":
        """Process-wide engine. Same object as get_pipeline_engine("_global")."""
        with cls._lock:
            if cls._instance is None:
                existing = cls._session_instances.get("_global")
                cls._instance = (
                    existing if existing is not None else cls(session_id="_global", persistent=True)
                )
            cls._session_instances["_global"] = cls._instance
            return cls._instance

    def _restore_from_db(self):
        saved = self.db.list_dag_models()
        lineage = get_lineage_tracker(self.session_id)
        for d in saved:
            m = DAGModel(**d)
            self._models[m.name] = m
            for dep in m.depends_on:
                lineage.record_dependency(dep, m.name)

    def register_model(self, model: DAGModel) -> DAGModel:
        with self._lock:
            if not model.depends_on:
                inferred = []
                seen = set()
                for name in _lineage_sources(model.sql):
                    if name.lower() == model.name.lower() or name.lower() in seen:
                        continue
                    seen.add(name.lower())
                    inferred.append(name)
                if inferred:
                    model = model.model_copy(update={"depends_on": inferred})
            self._models[model.name] = model
            if self.persistent:
                self.db.save_dag_model(model.model_dump())
            # Record in this session's lineage tracker
            lineage = get_lineage_tracker(self.session_id)
            for dep in model.depends_on:
                lineage.record_dependency(dep, model.name)
            return model

    def list_models(self) -> list[DAGModel]:
        with self._lock:
            return list(self._models.values())

    def get_execution_order(self) -> list[str]:
        """Topological sort using Kahn's algorithm."""
        stages = self.get_execution_stages()
        flat_order = []
        for stage in stages:
            flat_order.extend(stage)
        return flat_order

    def get_execution_stages(self) -> list[list[str]]:
        """
        Partition DAG models into execution stages.

        Models in one stage have no mutual dependencies. Execution is still
        sequential: one DuckDB connection cannot run those models concurrently.
        """
        with self._lock:
            return self._stages_unlocked()

    def _stages_unlocked(self) -> list[list[str]]:
        in_degree = {name: 0 for name in self._models}
        adj = {name: [] for name in self._models}

        for name, m in self._models.items():
            for dep in m.depends_on:
                if dep in self._models:
                    adj[dep].append(name)
                    in_degree[name] += 1

        current_queue = [name for name, deg in in_degree.items() if deg == 0]
        stages = []
        visited_count = 0

        while current_queue:
            stages.append(list(current_queue))
            visited_count += len(current_queue)
            next_queue = []
            for curr in current_queue:
                for neighbor in adj[curr]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)
            current_queue = next_queue

        if visited_count != len(self._models):
            raise ValueError("Cyclic dependency detected in DAG transformation pipeline!")

        return stages

    def _closure_unlocked(self, names: list[str]) -> set[str]:
        """Selected models plus ancestor models. Source tables are not models."""
        missing = [name for name in names if name not in self._models]
        if missing:
            raise ValueError(f"Unknown DAG model(s): {', '.join(missing)}")
        wanted = set(names)
        stack = list(names)
        while stack:
            current = stack.pop()
            for dep in self._models[current].depends_on:
                if dep in self._models and dep not in wanted:
                    wanted.add(dep)
                    stack.append(dep)
        return wanted

    def _execute_single_model(
        self, con: duckdb.DuckDBPyConnection, model: DAGModel
    ) -> dict[str, Any]:
        """Execute model with atomic shadow-table swap & rollback."""
        name = model.name
        name_ref = safe_ident(name)
        mat_type = model.materialization.lower()
        if mat_type not in ("table", "view", "ephemeral", "incremental"):
            raise ValueError(f"Invalid materialization {model.materialization!r}")
        staging_ref = safe_ident(f"_stg_swap_{name}")
        model_sql = safe_model_sql(model.sql)

        start_t = time.time()
        try:
            merge_mode = None
            if mat_type in ("view", "ephemeral"):
                # Ephemeral is a view: downstream models read it, nothing is stored as a table.
                con.execute(f"CREATE OR REPLACE VIEW {name_ref} AS {model_sql}")
            elif mat_type == "incremental":
                merge_mode = self._materialize_incremental(
                    con, model, name_ref, staging_ref, model_sql
                )
            else:
                # 1. Build into staging table
                con.execute(f"CREATE OR REPLACE TABLE {staging_ref} AS {model_sql}")
                # 2. Atomic swap
                con.execute(f"DROP TABLE IF EXISTS {name_ref}")
                con.execute(f"ALTER TABLE {staging_ref} RENAME TO {name_ref}")

            row_count = con.execute(f"SELECT count(*) FROM {name_ref}").fetchone()[0]
            duration_ms = round((time.time() - start_t) * 1000, 2)

            result = {
                "model_name": name,
                "materialization": mat_type,
                "row_count": row_count,
                "duration_ms": duration_ms,
                "status": "SUCCESS",
            }
            if merge_mode:
                result["incremental_mode"] = merge_mode
            return result
        except Exception as e:
            # Cleanup staging table on failure
            try:
                con.execute(f"DROP TABLE IF EXISTS {staging_ref}")
            except Exception:
                pass
            raise RuntimeError(f"Model '{name}' execution failed: {e!s}")

    def _materialize_incremental(
        self, con, model: DAGModel, name_ref: str, staging_ref: str, model_sql: str
    ) -> str:
        """Merge on unique_key when the target already exists. Otherwise full refresh."""
        exists = _relation_exists(con, name_ref)
        if not exists or not model.unique_key:
            con.execute(f"CREATE OR REPLACE TABLE {staging_ref} AS {model_sql}")
            try:
                if model.unique_key:
                    _require_unique_key(con, staging_ref, model.unique_key)
                con.execute(f"DROP TABLE IF EXISTS {name_ref}")
                con.execute(f"ALTER TABLE {staging_ref} RENAME TO {name_ref}")
            except Exception:
                con.execute(f"DROP TABLE IF EXISTS {staging_ref}")
                raise
            return "full_refresh"
        key = safe_ident(model.unique_key)
        con.execute(f"CREATE OR REPLACE TABLE {staging_ref} AS {model_sql}")
        try:
            described = _require_unique_key(con, staging_ref, model.unique_key)
            cols = ", ".join(safe_ident(row[0]) for row in described)
            con.execute("BEGIN TRANSACTION")
            try:
                con.execute(
                    f"DELETE FROM {name_ref} WHERE {key} IN (SELECT {key} FROM {staging_ref})"
                )
                con.execute(f"INSERT INTO {name_ref} ({cols}) SELECT {cols} FROM {staging_ref}")
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise
        finally:
            con.execute(f"DROP TABLE IF EXISTS {staging_ref}")
        return "merge"

    def clear_models(self):
        with self._lock:
            names = list(self._models)
            self._models.clear()
            if self.persistent and self.db is not None:
                for name in names:
                    self.db.delete_dag_model(name)

    def run_pipeline(
        self, con: duckdb.DuckDBPyConnection, models: list[str] | None = None
    ) -> dict[str, Any]:
        """
        Execute the DAG transformation across dependency stages with atomic materialization.
        """
        with self._lock:
            # None runs the whole graph. A list runs that set plus ancestor models
            # so a downstream select still has its parents materialized.
            selected = None if models is None else self._closure_unlocked(models)
            stages = self._stages_unlocked()
            plan: list[DAGModel] = []
            for stage in stages:
                for model_name in stage:
                    if selected is not None and model_name not in selected:
                        continue
                    plan.append(self._models[model_name])

        all_results = []
        start_time = time.time()
        for model in plan:
            all_results.append(self._execute_single_model(con, model))

        total_duration = round((time.time() - start_time) * 1000, 2)

        return {
            "total_models": len(all_results),
            "total_stages": len(stages),
            "execution_order": [r["model_name"] for r in all_results],
            "total_duration_ms": total_duration,
            "results": all_results,
        }


def _require_unique_key(con: duckdb.DuckDBPyConnection, staging_ref: str, unique_key: str):
    described = con.execute(f"DESCRIBE {staging_ref}").fetchall()
    columns = [row[0] for row in described]
    if unique_key not in columns:
        raise ValueError(
            f"incremental unique_key {unique_key!r} is not in the model output columns {columns}"
        )
    return described


def _relation_exists(con: duckdb.DuckDBPyConnection, name_ref: str) -> bool:
    try:
        con.execute(f"SELECT 1 FROM {name_ref} LIMIT 0")
        return True
    except duckdb.Error:
        return False


def get_pipeline_engine(session_id: str = "_global") -> PipelineDAG:
    if session_id == "_global":
        return PipelineDAG.get_instance()
    with PipelineDAG._lock:
        inst = PipelineDAG._session_instances.get(session_id)
        if inst is None:
            inst = PipelineDAG(session_id=session_id, persistent=False)
            PipelineDAG._session_instances[session_id] = inst
        return inst
