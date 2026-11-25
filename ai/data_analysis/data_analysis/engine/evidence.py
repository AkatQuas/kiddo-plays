"""Standard evidence envelope attached to operator results.

Callers narrate these fields. They do not recompute them.
"""

from __future__ import annotations

import time
from typing import Any


def evidence(
    *,
    operator: str,
    sql: list[str] | None = None,
    rows_scanned: int | None = None,
    rows_used: int | None = None,
    nulls_dropped: int | None = None,
    duration_ms: float | None = None,
    caveats: list[str] | None = None,
    method: str | None = None,
    session_id: str | None = None,
    dataset_name: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ev = {
        "operator": operator,
        "method": method,
        "sql": list(sql or []),
        "rows_scanned": rows_scanned,
        "rows_used": rows_used,
        "nulls_dropped": nulls_dropped,
        "duration_ms": duration_ms,
        "caveats": list(caveats or []),
    }
    if session_id:
        try:
            from data_analysis.copilot.analysis_trail import get_trail_ledger

            get_trail_ledger(session_id).record_step(
                operator=operator,
                method=method,
                dataset_name=dataset_name,
                parameters=parameters or {},
                summary=f"{operator} ({method or 'default'})",
                sql=ev["sql"],
                warnings=ev["caveats"],
                duration_ms=duration_ms,
                rows_scanned=rows_scanned,
                rows_used=rows_used,
                nulls_dropped=nulls_dropped,
            )
        except Exception:
            pass
    return ev


class Stopwatch:
    def __init__(self) -> None:
        self._t = time.perf_counter()

    def ms(self) -> float:
        return round((time.perf_counter() - self._t) * 1000, 2)


def structured_evidence(
    *,
    operator,
    method,
    session_id,
    dataset_name,
    parameters,
    population,
    metric_semantics,
    time_semantics,
    assumptions,
    warnings,
    truncation,
    sql,
    duration_ms,
):
    """Versioned contract for composable tools and reports; legacy evidence stays compatible."""
    import hashlib

    from data_analysis.schemas.responses import ToolEvidence

    statements = list(sql)
    ev_dict = ToolEvidence(
        operator=operator,
        method=method,
        session_id=session_id,
        dataset_name=dataset_name,
        parameters=parameters,
        population=population,
        metric_semantics=metric_semantics,
        time_semantics=time_semantics,
        assumptions=assumptions,
        warnings=warnings,
        truncation=truncation,
        sql=statements,
        query_sha256=hashlib.sha256("\n".join(statements).encode()).hexdigest(),
        duration_ms=duration_ms,
        causal_claim=False,
    ).model_dump(mode="json")
    if session_id:
        try:
            from data_analysis.copilot.analysis_trail import get_trail_ledger

            pop = population or {}
            get_trail_ledger(session_id).record_step(
                operator=operator,
                method=method,
                dataset_name=dataset_name,
                parameters=parameters or {},
                summary=f"{operator} [{method}] on {dataset_name}",
                sql=statements,
                warnings=list(warnings or []),
                duration_ms=duration_ms,
                rows_scanned=pop.get("filtered_source_rows"),
                rows_used=(pop.get("base_rows") or 0) + (pop.get("current_rows") or 0)
                if ("base_rows" in pop or "current_rows" in pop)
                else None,
                nulls_dropped=(pop.get("invalid_time_rows") or 0)
                + (pop.get("invalid_metric_rows") or 0),
                evidence_v2=ev_dict,
            )
        except Exception:
            pass
    return ev_dict
