"""Hex Threads-style Analysis Trail Ledger & Parameterizable Playbooks.

Tracks every analytical step in a session (`AnalysisStep`), allows exporting a
curated multi-step investigation thread into a saved `AnalysisPlaybook`, and
supports replaying a playbook with parameter overrides (e.g., new time windows,
dataset_name, filters, or metric columns).
"""

import copy
import threading
import time
import uuid
from typing import Any

from pydantic import BaseModel, Field

from data_analysis.catalog.metadata_db import MetadataDB


class AnalysisStep(BaseModel):
    step_id: str
    step_index: int
    session_id: str
    operator: str
    method: str | None = None
    dataset_name: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    summary: str = ""
    sql: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    duration_ms: float | None = None
    rows_scanned: int | None = None
    rows_used: int | None = None
    nulls_dropped: int | None = None
    ungoverned_sql: bool = False
    chart_spec: dict[str, Any] | None = None
    evidence_v2: dict[str, Any] | None = None
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


class AnalysisPlaybook(BaseModel):
    playbook_id: str
    session_id: str = "_global"
    title: str
    description: str = ""
    steps: list[dict[str, Any]] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    endorsement_status: str = "endorsed"
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )
    updated_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


def _deep_merge(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in (overrides or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


class AnalysisTrailLedger:
    """Per-session ordered ledger of analytical tool executions and playbooks."""

    _lock = threading.RLock()
    _session_instances: dict[str, "AnalysisTrailLedger"] = {}
    _memory_playbooks: dict[str, AnalysisPlaybook] = {}

    def __init__(self, session_id: str, persistent_playbooks: bool = True):
        self.session_id = session_id
        self.persistent_playbooks = persistent_playbooks
        self.db = MetadataDB.get_instance() if persistent_playbooks else None
        self._steps: list[AnalysisStep] = []

    def record_step(
        self,
        *,
        operator: str,
        method: str | None = None,
        dataset_name: str | None = None,
        parameters: dict[str, Any] | None = None,
        summary: str = "",
        sql: list[str] | None = None,
        warnings: list[str] | None = None,
        duration_ms: float | None = None,
        rows_scanned: int | None = None,
        rows_used: int | None = None,
        nulls_dropped: int | None = None,
        ungoverned_sql: bool = False,
        chart_spec: dict[str, Any] | None = None,
        evidence_v2: dict[str, Any] | None = None,
    ) -> AnalysisStep:
        with self._lock:
            idx = len(self._steps) + 1
            step = AnalysisStep(
                step_id=f"step_{idx:03d}_{uuid.uuid4().hex[:6]}",
                step_index=idx,
                session_id=self.session_id,
                operator=operator,
                method=method,
                dataset_name=dataset_name,
                parameters=dict(parameters or {}),
                summary=summary or f"{operator} step {idx}",
                sql=list(sql or []),
                warnings=list(warnings or []),
                duration_ms=duration_ms,
                rows_scanned=rows_scanned,
                rows_used=rows_used,
                nulls_dropped=nulls_dropped,
                ungoverned_sql=ungoverned_sql,
                chart_spec=chart_spec,
                evidence_v2=evidence_v2,
            )
            self._steps.append(step)
            return step

    def list_steps(self, limit: int = 100) -> list[AnalysisStep]:
        with self._lock:
            return list(self._steps[-limit:]) if limit > 0 else list(self._steps)

    def clear_steps(self) -> int:
        with self._lock:
            n = len(self._steps)
            self._steps.clear()
            return n

    def export_playbook(
        self,
        title: str,
        description: str = "",
        step_ids: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
        playbook_id: str | None = None,
        endorsement_status: str = "endorsed",
    ) -> AnalysisPlaybook:
        with self._lock:
            if not title or not title.strip():
                raise ValueError("Playbook title is required")
            if step_ids:
                by_id = {s.step_id: s for s in self._steps}
                selected = []
                for sid in step_ids:
                    if sid not in by_id:
                        raise ValueError(
                            f"Step ID '{sid}' not found in session '{self.session_id}' trail"
                        )
                    selected.append(by_id[sid])
            else:
                selected = list(self._steps)
            if not selected:
                raise ValueError(
                    f"Session '{self.session_id}' has no recorded analysis steps to export"
                )

            pb_id = playbook_id or f"pb_{uuid.uuid4().hex[:10]}"
            now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            pb = AnalysisPlaybook(
                playbook_id=pb_id,
                session_id=self.session_id,
                title=title.strip(),
                description=description or "",
                steps=[s.model_dump() for s in selected],
                parameters=dict(parameters or {}),
                endorsement_status=endorsement_status or "endorsed",
                created_at=now_str,
                updated_at=now_str,
            )
            self._memory_playbooks[pb_id] = pb
            if self.persistent_playbooks and self.db is not None:
                self.db.save_playbook(pb.model_dump())
            return pb

    @classmethod
    def get_playbook(cls, playbook_id: str) -> AnalysisPlaybook | None:
        with cls._lock:
            if playbook_id in cls._memory_playbooks:
                return cls._memory_playbooks[playbook_id]
            db = MetadataDB.get_instance()
            row = db.get_playbook(playbook_id)
            if row:
                pb = AnalysisPlaybook(**row)
                cls._memory_playbooks[playbook_id] = pb
                return pb
            return None

    @classmethod
    def list_playbooks(cls, session_id: str | None = None) -> list[AnalysisPlaybook]:
        with cls._lock:
            db = MetadataDB.get_instance()
            rows = db.list_playbooks(session_id=session_id)
            out = {r["playbook_id"]: AnalysisPlaybook(**r) for r in rows}
            for k, v in cls._memory_playbooks.items():
                if session_id is None or v.session_id in (session_id, "_global"):
                    out[k] = v
            return list(out.values())

    @classmethod
    def replay_playbook(
        cls,
        playbook_id: str,
        target_session_id: str | None = None,
        parameter_overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Re-execute each step in a saved playbook deterministically with optional parameter overrides."""
        pb = cls.get_playbook(playbook_id)
        if pb is None:
            raise ValueError(f"Playbook '{playbook_id}' not found")

        overrides = dict(pb.parameters or {})
        if parameter_overrides:
            overrides = _deep_merge(overrides, parameter_overrides)

        run_session_id = target_session_id or overrides.get("session_id") or pb.session_id
        step_results: list[dict[str, Any]] = []

        for idx, raw_step in enumerate(pb.steps, start=1):
            op = raw_step.get("operator")
            step_params = _deep_merge(raw_step.get("parameters") or {}, overrides)
            step_params["session_id"] = run_session_id
            if "dataset_name" not in step_params and raw_step.get("dataset_name"):
                step_params["dataset_name"] = (
                    overrides.get("dataset_name") or raw_step["dataset_name"]
                )

            res_payload = _dispatch_replay_step(op, run_session_id, step_params)
            step_results.append(
                {
                    "step_index": idx,
                    "original_step_id": raw_step.get("step_id"),
                    "operator": op,
                    "parameters_used": step_params,
                    "output": res_payload,
                }
            )

        return {
            "status": "success",
            "playbook_id": pb.playbook_id,
            "title": pb.title,
            "session_id": run_session_id,
            "steps_executed": len(step_results),
            "parameter_overrides": parameter_overrides or {},
            "results": step_results,
        }


def _dispatch_replay_step(operator: str, session_id: str, params: dict[str, Any]) -> Any:
    """Dispatch a recorded operator step to its underlying deterministic function."""
    from data_analysis.catalog.semantic_store import get_semantic_store
    from data_analysis.operators.analytical_tools import (
        analyze_sensitivity,
        compare_metric,
        decompose_change,
    )
    from data_analysis.operators.business_report import generate_business_report
    from data_analysis.operators.eda import run_eda_profile
    from data_analysis.operators.olap import run_olap_query, run_pivot_table
    from data_analysis.operators.sandbox import run_duckdb_sql
    from data_analysis.schemas.requests import (
        BusinessReportRequest,
        DecompositionRequest,
        MetricCompareRequest,
        SensitivityRequest,
    )

    typed_map = {
        "compare_metric": (MetricCompareRequest, compare_metric),
        "decompose_change": (DecompositionRequest, decompose_change),
        "analyze_sensitivity": (SensitivityRequest, analyze_sensitivity),
        "generate_business_report": (BusinessReportRequest, generate_business_report),
    }

    if operator in typed_map:
        req_cls, fn = typed_map[operator]
        allowed_keys = set(req_cls.model_fields.keys())
        filtered = {k: v for k, v in params.items() if k in allowed_keys}
        return fn(req_cls(**filtered))

    if operator == "duckdb_sql_sandbox":
        return run_duckdb_sql(
            session_id=session_id,
            sql_query=params.get("sql_query", "SELECT 1"),
            limit=int(params.get("limit", 100)),
            governed=bool(params.get("governed", False)),
        )

    if operator == "query_semantic_metric":
        if "metric_names" in params:
            store = get_semantic_store(session_id)
            sql = store.compile_governed(
                params["metric_names"],
                params.get("dimensions"),
                params.get("filters"),
                params.get("order_by"),
                int(params.get("limit", 100)),
            )
            return run_duckdb_sql(
                session_id, sql, limit=int(params.get("limit", 100)), governed=True
            )
        return run_duckdb_sql(
            session_id=session_id,
            sql_query=params.get("sql_query", "SELECT 1"),
            limit=int(params.get("limit", 100)),
            governed=True,
        )

    if operator in ("eda_profile", "run_eda_profile"):
        return run_eda_profile(session_id, params["dataset_name"])

    if operator in ("memory_olap_aggregation", "run_olap_query", "olap"):
        return run_olap_query(
            session_id=session_id,
            dataset_name=params["dataset_name"],
            dimensions=params.get("dimensions", []),
            metrics=params.get("metrics", []),
            agg_funcs=params.get("agg_funcs"),
            filters=params.get("filters"),
            rollup=bool(params.get("rollup", False)),
            cube=bool(params.get("cube", False)),
            order_by=params.get("order_by"),
            limit=int(params.get("limit", 100)),
        )

    if operator in ("pivot_table", "run_pivot_table"):
        return run_pivot_table(
            session_id=session_id,
            dataset_name=params["dataset_name"],
            rows=params.get("rows", []),
            columns=params.get("columns", []),
            values=params.get("values", []),
            agg_func=params.get("agg_func", "SUM"),
            filters=params.get("filters"),
            limit=int(params.get("limit", 100)),
        )

    raise ValueError(f"Unsupported replay operator '{operator}'")


def get_trail_ledger(session_id: str) -> AnalysisTrailLedger:
    with AnalysisTrailLedger._lock:
        inst = AnalysisTrailLedger._session_instances.get(session_id)
        if inst is None:
            inst = AnalysisTrailLedger(session_id=session_id)
            AnalysisTrailLedger._session_instances[session_id] = inst
        return inst


def _forget_session(session_id: str) -> None:
    with AnalysisTrailLedger._lock:
        AnalysisTrailLedger._session_instances.pop(session_id, None)


def _register_session_cleanup() -> None:
    from data_analysis.cluster.session_manager import SessionManager

    SessionManager.add_close_listener(_forget_session)


_register_session_cleanup()
