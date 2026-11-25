"""Hex-style Context Studio: four-layer context traversal & governance.

Manages:
1. Workspace Context (global / per-session system rules, naming conventions, endorsed_only_default)
2. Business Guides (Markdown domain knowledge & SOPs bound to workspace, tables, or metrics)
3. Semantic Models & Metrics (governed formulas & join paths)
4. Endorsements (trust tiers: endorsed / draft / deprecated / warning)
"""

import threading
import time
from typing import Any, Literal

from pydantic import BaseModel, Field

from data_analysis.catalog.meta_registry import get_meta_registry
from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.catalog.semantic_store import get_semantic_store


class WorkspaceContextRule(BaseModel):
    session_id: str = "_global"
    system_rules: str = ""
    endorsed_only_default: bool = False
    naming_conventions: dict[str, str] = Field(default_factory=dict)
    updated_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


class ContextGuide(BaseModel):
    name: str
    title: str
    content: str
    scope: Literal["workspace", "table", "metric", "model"] = "workspace"
    target_names: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    endorsement_status: Literal["endorsed", "draft", "deprecated", "warning"] = "endorsed"
    updated_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


class ContextStudio:
    """Session-isolated or persistent Context Studio registry."""

    _instance = None
    _lock = threading.RLock()
    _session_instances: dict[str, "ContextStudio"] = {}

    def __init__(self, session_id: str = "_global", persistent: bool = True):
        self.session_id = session_id
        self.persistent = persistent
        self.db = MetadataDB.get_instance() if persistent else None
        self._rule: WorkspaceContextRule | None = None
        self._guides: dict[str, ContextGuide] = {}
        if self.persistent and self.db is not None:
            saved_rule = self.db.get_workspace_rule(session_id)
            if saved_rule:
                self._rule = WorkspaceContextRule(**saved_rule)
            for g in self.db.list_context_guides():
                self._guides[g["name"]] = ContextGuide(**g)

    def set_workspace_rules(
        self,
        system_rules: str,
        endorsed_only_default: bool = False,
        naming_conventions: dict[str, str] | None = None,
    ) -> WorkspaceContextRule:
        with self._lock:
            now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            rule = WorkspaceContextRule(
                session_id=self.session_id,
                system_rules=system_rules or "",
                endorsed_only_default=bool(endorsed_only_default),
                naming_conventions=dict(naming_conventions or {}),
                updated_at=now_str,
            )
            self._rule = rule
            if self.persistent and self.db is not None:
                self.db.save_workspace_rule(self.session_id, rule.model_dump())
            return rule

    def get_workspace_rules(self) -> WorkspaceContextRule:
        with self._lock:
            if self._rule is not None:
                return self._rule
            if self.session_id != "_global":
                global_studio = get_context_studio("_global")
                if global_studio._rule is not None:
                    return global_studio._rule
            return WorkspaceContextRule(session_id=self.session_id)

    def register_guide(self, guide: ContextGuide) -> ContextGuide:
        with self._lock:
            guide.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self._guides[guide.name] = guide
            if self.persistent and self.db is not None:
                self.db.save_context_guide(guide.model_dump())
            return guide

    def list_guides(
        self,
        scope: str | None = None,
        target_name: str | None = None,
        endorsed_only: bool = False,
    ) -> list[ContextGuide]:
        with self._lock:
            guides = list(self._guides.values())
            if self.session_id != "_global":
                global_guides = get_context_studio("_global")._guides
                for k, v in global_guides.items():
                    if k not in self._guides:
                        guides.append(v)
            if scope:
                guides = [g for g in guides if g.scope == scope]
            if target_name:
                guides = [
                    g for g in guides if g.scope == "workspace" or target_name in g.target_names
                ]
            if endorsed_only:
                guides = [g for g in guides if g.endorsement_status == "endorsed"]
            return guides

    def endorse_asset(
        self,
        asset_type: Literal["table", "metric", "model", "guide"],
        name: str,
        status: Literal["endorsed", "draft", "deprecated", "warning"] = "endorsed",
        endorsement_note: str = "",
        endorsed_by: str | None = None,
    ) -> dict[str, Any]:
        t = (asset_type or "").strip().lower()
        if t == "table":
            cat = get_meta_registry(self.session_id)
            asset = cat.endorse_table(
                name, status=status, endorsement_note=endorsement_note, endorsed_by=endorsed_by
            )
            return {
                "asset_type": "table",
                "name": name,
                "status": asset.endorsement_status,
                "asset": asset.model_dump(),
            }
        if t == "metric":
            store = get_semantic_store(self.session_id)
            metric = store.endorse_metric(
                name, status=status, endorsement_note=endorsement_note, endorsed_by=endorsed_by
            )
            return {
                "asset_type": "metric",
                "name": name,
                "status": metric.endorsement_status,
                "asset": metric.model_dump(),
            }
        if t == "model":
            store = get_semantic_store(self.session_id)
            model = store.endorse_model(
                name, status=status, endorsement_note=endorsement_note, endorsed_by=endorsed_by
            )
            return {
                "asset_type": "model",
                "name": name,
                "status": model.endorsement_status,
                "asset": model.model_dump(),
            }
        if t == "guide":
            with self._lock:
                guide = self._guides.get(name)
                if guide is None:
                    raise ValueError(f"Context guide '{name}' not found")
                guide.endorsement_status = status
                self.register_guide(guide)
                return {
                    "asset_type": "guide",
                    "name": name,
                    "status": guide.endorsement_status,
                    "asset": guide.model_dump(),
                }
        raise ValueError(
            f"Unsupported asset_type {asset_type!r}; expected table, metric, model, or guide"
        )

    def resolve_hierarchy(
        self,
        dataset_name: str | None = None,
        metric_names: list[str] | None = None,
        endorsed_only: bool | None = None,
    ) -> dict[str, Any]:
        """Traverse the 4-layer Context Hierarchy for an Agent prompt or analytical step.

        Layer 1: Workspace Context (system rules & conventions)
        Layer 2: Business Guides (relevant to workspace, dataset_name, or metric_names)
        Layer 3: Semantic Models & Metrics (filtered by endorsed_only if requested)
        Layer 4: Endorsement Guardrails (endorsed vs draft/deprecated table assets & warnings)
        """
        rule = self.get_workspace_rules()
        use_endorsed_only = (
            rule.endorsed_only_default if endorsed_only is None else bool(endorsed_only)
        )

        cat = get_meta_registry(self.session_id)
        store = get_semantic_store(self.session_id)

        all_tables = cat.list_tables()
        all_models = store.list_models()
        all_metrics = store.list_metrics()

        if dataset_name:
            relevant_tables = [t for t in all_tables if t.dataset_name == dataset_name]
        else:
            relevant_tables = all_tables

        if metric_names:
            relevant_metrics = [m for m in all_metrics if m.name in metric_names]
        else:
            relevant_metrics = all_metrics

        warnings: list[str] = []
        for t in relevant_tables:
            st = (t.endorsement_status or "draft").lower()
            if st == "deprecated":
                warnings.append(f"Table '{t.dataset_name}' is DEPRECATED: {t.endorsement_note}")
            elif use_endorsed_only and st != "endorsed":
                warnings.append(
                    f"Table '{t.dataset_name}' has status '{st}' and is excluded in Endorsed Mode."
                )

        for m in relevant_metrics:
            st = (m.endorsement_status or "draft").lower()
            if st == "deprecated":
                warnings.append(f"Metric '{m.name}' is DEPRECATED: {m.endorsement_note}")
            elif use_endorsed_only and st != "endorsed":
                warnings.append(
                    f"Metric '{m.name}' has status '{st}' and is excluded in Endorsed Mode."
                )

        if use_endorsed_only:
            tables_out = [
                t.model_dump() for t in relevant_tables if t.endorsement_status == "endorsed"
            ]
            models_out = [m.model_dump() for m in all_models if m.endorsement_status == "endorsed"]
            metrics_out = [
                m.model_dump() for m in relevant_metrics if m.endorsement_status == "endorsed"
            ]
        else:
            tables_out = [t.model_dump() for t in relevant_tables]
            models_out = [m.model_dump() for m in all_models]
            metrics_out = [m.model_dump() for m in relevant_metrics]

        guides = self.list_guides(endorsed_only=use_endorsed_only)
        target_filter = set()
        if dataset_name:
            target_filter.add(dataset_name)
        if metric_names:
            target_filter.update(metric_names)
        if target_filter:
            guides = [
                g
                for g in guides
                if g.scope == "workspace"
                or not g.target_names
                or bool(target_filter.intersection(g.target_names))
            ]

        return {
            "session_id": self.session_id,
            "endorsed_mode": use_endorsed_only,
            "hierarchy": {
                "1_workspace_context": rule.model_dump(),
                "2_guides": [g.model_dump() for g in guides],
                "3_semantic_layer": {
                    "models": models_out,
                    "metrics": metrics_out,
                },
                "4_endorsements": {
                    "tables": tables_out,
                    "endorsed_table_count": sum(
                        1 for t in all_tables if t.endorsement_status == "endorsed"
                    ),
                    "draft_table_count": sum(
                        1 for t in all_tables if t.endorsement_status == "draft"
                    ),
                    "deprecated_table_count": sum(
                        1 for t in all_tables if t.endorsement_status == "deprecated"
                    ),
                    "endorsed_metric_count": sum(
                        1 for m in all_metrics if m.endorsement_status == "endorsed"
                    ),
                },
            },
            "proactive_warnings": warnings,
        }


def get_context_studio(session_id: str = "_global") -> ContextStudio:
    with ContextStudio._lock:
        inst = ContextStudio._session_instances.get(session_id)
        if inst is None:
            inst = ContextStudio(session_id=session_id, persistent=(session_id == "_global"))
            ContextStudio._session_instances[session_id] = inst
        if session_id == "_global":
            ContextStudio._instance = inst
        return inst


def _forget_session(session_id: str) -> None:
    with ContextStudio._lock:
        ContextStudio._session_instances.pop(session_id, None)


def _register_session_cleanup() -> None:
    from data_analysis.cluster.session_manager import SessionManager

    SessionManager.add_close_listener(_forget_session)


_register_session_cleanup()
