"""Hex Context Studio-style Proactive Context Observability & Health Auditor.

Audits a session's analytical trail, catalog assets, semantic metrics, and guides
to surface AI/Agent friction points, ungoverned query risks, frequent caveats,
and actionable governance recommendations.
"""

from collections import Counter
from typing import Any

from data_analysis.catalog.context_studio import get_context_studio
from data_analysis.catalog.meta_registry import get_meta_registry
from data_analysis.catalog.semantic_store import get_semantic_store
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.copilot.analysis_trail import get_trail_ledger


class ContextHealthAuditor:
    """Proactive governance and context health auditor."""

    @staticmethod
    def audit_session_health(session_id: str) -> dict[str, Any]:
        cat = get_meta_registry(session_id)
        store = get_semantic_store(session_id)
        studio = get_context_studio(session_id)
        ledger = get_trail_ledger(session_id)
        sess = SessionManager().get_session(session_id)

        tables = cat.list_tables()
        metrics = store.list_metrics()
        models = store.list_models()
        guides = studio.list_guides()
        rules = studio.get_workspace_rules()
        steps = ledger.list_steps(limit=500)

        loaded_datasets = list(sess.datasets.keys()) if sess else [t.dataset_name for t in tables]
        table_by_name = {t.dataset_name: t for t in tables}

        total_tables = max(len(loaded_datasets), len(tables))
        endorsed_tables = [t for t in tables if (t.endorsement_status or "draft") == "endorsed"]
        deprecated_tables = [t for t in tables if (t.endorsement_status or "draft") == "deprecated"]
        draft_tables = [t for t in tables if (t.endorsement_status or "draft") == "draft"]

        endorsed_metrics = [m for m in metrics if (m.endorsement_status or "draft") == "endorsed"]
        tables_with_metrics = {m.table_name for m in metrics}
        tables_without_metrics = [d for d in loaded_datasets if d not in tables_with_metrics]

        total_steps = len(steps)
        ungoverned_steps = [s for s in steps if s.ungoverned_sql]
        steps_with_warnings = [s for s in steps if s.warnings]
        high_null_drop_steps = [
            s
            for s in steps
            if (s.nulls_dropped or 0) > 0
            and (s.rows_scanned or 0) > 0
            and (s.nulls_dropped / max(1, s.rows_scanned)) >= 0.05
        ]

        warning_counter: Counter = Counter()
        operator_counter: Counter = Counter()
        queried_unendorsed: list[str] = []

        for s in steps:
            operator_counter[s.operator] += 1
            for w in s.warnings:
                warning_counter[w] += 1
            if s.dataset_name:
                t_asset = table_by_name.get(s.dataset_name)
                st = (t_asset.endorsement_status if t_asset else "draft").lower()
                if st != "endorsed" and s.dataset_name not in queried_unendorsed:
                    queried_unendorsed.append(s.dataset_name)

        proactive_warnings: list[dict[str, Any]] = []
        recommendations: list[str] = []

        if ungoverned_steps:
            ratio = round(len(ungoverned_steps) / max(1, total_steps) * 100, 1)
            proactive_warnings.append(
                {
                    "code": "UNGOVERNED_SQL_USAGE",
                    "severity": "medium" if ratio < 50 else "high",
                    "message": f"{len(ungoverned_steps)}/{total_steps} ({ratio}%) steps executed ad-hoc ungoverned SQL instead of governed semantic metrics or typed tools.",
                }
            )
            recommendations.append(
                "Register frequently queried formulas in SemanticMetricStore (`register_semantic_metric` or `import_dbt_semantic_yaml`) to eliminate ad-hoc SQL drift."
            )

        if queried_unendorsed:
            proactive_warnings.append(
                {
                    "code": "UNENDORSED_ASSET_QUERIED",
                    "severity": "medium",
                    "message": f"Agent queried unendorsed/draft dataset(s): {', '.join(queried_unendorsed)}.",
                }
            )
            recommendations.append(
                f"Review and endorse authoritative tables ({', '.join(queried_unendorsed)}) via `endorse_context_asset`, or enable `endorsed_only_default=True`."
            )

        if tables_without_metrics:
            proactive_warnings.append(
                {
                    "code": "MISSING_SEMANTIC_METRICS",
                    "severity": "low",
                    "message": f"Datasets without any semantic metric definitions: {', '.join(tables_without_metrics)}.",
                }
            )
            recommendations.append(
                f"Define standardized metrics for {', '.join(tables_without_metrics)} so Agents do not guess column aggregation formulas."
            )

        if not guides and not rules.system_rules:
            proactive_warnings.append(
                {
                    "code": "EMPTY_BUSINESS_CONTEXT",
                    "severity": "low",
                    "message": "No workspace rules or business context guides registered for this session.",
                }
            )
            recommendations.append(
                "Add domain rules and accounting definitions using `register_context_guide` or `set_workspace_context_rules`."
            )

        if high_null_drop_steps:
            proactive_warnings.append(
                {
                    "code": "HIGH_INVALID_ROW_EXCLUSION",
                    "severity": "high",
                    "message": f"{len(high_null_drop_steps)} analysis step(s) dropped >=5% rows due to invalid time/metric values.",
                }
            )
            recommendations.append(
                "Run `execute_data_cleaning` or `assert_data_quality` to inspect and remediate malformed dates/numerics."
            )

        # Compute deterministic 0-100 context health score
        score = 100.0
        if total_tables > 0:
            endorsed_ratio = len(endorsed_tables) / total_tables
            score -= (1.0 - endorsed_ratio) * 20.0
        if tables_without_metrics and total_tables > 0:
            score -= (len(tables_without_metrics) / total_tables) * 15.0
        if not guides and not rules.system_rules:
            score -= 10.0
        if total_steps > 0:
            ungov_ratio = len(ungoverned_steps) / total_steps
            score -= ungov_ratio * 25.0
            warn_ratio = len(steps_with_warnings) / total_steps
            score -= warn_ratio * 15.0
        if high_null_drop_steps:
            score -= 15.0
        health_score = max(0.0, round(score, 1))

        return {
            "session_id": session_id,
            "context_health_score": health_score,
            "coverage": {
                "loaded_datasets": len(loaded_datasets),
                "catalog_tables": len(tables),
                "endorsed_tables": len(endorsed_tables),
                "draft_tables": len(draft_tables),
                "deprecated_tables": len(deprecated_tables),
                "semantic_models": len(models),
                "semantic_metrics": len(metrics),
                "endorsed_metrics": len(endorsed_metrics),
                "context_guides": len(guides),
                "has_workspace_rules": bool(rules.system_rules),
                "endorsed_only_default": rules.endorsed_only_default,
            },
            "trail_telemetry": {
                "total_steps": total_steps,
                "ungoverned_sql_steps": len(ungoverned_steps),
                "steps_with_warnings": len(steps_with_warnings),
                "high_null_drop_steps": len(high_null_drop_steps),
                "operator_breakdown": dict(operator_counter),
                "top_warnings": [
                    {"warning": w, "count": c} for w, c in warning_counter.most_common(5)
                ],
            },
            "proactive_warnings": proactive_warnings,
            "recommendations": recommendations,
        }
