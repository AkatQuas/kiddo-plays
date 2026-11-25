import hashlib
import json
import math
import threading
import uuid
from typing import Any

import duckdb

from data_analysis.catalog.meta_registry import TableAsset
from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.engine.sql_guard import (
    assert_mutation_sql,
    safe_ident,
    safe_predicate,
    safe_table_ref,
)
from data_analysis.ontology.action_type import ActionExecutionAudit, ActionParameter, ActionType
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType, PropertyMeta
from data_analysis.retl.webhook_pusher import WebhookPusher

_CARDINALITIES = {"ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"}
_HANDLERS = {"WEBHOOK", "SQL_MUTATION", "REVERSE_ETL_SYNC"}
_STRING_TYPES = {"string", "str", "varchar", "text"}
_INT_TYPES = {"integer", "int", "bigint"}
_FLOAT_TYPES = {"float", "double", "number", "numeric"}
_BOOL_TYPES = {"boolean", "bool"}
_JSON_TYPES = {"json", "object", "any"}
_SINGLE_TARGET = {"ONE_TO_ONE", "MANY_TO_ONE"}


class OntologyEngine:
    _instance = None
    _lock = threading.RLock()

    def __init__(self):
        self.db = MetadataDB.get_instance()
        self._object_types: dict[str, ObjectType] = {}
        self._link_types: dict[str, LinkType] = {}
        self._action_types: dict[str, ActionType] = {}
        self._restore_from_db()

    @classmethod
    def get_instance(cls) -> "OntologyEngine":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _restore_from_db(self):
        saved_objs = self.db.list_ontology_objects()
        for o in saved_objs:
            self._object_types[o["name"]] = ObjectType(**o)

        saved_links = self.db.list_ontology_links()
        for l in saved_links:
            self._link_types[l["name"]] = LinkType(**l)

        saved_actions = self.db.list_ontology_actions()
        for a in saved_actions:
            self._action_types[a["name"]] = ActionType(**a)

    # --- Schema Management ---
    def register_object_type(self, obj: ObjectType) -> ObjectType:
        with self._lock:
            self._validate_object_type(obj)
            self._object_types[obj.name] = obj
            self.db.save_ontology_object(obj.model_dump())
            return obj

    def get_object_type(self, name: str) -> ObjectType | None:
        with self._lock:
            return self._object_types.get(name)

    def list_object_types(self) -> list[ObjectType]:
        with self._lock:
            return list(self._object_types.values())

    def unregister_object_type(self, name: str) -> bool:
        """Drop an object type that nothing still points at."""
        with self._lock:
            if name not in self._object_types:
                return False
            used_links = [
                link.name
                for link in self._link_types.values()
                if link.source_object_type == name or link.target_object_type == name
            ]
            if used_links:
                raise ValueError(
                    f"ObjectType '{name}' is still referenced by links {used_links}. "
                    "Unregister those links first."
                )
            used_actions = [
                action.name
                for action in self._action_types.values()
                if action.target_object_type == name
            ]
            if used_actions:
                raise ValueError(
                    f"ObjectType '{name}' is still referenced by actions {used_actions}. "
                    "Unregister those actions first."
                )
            self.db.delete_ontology_object(name)
            self._object_types.pop(name, None)
            return True

    def register_from_catalog_asset(
        self,
        asset: TableAsset,
        *,
        name: str | None = None,
        primary_key: str | None = None,
    ) -> ObjectType:
        """Turn a catalog table asset into a registered object type."""
        obj = build_object_type_from_asset(asset, name=name, primary_key=primary_key)
        return self.register_object_type(obj)

    def register_link_type(self, link: LinkType) -> LinkType:
        with self._lock:
            link = self._validate_link_type(link)
            self._link_types[link.name] = link
            self.db.save_ontology_link(link.model_dump())
            return link

    def get_link_type(self, name: str) -> LinkType | None:
        with self._lock:
            return self._link_types.get(name)

    def list_link_types(self) -> list[LinkType]:
        with self._lock:
            return list(self._link_types.values())

    def unregister_link_type(self, name: str) -> bool:
        with self._lock:
            if name not in self._link_types:
                return False
            self.db.delete_ontology_link(name)
            self._link_types.pop(name, None)
            return True

    def register_action_type(self, action: ActionType) -> ActionType:
        with self._lock:
            action = self._validate_action_type(action)
            self._action_types[action.name] = action
            self.db.save_ontology_action(action.model_dump())
            return action

    def get_action_type(self, name: str) -> ActionType | None:
        with self._lock:
            return self._action_types.get(name)

    def list_action_types(self, target_object_type: str | None = None) -> list[ActionType]:
        with self._lock:
            actions = list(self._action_types.values())
            if target_object_type:
                actions = [a for a in actions if a.target_object_type == target_object_type]
            return actions

    def unregister_action_type(self, name: str) -> bool:
        with self._lock:
            if name not in self._action_types:
                return False
            self.db.delete_ontology_action(name)
            self._action_types.pop(name, None)
            return True

    def links_from(self, object_type_name: str) -> list[LinkType]:
        """Outgoing links used to plan the next drill-down hop."""
        with self._lock:
            if object_type_name not in self._object_types:
                raise ValueError(f"ObjectType '{object_type_name}' is not registered in Ontology.")
            return [
                link
                for link in self._link_types.values()
                if link.source_object_type == object_type_name
            ]

    def entity_graph(self) -> dict[str, Any]:
        """Adjacency of object types. Links whose endpoints are missing stay in broken_edges."""
        with self._lock:
            known = set(self._object_types)
            nodes = []
            for obj in self._object_types.values():
                nodes.append(
                    {
                        "id": obj.name,
                        "display_name": obj.display_name or obj.name,
                        "backed_by_table": obj.backed_by_table,
                        "primary_key": obj.primary_key,
                        "outgoing": [
                            link.name
                            for link in self._link_types.values()
                            if link.source_object_type == obj.name
                        ],
                        "incoming": [
                            link.name
                            for link in self._link_types.values()
                            if link.target_object_type == obj.name
                        ],
                    }
                )
            edges = []
            broken = []
            for link in self._link_types.values():
                edge = {
                    "id": link.name,
                    "source": link.source_object_type,
                    "target": link.target_object_type,
                    "cardinality": link.cardinality,
                    "source_join_key": link.source_join_key,
                    "target_join_key": link.target_join_key,
                }
                if link.source_object_type not in known or link.target_object_type not in known:
                    broken.append(edge)
                else:
                    edges.append(edge)
            return {"nodes": nodes, "edges": edges, "broken_edges": broken}

    def get_ontology_schema_summary(self) -> dict[str, Any]:
        """Return high-level schema of objects, links, and actions for AI Agent prompt context."""
        with self._lock:
            return {
                "object_types": [
                    {
                        "name": o.name,
                        "display_name": o.display_name or o.name,
                        "description": o.description,
                        "primary_key": o.primary_key,
                        "properties": [p.name for p in o.properties],
                        "available_actions": [
                            a.name
                            for a in self._action_types.values()
                            if a.target_object_type == o.name
                        ],
                    }
                    for o in self._object_types.values()
                ],
                "link_types": [
                    {
                        "name": l.name,
                        "source": l.source_object_type,
                        "target": l.target_object_type,
                        "cardinality": l.cardinality,
                    }
                    for l in self._link_types.values()
                ],
            }

    # --- Runtime Entity Instances & Graph Traversal ---
    def query_object_instances(
        self,
        con: duckdb.DuckDBPyConnection,
        object_type_name: str,
        filters: str | None = None,
        properties: list[str] | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Query real entity instances backed by DuckDB tables."""
        _require_positive_int(limit, "limit")
        with self._lock:
            obj = self._object_types.get(object_type_name)
            if not obj:
                raise ValueError(f"ObjectType '{object_type_name}' is not registered in Ontology.")
            select_cols = _query_select(obj, properties)
            table = safe_table_ref(obj.backed_by_table)
            where = f" WHERE {safe_predicate(filters)}" if filters else ""
            count_sql = f"SELECT COUNT(*) FROM {table}{where}"
            sql = f"SELECT {select_cols} FROM {table}{where} LIMIT ?"
            try:
                matched = con.execute(count_sql).fetchone()[0]
                df = con.execute(sql, [limit]).df()
            except duckdb.Error as exc:
                raise ValueError(
                    f"Failed to read ObjectType '{object_type_name}' from '{obj.backed_by_table}': {exc}"
                ) from exc
            instances = df.to_dict(orient="records")
            return {
                "object_type": object_type_name,
                "primary_key": obj.primary_key,
                "total_instances": len(instances),
                "matched_count": int(matched),
                "limit": limit,
                "instances": instances,
            }

    def traverse_links(
        self,
        con: duckdb.DuckDBPyConnection,
        source_object_type: str,
        source_instance_id: Any,
        link_name: str,
        limit: int = 50,
        link_path: list[str] | None = None,
        max_hops: int = 4,
    ) -> dict[str, Any]:
        """
        Graph Multi-Hop Traversal:
        Traverse from a source entity instance (e.g. Customer 'C01') along a link (e.g. 'customer_orders')
        to fetch all linked target entity instances (e.g. Orders).
        """
        _require_positive_int(limit, "limit")
        _require_positive_int(max_hops, "max_hops")
        hops = list(link_path) if link_path else [link_name]
        if not hops:
            raise ValueError("link_path is empty")
        if hops[0] != link_name:
            raise ValueError(f"link_path must start with link_name '{link_name}', got '{hops[0]}'")
        if len(hops) > max_hops:
            raise ValueError(f"Traversal length {len(hops)} exceeds max_hops={max_hops}")

        with self._lock:
            current_ids = [_plain(source_instance_id)]
            current_type = source_object_type
            path = [source_object_type]
            seen_types = {source_object_type}
            visited_instances = {(source_object_type, current_ids[0])}
            hop_counts: list[int] = []
            hop_details: list[dict[str, Any]] = []
            executed: list[str] = []
            last: list[dict[str, Any]] = []
            truncated = False
            warnings: list[str] = []
            for hop_name in hops:
                hop = self._link_types.get(hop_name)
                if hop is None:
                    raise ValueError(f"LinkType '{hop_name}' not found.")
                if hop.source_object_type != current_type:
                    raise ValueError(
                        f"Link '{hop_name}' expects source '{hop.source_object_type}', got '{current_type}'"
                    )
                reflexive = hop.target_object_type == hop.source_object_type
                if hop.target_object_type in seen_types and not reflexive:
                    raise ValueError(f"Cycle detected at '{hop.target_object_type}'")
                src_obj = self._object_types.get(hop.source_object_type)
                tgt_obj = self._object_types.get(hop.target_object_type)
                if src_obj is None or tgt_obj is None:
                    missing = hop.source_object_type if src_obj is None else hop.target_object_type
                    raise ValueError(
                        f"ObjectType '{missing}' referenced by link '{hop_name}' is not registered."
                    )
                rows, hit_limit = self._linked_rows(con, hop, src_obj, tgt_obj, current_ids, limit)
                if reflexive:
                    kept = []
                    for row in rows:
                        pk_value = _pk_of(row, tgt_obj.primary_key, tgt_obj.name)
                        marker = (tgt_obj.name, pk_value)
                        if marker in visited_instances:
                            continue
                        kept.append(row)
                    rows = kept
                last = rows
                hop_counts.append(len(last))
                pk_values: list[Any] = []
                seen_pk = set()
                for row in last:
                    pk_value = _pk_of(row, tgt_obj.primary_key, tgt_obj.name)
                    visited_instances.add((tgt_obj.name, pk_value))
                    if pk_value in seen_pk:
                        continue
                    seen_pk.add(pk_value)
                    pk_values.append(pk_value)
                warning = None
                if hop.cardinality in _SINGLE_TARGET and len(last) > 1:
                    warning = (
                        f"{hop.cardinality} link '{hop.name}' returned {len(last)} targets "
                        f"for one hop; the backing rows are not unique on the join."
                    )
                    warnings.append(warning)
                current_ids = pk_values
                current_type = tgt_obj.name
                path.append(current_type)
                seen_types.add(current_type)
                executed.append(hop_name)
                hop_details.append(
                    {
                        "link_name": hop_name,
                        "source_object_type": hop.source_object_type,
                        "target_object_type": tgt_obj.name,
                        "cardinality": hop.cardinality,
                        "count": len(last),
                        "instance_ids": list(pk_values),
                        "truncated": hit_limit,
                        "cardinality_warning": warning,
                    }
                )
                if hit_limit:
                    truncated = True
                if not current_ids:
                    break
            return {
                "source_object_type": source_object_type,
                "source_instance_id": source_instance_id,
                "link_name": executed[-1] if executed else link_name,
                "target_object_type": current_type,
                "hops": len(path) - 1,
                "requested_hops": len(hops),
                "path": path,
                "hop_counts": hop_counts,
                "hop_details": hop_details,
                "truncated": truncated,
                "cardinality_warnings": warnings,
                "linked_count": len(last),
                "linked_instances": last,
            }

    def _linked_rows(
        self,
        con: duckdb.DuckDBPyConnection,
        link: LinkType,
        src_obj: ObjectType,
        tgt_obj: ObjectType,
        source_ids: list[Any],
        limit: int,
    ) -> tuple[list[dict[str, Any]], bool]:
        if not source_ids:
            return [], False
        projection = _outer_projection(tgt_obj)
        placeholders = ", ".join(["?"] * len(source_ids))
        pk = safe_ident(tgt_obj.primary_key)
        inner = (
            f"SELECT tgt.* FROM {self._from_clause(link, src_obj, tgt_obj)} "
            f"WHERE src.{safe_ident(src_obj.primary_key)} IN ({placeholders})"
        )
        sql = f"SELECT DISTINCT {projection} FROM ({inner}) q ORDER BY {pk} LIMIT ?"
        try:
            df = con.execute(sql, [*source_ids, limit + 1]).df()
        except duckdb.Error as exc:
            raise ValueError(f"Traversal along '{link.name}' failed: {exc}") from exc
        rows = df.to_dict(orient="records")
        hit_limit = len(rows) > limit
        if hit_limit:
            rows = rows[:limit]
        return rows, hit_limit

    def _from_clause(self, link: LinkType, src_obj, tgt_obj) -> str:
        """FROM/JOIN fragment. MANY_TO_MANY goes through the junction table."""
        src_table = safe_table_ref(src_obj.backed_by_table)
        tgt_table = safe_table_ref(tgt_obj.backed_by_table)
        if link.cardinality == "MANY_TO_MANY":
            if not (link.junction_table and link.junction_source_key and link.junction_target_key):
                raise ValueError(
                    f"MANY_TO_MANY link '{link.name}' requires junction_table, "
                    "junction_source_key, and junction_target_key"
                )
            junction = safe_table_ref(link.junction_table)
            return (
                f"{tgt_table} tgt "
                f"JOIN {junction} j "
                f"ON j.{safe_ident(link.junction_target_key)} = tgt.{safe_ident(link.target_join_key)} "
                f"JOIN {src_table} src "
                f"ON src.{safe_ident(link.source_join_key)} = j.{safe_ident(link.junction_source_key)}"
            )
        return (
            f"{tgt_table} tgt "
            f"JOIN {src_table} src "
            f"ON src.{safe_ident(link.source_join_key)} = tgt.{safe_ident(link.target_join_key)}"
        )

    # --- Action Execution & Audit Trail ---
    def execute_action(
        self,
        con: duckdb.DuckDBPyConnection,
        action_name: str,
        instance_id: Any,
        parameter_values: dict[str, Any],
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """
        Execute an atomic business action on an object instance with validation and audit trail.
        """
        with self._lock:
            action = self._action_types.get(action_name)
            if not action:
                raise ValueError(f"ActionType '{action_name}' is not registered in Ontology.")
            params = _prepare_parameters(action, parameter_values)
            target_type = action.target_object_type
            handler = (action.handler_type or "").upper()
            config = dict(action.handler_config or {})
            display = action.display_name or action.name

        if dry_run:
            status = "SIMULATED"
            exec_result: dict[str, Any] = {"status": "SIMULATED", "params": params}
        else:
            status, exec_result = self._run_handler(
                con, action_name, target_type, handler, config, display, instance_id, params
            )

        audit_id = f"aud_{uuid.uuid4().hex[:10]}"
        audit_record = ActionExecutionAudit(
            audit_id=audit_id,
            action_name=action_name,
            target_object_type=target_type,
            target_instance_id=str(instance_id),
            parameters=params,
            status=status,
            execution_result=exec_result,
        )
        with self._lock:
            self.db.save_action_audit(audit_record.model_dump())
        return audit_record.model_dump()

    def _run_handler(
        self,
        con: duckdb.DuckDBPyConnection,
        action_name: str,
        target_type: str,
        handler: str,
        config: dict[str, Any],
        display: str,
        instance_id: Any,
        params: dict[str, Any],
    ) -> tuple[str, dict[str, Any]]:
        if handler == "WEBHOOK":
            return _run_webhook(action_name, target_type, config, display, instance_id, params)
        if handler == "SQL_MUTATION":
            return self._run_sql_mutation(con, target_type, config, instance_id, params)
        if handler == "REVERSE_ETL_SYNC":
            return _run_reverse_etl(con, config)
        return "FAILED", {
            "status": "FAILED",
            "message": f"Unsupported handler_type '{handler}'. Nothing was executed.",
        }

    def _run_sql_mutation(
        self,
        con: duckdb.DuckDBPyConnection,
        target_type: str,
        cfg: dict[str, Any],
        instance_id: Any,
        params: dict[str, Any],
    ) -> tuple[str, dict[str, Any]]:
        has_writeback = bool(cfg.get("writeback_table"))
        template = cfg.get("sql_template") or ""
        if has_writeback and template:
            return "FAILED", {
                "status": "FAILED",
                "message": "SQL_MUTATION cannot set both writeback_table and sql_template. Nothing was written.",
            }
        if not has_writeback and not template:
            return "FAILED", {
                "status": "FAILED",
                "message": "SQL_MUTATION needs writeback_table or sql_template. Nothing was written.",
            }
        before = self._snapshot_instance(con, target_type, instance_id)
        try:
            if has_writeback:
                wb = safe_table_ref(cfg["writeback_table"])
                value_param = cfg.get("value_param", "value")
                column_name = cfg.get("set_column", value_param)
                safe_ident(column_name)
                statement = (
                    f"INSERT INTO {wb} (instance_id, column_name, new_value, executed_at) "
                    "VALUES (?, ?, ?, current_timestamp)"
                )
                con.execute(
                    f"CREATE TABLE IF NOT EXISTS {wb} ("
                    "instance_id VARCHAR, column_name VARCHAR, new_value VARCHAR, executed_at TIMESTAMP)"
                )
                bound = [str(instance_id), str(column_name), str(params.get(value_param))]
                con.execute(statement, bound)
                after = {
                    "writeback_table": cfg["writeback_table"],
                    "column_name": column_name,
                    "new_value": bound[2],
                    "note": "Edit stored beside the source table. The backing table was not updated.",
                }
                return "SUCCESS", {
                    "status": "SUCCESS",
                    "writeback_table": cfg["writeback_table"],
                    "note": after["note"],
                    "before": before,
                    "after": after,
                    "statement_hash": _statement_hash(statement, bound),
                }
            subs = {"instance_id": instance_id, **params}
            for key, value in subs.items():
                if isinstance(value, str) and any(
                    token in value for token in ("'", '"', ";", "--", "/*")
                ):
                    raise ValueError(
                        f"Unsafe character in SQL_MUTATION parameter '{key}': {value!r}"
                    )
            formatted_sql = template.format(**subs)
            con.execute(formatted_sql)
            after = self._snapshot_instance(con, target_type, instance_id)
            return "SUCCESS", {
                "status": "SUCCESS",
                "executed_sql": formatted_sql,
                "before": before,
                "after": after,
                "statement_hash": _statement_hash(formatted_sql),
            }
        except duckdb.Error as exc:
            return "FAILED", {"status": "FAILED", "message": str(exc), "before": before}

    def _snapshot_instance(
        self, con: duckdb.DuckDBPyConnection, object_type_name: str, instance_id: Any
    ):
        with self._lock:
            obj = self._object_types.get(object_type_name)
        if obj is None:
            return None
        try:
            df = con.execute(
                f"SELECT * FROM {safe_table_ref(obj.backed_by_table)} WHERE {safe_ident(obj.primary_key)} = ?",
                [instance_id],
            ).df()
        except duckdb.Error:
            return None
        if df.empty:
            return None
        return json.loads(df.head(1).to_json(orient="records", date_format="iso"))[0]

    def list_action_audits(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            return self.db.list_action_audits(limit=limit)

    def _validate_object_type(self, obj: ObjectType) -> None:
        if not (obj.name or "").strip():
            raise ValueError("ObjectType name is required")
        if not (obj.primary_key or "").strip():
            raise ValueError(f"ObjectType '{obj.name}' requires a primary_key")
        if not (obj.backed_by_table or "").strip():
            raise ValueError(f"ObjectType '{obj.name}' requires backed_by_table")
        safe_ident(obj.primary_key)
        safe_table_ref(obj.backed_by_table)
        names = [prop.name for prop in obj.properties]
        if len(names) != len(set(names)):
            raise ValueError(f"ObjectType '{obj.name}' has duplicate properties")
        for prop in obj.properties:
            safe_ident(prop.name)
            if prop.formula:
                safe_predicate(prop.formula)
        flagged = [prop.name for prop in obj.properties if prop.is_primary_key]
        if flagged and flagged != [obj.primary_key]:
            raise ValueError(
                f"ObjectType '{obj.name}' primary_key is '{obj.primary_key}', "
                f"but is_primary_key is set on {flagged}"
            )
        if obj.title_property and obj.properties and obj.title_property not in names:
            raise ValueError(
                f"ObjectType '{obj.name}' title_property '{obj.title_property}' is not a declared property"
            )

    def _validate_link_type(self, link: LinkType) -> LinkType:
        if not (link.name or "").strip():
            raise ValueError("LinkType name is required")
        cardinality = (link.cardinality or "").upper()
        if cardinality not in _CARDINALITIES:
            raise ValueError(
                f"Link '{link.name}' cardinality '{link.cardinality}' is not one of "
                f"{sorted(_CARDINALITIES)}"
            )
        if link.source_object_type not in self._object_types:
            raise ValueError(
                f"Link '{link.name}' source '{link.source_object_type}' is not a registered ObjectType"
            )
        if link.target_object_type not in self._object_types:
            raise ValueError(
                f"Link '{link.name}' target '{link.target_object_type}' is not a registered ObjectType"
            )
        safe_ident(link.source_join_key)
        safe_ident(link.target_join_key)
        if cardinality == "MANY_TO_MANY":
            if not (link.junction_table and link.junction_source_key and link.junction_target_key):
                raise ValueError(
                    f"MANY_TO_MANY link '{link.name}' requires junction_table, "
                    "junction_source_key, and junction_target_key"
                )
            safe_table_ref(link.junction_table)
            safe_ident(link.junction_source_key)
            safe_ident(link.junction_target_key)
        if cardinality != link.cardinality:
            return link.model_copy(update={"cardinality": cardinality})
        return link

    def _validate_action_type(self, action: ActionType) -> ActionType:
        if not (action.name or "").strip():
            raise ValueError("ActionType name is required")
        handler = (action.handler_type or "").upper()
        if handler not in _HANDLERS:
            raise ValueError(
                f"Action '{action.name}' handler_type '{action.handler_type}' is not one of {sorted(_HANDLERS)}"
            )
        # Target ObjectType is recommended but not required at registration time
        # (callers may register actions before objects; execute still resolves the target).
        param_names = [param.name for param in action.parameters]
        if len(param_names) != len(set(param_names)):
            raise ValueError(f"Action '{action.name}' has duplicate parameters")
        for param in action.parameters:
            _normalize_param_type(param.data_type)
        cfg = action.handler_config or {}
        if handler == "SQL_MUTATION":
            has_writeback = bool(cfg.get("writeback_table"))
            has_template = bool(cfg.get("sql_template"))
            if has_writeback and has_template:
                raise ValueError(
                    f"Action '{action.name}' cannot set both writeback_table and sql_template"
                )
            if not has_writeback and not has_template:
                raise ValueError(
                    f"Action '{action.name}' SQL_MUTATION needs writeback_table or sql_template"
                )
            if has_writeback:
                safe_table_ref(cfg["writeback_table"])
                if cfg.get("set_column"):
                    safe_ident(cfg["set_column"])
            if has_template:
                # Validate template shape at registration (B security): reject DDL/COPY/ATTACH etc.
                fields = [param.name for param in action.parameters] + ["instance_id"]
                try:
                    sample = (cfg.get("sql_template") or "").format(
                        **{name: "x" for name in fields}
                    )
                except Exception as exc:
                    raise ValueError(
                        f"Action '{action.name}' sql_template is not a valid format string: {exc}"
                    ) from exc
                assert_mutation_sql(sample)
        if handler != action.handler_type:
            return action.model_copy(update={"handler_type": handler})
        return action


def build_object_type_from_asset(
    asset: TableAsset,
    *,
    name: str | None = None,
    primary_key: str | None = None,
) -> ObjectType:
    """Map a catalog table asset onto an object type. Does not register it."""
    dataset = (asset.dataset_name or "").strip()
    if not dataset:
        raise ValueError("Catalog asset dataset_name is required")
    columns = list(asset.columns or [])
    if not columns:
        raise ValueError(f"Catalog asset '{dataset}' has no columns to model")
    names = [col.name for col in columns]
    if len(names) != len(set(names)):
        raise ValueError(f"Catalog asset '{dataset}' has duplicate columns")
    flagged = [col.name for col in columns if col.is_primary_key]
    if primary_key:
        pk = primary_key
    elif len(flagged) == 1:
        pk = flagged[0]
    else:
        identifiers = [
            col.name
            for col in columns
            if (col.semantic_type or "").upper() == "IDENTIFIER" and not col.is_primary_key
        ]
        if len(flagged) == 0 and len(identifiers) == 1:
            pk = identifiers[0]
        else:
            raise ValueError(
                f"Cannot infer primary key for catalog asset '{dataset}'. "
                "Pass primary_key= or mark exactly one column is_primary_key."
            )
    if pk not in names:
        raise ValueError(f"Primary key '{pk}' is not a column of catalog asset '{dataset}'")
    properties = [
        PropertyMeta(
            name=col.name,
            data_type=col.data_type,
            description=col.description or "",
            is_primary_key=(col.name == pk),
        )
        for col in columns
    ]
    return ObjectType(
        name=name or dataset,
        display_name=asset.display_name or name or dataset,
        description=asset.description or "",
        primary_key=pk,
        backed_by_table=dataset,
        properties=properties,
        tags=list(asset.tags or []),
    )


def _query_select(obj: ObjectType, properties: list[str] | None) -> str:
    declared = {prop.name: prop for prop in obj.properties}
    if properties:
        if declared:
            unknown = [name for name in properties if name not in declared]
            if unknown:
                raise ValueError(
                    f"ObjectType '{obj.name}' has no property {unknown}. Declared: {list(declared)}"
                )
        parts = []
        for name in properties:
            prop = declared.get(name)
            if prop is not None and prop.formula:
                parts.append(f"({safe_predicate(prop.formula)}) AS {safe_ident(name)}")
            else:
                parts.append(safe_ident(name))
        return ", ".join(parts)
    formulas = [prop for prop in obj.properties if prop.formula]
    if not formulas:
        return "*"
    extra = ", ".join(
        f"({safe_predicate(prop.formula)}) AS {safe_ident(prop.name)}" for prop in formulas
    )
    return f"*, {extra}"


def _outer_projection(obj: ObjectType) -> str:
    """Project the target after the join, so formulas are not ambiguous with the source table."""
    if not obj.properties:
        return "*"
    parts = []
    names = {prop.name for prop in obj.properties}
    if obj.primary_key not in names:
        parts.append(safe_ident(obj.primary_key))
    for prop in obj.properties:
        if prop.formula:
            parts.append(f"({safe_predicate(prop.formula)}) AS {safe_ident(prop.name)}")
        else:
            parts.append(safe_ident(prop.name))
    return ", ".join(parts)


def _prepare_parameters(
    action: ActionType, parameter_values: dict[str, Any] | None
) -> dict[str, Any]:
    params = dict(parameter_values or {})
    for param in action.parameters:
        if param.name not in params:
            if param.default_value is not None:
                params[param.name] = param.default_value
            elif param.required:
                raise ValueError(
                    f"Required parameter '{param.name}' missing for action '{action.name}'"
                )
        if param.name in params and params[param.name] is not None:
            _check_param_type(action.name, param, params[param.name])
    return params


def _normalize_param_type(data_type: str) -> str:
    kind = (data_type or "").strip().lower()
    if kind in _STRING_TYPES:
        return "string"
    if kind in _INT_TYPES:
        return "integer"
    if kind in _FLOAT_TYPES:
        return "float"
    if kind in _BOOL_TYPES:
        return "boolean"
    if kind in _JSON_TYPES:
        return "json"
    raise ValueError(f"Unsupported parameter data_type '{data_type}'")


def _check_param_type(action_name: str, param: ActionParameter, value: Any) -> None:
    kind = _normalize_param_type(param.data_type)
    ok = True
    if kind == "string":
        ok = isinstance(value, str)
    elif kind == "integer":
        ok = isinstance(value, int) and not isinstance(value, bool)
    elif kind == "float":
        ok = isinstance(value, (int, float)) and not isinstance(value, bool)
    elif kind == "boolean":
        ok = isinstance(value, bool)
    if not ok:
        raise ValueError(
            f"Parameter '{param.name}' for action '{action_name}' expects {kind}, got {type(value).__name__}"
        )


def _run_webhook(
    action_name: str,
    target_type: str,
    cfg: dict[str, Any],
    display: str,
    instance_id: Any,
    params: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    webhook_url = cfg.get("webhook_url", "http://127.0.0.1:8000/api/v1/mock_webhook")
    platform = cfg.get("platform", "generic")
    title = f"【Ontology 动作触发】{display}"
    message = f"针对实体对象 [{target_type}#{instance_id}] 触发了动作：{action_name}"
    try:
        exec_result = WebhookPusher.send_alert(
            webhook_url, title, message, platform, extra_metrics=params
        )
    except Exception as exc:
        return "FAILED", {"status": "FAILED", "message": str(exc)}
    # Failure responses still carry simulated_payload for debugging.
    # That field does not mean the webhook was delivered.
    if exec_result.get("status") == "FAILED":
        return "FAILED", exec_result
    return "SUCCESS", exec_result


def _run_reverse_etl(
    con: duckdb.DuckDBPyConnection, cfg: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    # B security: ontology REVERSE_ETL_SYNC is intentionally not implemented.
    # Use reverse_sync_destination / DestinationSync instead (reach-guarded).
    return "FAILED", {
        "status": "NOT_IMPLEMENTED",
        "message": "REVERSE_ETL_SYNC actions are not implemented; use reverse_sync_destination",
    }


def _require_positive_int(value: Any, label: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{label} must be a positive integer")


def _plain(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return item()
        except Exception:
            return value
    return value


def _pk_of(row: dict[str, Any], primary_key: str, type_name: str) -> Any:
    if primary_key not in row:
        raise ValueError(f"ObjectType '{type_name}' row has no primary key column '{primary_key}'")
    value = _plain(row[primary_key])
    if value is None or (isinstance(value, float) and math.isnan(value)):
        raise ValueError(f"ObjectType '{type_name}' row is missing primary key '{primary_key}'")
    return value


def _statement_hash(statement: str, bound: list[Any] | None = None) -> str:
    payload = statement if not bound else statement + "|" + json.dumps(bound, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def get_ontology_engine() -> OntologyEngine:
    return OntologyEngine.get_instance()
