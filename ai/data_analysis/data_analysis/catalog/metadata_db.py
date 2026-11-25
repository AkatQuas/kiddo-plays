import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any


class MetadataDB:
    _instance = None
    _lock = threading.RLock()

    def __init__(self, db_path: str = "data/catalog_metadata.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_tables()

    @classmethod
    def get_instance(cls) -> "MetadataDB":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_tables(self):
        with self._get_conn() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS catalog_tables (
                dataset_name TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                table_type TEXT,
                owner TEXT,
                tags_json TEXT,
                row_count INTEGER,
                column_count INTEGER,
                columns_json TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS semantic_metrics (
                name TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                table_name TEXT,
                formula TEXT,
                aggregation_type TEXT,
                dimensions_json TEXT,
                filter_expr TEXT,
                format TEXT,
                numerator_metric TEXT,
                denominator_metric TEXT,
                created_at TEXT
            );

                        CREATE TABLE IF NOT EXISTS ontology_objects (
                name TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                primary_key TEXT,
                title_property TEXT,
                backed_by_table TEXT,
                properties_json TEXT,
                tags_json TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS ontology_links (
                name TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                source_object_type TEXT,
                target_object_type TEXT,
                cardinality TEXT,
                source_join_key TEXT,
                target_join_key TEXT,
                junction_table TEXT,
                junction_source_key TEXT,
                junction_target_key TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS ontology_actions (
                name TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                target_object_type TEXT,
                parameters_json TEXT,
                handler_type TEXT,
                handler_config_json TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS ontology_action_audit (
                audit_id TEXT PRIMARY KEY,
                action_name TEXT,
                target_object_type TEXT,
                target_instance_id TEXT,
                parameters_json TEXT,
                status TEXT,
                execution_result_json TEXT,
                executed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS dag_models_meta (
                name TEXT PRIMARY KEY,
                sql TEXT,
                materialization TEXT,
                depends_on_json TEXT,
                description TEXT,
                unique_key TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS semantic_models (
                name TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                grain_json TEXT,
                columns_json TEXT,
                entities_json TEXT,
                agg_time_dimension TEXT
            );
            CREATE TABLE IF NOT EXISTS lineage_edges (
                source_table TEXT NOT NULL,
                target_table TEXT NOT NULL,
                PRIMARY KEY (source_table, target_table)
            );
            CREATE TABLE IF NOT EXISTS context_guides (
                name TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                scope TEXT,
                target_names_json TEXT,
                tags_json TEXT,
                endorsement_status TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS workspace_rules (
                session_id TEXT PRIMARY KEY,
                system_rules TEXT,
                endorsed_only_default INTEGER,
                naming_conventions_json TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS analysis_playbooks (
                playbook_id TEXT PRIMARY KEY,
                session_id TEXT,
                title TEXT,
                description TEXT,
                steps_json TEXT,
                parameters_json TEXT,
                endorsement_status TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            """)
            for stmt in (
                "ALTER TABLE semantic_metrics ADD COLUMN numerator_metric TEXT",
                "ALTER TABLE semantic_metrics ADD COLUMN denominator_metric TEXT",
                "ALTER TABLE semantic_metrics ADD COLUMN endorsement_status TEXT DEFAULT 'draft'",
                "ALTER TABLE semantic_metrics ADD COLUMN endorsement_note TEXT DEFAULT ''",
                "ALTER TABLE semantic_metrics ADD COLUMN endorsed_by TEXT",
                "ALTER TABLE catalog_tables ADD COLUMN endorsement_status TEXT DEFAULT 'draft'",
                "ALTER TABLE catalog_tables ADD COLUMN endorsement_note TEXT DEFAULT ''",
                "ALTER TABLE catalog_tables ADD COLUMN endorsed_by TEXT",
                "ALTER TABLE semantic_models ADD COLUMN endorsement_status TEXT DEFAULT 'draft'",
                "ALTER TABLE semantic_models ADD COLUMN endorsement_note TEXT DEFAULT ''",
                "ALTER TABLE semantic_models ADD COLUMN endorsed_by TEXT",
                "ALTER TABLE ontology_links ADD COLUMN junction_table TEXT",
                "ALTER TABLE ontology_links ADD COLUMN junction_source_key TEXT",
                "ALTER TABLE ontology_links ADD COLUMN junction_target_key TEXT",
                "ALTER TABLE dag_models_meta ADD COLUMN unique_key TEXT",
            ):
                try:
                    conn.execute(stmt)
                except sqlite3.OperationalError:
                    pass

    # --- Table Asset Methods ---
    def save_table_asset(self, asset_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                conn.execute(
                    """
                INSERT INTO catalog_tables (
                    dataset_name, display_name, description, table_type, owner,
                    tags_json, row_count, column_count, columns_json,
                    endorsement_status, endorsement_note, endorsed_by,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(dataset_name) DO UPDATE SET
                    display_name=excluded.display_name,
                    description=excluded.description,
                    table_type=excluded.table_type,
                    owner=excluded.owner,
                    tags_json=excluded.tags_json,
                    row_count=excluded.row_count,
                    column_count=excluded.column_count,
                    columns_json=excluded.columns_json,
                    endorsement_status=excluded.endorsement_status,
                    endorsement_note=excluded.endorsement_note,
                    endorsed_by=excluded.endorsed_by,
                    updated_at=excluded.updated_at
                """,
                    (
                        asset_dict["dataset_name"],
                        asset_dict.get("display_name"),
                        asset_dict.get("description", ""),
                        asset_dict.get("table_type", "TABLE"),
                        asset_dict.get("owner", "admin"),
                        json.dumps(asset_dict.get("tags", [])),
                        asset_dict.get("row_count", 0),
                        asset_dict.get("column_count", 0),
                        json.dumps(
                            [
                                c if isinstance(c, dict) else c.model_dump()
                                for c in asset_dict.get("columns", [])
                            ]
                        ),
                        asset_dict.get("endorsement_status") or "draft",
                        asset_dict.get("endorsement_note") or "",
                        asset_dict.get("endorsed_by"),
                        asset_dict.get("created_at") or now_str,
                        asset_dict.get("updated_at") or now_str,
                    ),
                )

    def delete_table_asset(self, dataset_name: str) -> bool:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute(
                    "DELETE FROM catalog_tables WHERE dataset_name=?",
                    (dataset_name,),
                )
                return cur.rowcount > 0

    def get_table_asset(self, dataset_name: str) -> dict[str, Any] | None:
        with self._lock:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT * FROM catalog_tables WHERE dataset_name=?", (dataset_name,)
                ).fetchone()
                if not row:
                    return None
                return self._row_to_asset(row)

    def list_table_assets(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute(
                    "SELECT * FROM catalog_tables ORDER BY updated_at DESC"
                ).fetchall()
                return [self._row_to_asset(r) for r in rows]

    def _row_to_asset(self, r: sqlite3.Row) -> dict[str, Any]:
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        keys = r.keys()
        return {
            "dataset_name": r["dataset_name"],
            "display_name": r["display_name"],
            "description": r["description"],
            "table_type": r["table_type"],
            "owner": r["owner"],
            "tags": json.loads(r["tags_json"] or "[]"),
            "row_count": r["row_count"],
            "column_count": r["column_count"],
            "columns": json.loads(r["columns_json"] or "[]"),
            "endorsement_status": (
                r["endorsement_status"] if "endorsement_status" in keys else None
            )
            or "draft",
            "endorsement_note": (r["endorsement_note"] if "endorsement_note" in keys else None)
            or "",
            "endorsed_by": r["endorsed_by"] if "endorsed_by" in keys else None,
            "created_at": r["created_at"] or now_str,
            "updated_at": r["updated_at"] or now_str,
        }

    # --- Semantic Metric Methods ---
    def save_metric(self, metric_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO semantic_metrics (
                    name, display_name, description, table_name, formula,
                    aggregation_type, dimensions_json, filter_expr, format,
                    numerator_metric, denominator_metric,
                    endorsement_status, endorsement_note, endorsed_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                    display_name=excluded.display_name,
                    description=excluded.description,
                    table_name=excluded.table_name,
                    formula=excluded.formula,
                    aggregation_type=excluded.aggregation_type,
                    dimensions_json=excluded.dimensions_json,
                    filter_expr=excluded.filter_expr,
                    format=excluded.format,
                    numerator_metric=excluded.numerator_metric,
                    denominator_metric=excluded.denominator_metric,
                    endorsement_status=excluded.endorsement_status,
                    endorsement_note=excluded.endorsement_note,
                    endorsed_by=excluded.endorsed_by
                """,
                    (
                        metric_dict["name"],
                        metric_dict.get("display_name"),
                        metric_dict.get("description", ""),
                        metric_dict["table_name"],
                        metric_dict["formula"],
                        metric_dict.get("aggregation_type", "SUM"),
                        json.dumps(metric_dict.get("dimensions", [])),
                        metric_dict.get("filter_expr"),
                        metric_dict.get("format", "number"),
                        metric_dict.get("numerator_metric"),
                        metric_dict.get("denominator_metric"),
                        metric_dict.get("endorsement_status") or "draft",
                        metric_dict.get("endorsement_note") or "",
                        metric_dict.get("endorsed_by"),
                    ),
                )

    def get_metric(self, name: str) -> dict[str, Any] | None:
        with self._lock:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT * FROM semantic_metrics WHERE name=?", (name,)
                ).fetchone()
                if not row:
                    return None
                return self._row_to_metric(row)

    def list_metrics(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM semantic_metrics").fetchall()
                return [self._row_to_metric(r) for r in rows]

    def _row_to_metric(self, r: sqlite3.Row) -> dict[str, Any]:
        keys = r.keys()
        return {
            "name": r["name"],
            "display_name": r["display_name"],
            "description": r["description"],
            "table_name": r["table_name"],
            "formula": r["formula"],
            "aggregation_type": r["aggregation_type"],
            "dimensions": json.loads(r["dimensions_json"] or "[]"),
            "filter_expr": r["filter_expr"],
            "format": r["format"],
            "numerator_metric": r["numerator_metric"] if "numerator_metric" in keys else None,
            "denominator_metric": r["denominator_metric"] if "denominator_metric" in keys else None,
            "endorsement_status": (
                r["endorsement_status"] if "endorsement_status" in keys else None
            )
            or "draft",
            "endorsement_note": (r["endorsement_note"] if "endorsement_note" in keys else None)
            or "",
            "endorsed_by": r["endorsed_by"] if "endorsed_by" in keys else None,
        }

    # --- DAG Model Methods ---
    def save_dag_model(self, model_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO dag_models_meta (name, sql, materialization, depends_on_json, description, unique_key, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                    sql=excluded.sql,
                    materialization=excluded.materialization,
                    depends_on_json=excluded.depends_on_json,
                    description=excluded.description,
                    unique_key=excluded.unique_key,
                    updated_at=excluded.updated_at
                """,
                    (
                        model_dict["name"],
                        model_dict["sql"],
                        model_dict.get("materialization", "table"),
                        json.dumps(model_dict.get("depends_on", [])),
                        model_dict.get("description", ""),
                        model_dict.get("unique_key"),
                    ),
                )

    def list_dag_models(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM dag_models_meta").fetchall()
                return [
                    {
                        "name": r["name"],
                        "sql": r["sql"],
                        "materialization": r["materialization"],
                        "depends_on": json.loads(r["depends_on_json"] or "[]"),
                        "description": r["description"],
                        "unique_key": r["unique_key"] if "unique_key" in r.keys() else None,
                    }
                    for r in rows
                ]

    def delete_dag_model(self, name: str) -> bool:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute("DELETE FROM dag_models_meta WHERE name = ?", (name,))
                return cur.rowcount > 0

    # --- Ontology Methods ---
    def save_ontology_object(self, obj_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO ontology_objects (
                    name, display_name, description, primary_key, title_property,
                    backed_by_table, properties_json, tags_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    display_name=excluded.display_name,
                    description=excluded.description,
                    primary_key=excluded.primary_key,
                    title_property=excluded.title_property,
                    backed_by_table=excluded.backed_by_table,
                    properties_json=excluded.properties_json,
                    tags_json=excluded.tags_json
                """,
                    (
                        obj_dict["name"],
                        obj_dict.get("display_name"),
                        obj_dict.get("description", ""),
                        obj_dict["primary_key"],
                        obj_dict.get("title_property"),
                        obj_dict["backed_by_table"],
                        json.dumps(
                            [
                                p if isinstance(p, dict) else p.model_dump()
                                for p in obj_dict.get("properties", [])
                            ]
                        ),
                        json.dumps(obj_dict.get("tags", [])),
                        obj_dict.get("created_at")
                        or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    ),
                )

    def list_ontology_objects(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM ontology_objects").fetchall()
                return [
                    {
                        "name": r["name"],
                        "display_name": r["display_name"],
                        "description": r["description"],
                        "primary_key": r["primary_key"],
                        "title_property": r["title_property"],
                        "backed_by_table": r["backed_by_table"],
                        "properties": json.loads(r["properties_json"] or "[]"),
                        "tags": json.loads(r["tags_json"] or "[]"),
                        "created_at": r["created_at"],
                    }
                    for r in rows
                ]

    def save_ontology_link(self, link_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO ontology_links (
                    name, display_name, description, source_object_type,
                    target_object_type, cardinality, source_join_key, target_join_key,
                    junction_table, junction_source_key, junction_target_key, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    display_name=excluded.display_name,
                    description=excluded.description,
                    source_object_type=excluded.source_object_type,
                    target_object_type=excluded.target_object_type,
                    cardinality=excluded.cardinality,
                    source_join_key=excluded.source_join_key,
                    target_join_key=excluded.target_join_key,
                    junction_table=excluded.junction_table,
                    junction_source_key=excluded.junction_source_key,
                    junction_target_key=excluded.junction_target_key
                """,
                    (
                        link_dict["name"],
                        link_dict.get("display_name"),
                        link_dict.get("description", ""),
                        link_dict["source_object_type"],
                        link_dict["target_object_type"],
                        link_dict.get("cardinality", "ONE_TO_MANY"),
                        link_dict["source_join_key"],
                        link_dict["target_join_key"],
                        link_dict.get("junction_table"),
                        link_dict.get("junction_source_key"),
                        link_dict.get("junction_target_key"),
                        link_dict.get("created_at")
                        or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    ),
                )

    def list_ontology_links(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM ontology_links").fetchall()
                return [
                    {
                        "name": r["name"],
                        "display_name": r["display_name"],
                        "description": r["description"],
                        "source_object_type": r["source_object_type"],
                        "target_object_type": r["target_object_type"],
                        "cardinality": r["cardinality"],
                        "source_join_key": r["source_join_key"],
                        "target_join_key": r["target_join_key"],
                        "junction_table": r["junction_table"]
                        if "junction_table" in r.keys()
                        else None,
                        "junction_source_key": r["junction_source_key"]
                        if "junction_source_key" in r.keys()
                        else None,
                        "junction_target_key": r["junction_target_key"]
                        if "junction_target_key" in r.keys()
                        else None,
                        "created_at": r["created_at"],
                    }
                    for r in rows
                ]

    def save_ontology_action(self, act_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO ontology_actions (
                    name, display_name, description, target_object_type,
                    parameters_json, handler_type, handler_config_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    display_name=excluded.display_name,
                    description=excluded.description,
                    target_object_type=excluded.target_object_type,
                    parameters_json=excluded.parameters_json,
                    handler_type=excluded.handler_type,
                    handler_config_json=excluded.handler_config_json
                """,
                    (
                        act_dict["name"],
                        act_dict.get("display_name"),
                        act_dict.get("description", ""),
                        act_dict["target_object_type"],
                        json.dumps(
                            [
                                p if isinstance(p, dict) else p.model_dump()
                                for p in act_dict.get("parameters", [])
                            ]
                        ),
                        act_dict.get("handler_type", "WEBHOOK"),
                        json.dumps(act_dict.get("handler_config", {})),
                        act_dict.get("created_at")
                        or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    ),
                )

    def list_ontology_actions(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM ontology_actions").fetchall()
                return [
                    {
                        "name": r["name"],
                        "display_name": r["display_name"],
                        "description": r["description"],
                        "target_object_type": r["target_object_type"],
                        "parameters": json.loads(r["parameters_json"] or "[]"),
                        "handler_type": r["handler_type"],
                        "handler_config": json.loads(r["handler_config_json"] or "{}"),
                        "created_at": r["created_at"],
                    }
                    for r in rows
                ]

    def save_action_audit(self, audit_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO ontology_action_audit (
                    audit_id, action_name, target_object_type, target_instance_id,
                    parameters_json, status, execution_result_json, executed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        audit_dict["audit_id"],
                        audit_dict["action_name"],
                        audit_dict["target_object_type"],
                        audit_dict["target_instance_id"],
                        json.dumps(audit_dict.get("parameters", {})),
                        audit_dict.get("status", "SUCCESS"),
                        json.dumps(audit_dict.get("execution_result", {})),
                        audit_dict.get("executed_at")
                        or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    ),
                )

    def list_action_audits(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute(
                    "SELECT * FROM ontology_action_audit ORDER BY executed_at DESC, rowid DESC LIMIT ?",
                    (limit,),
                ).fetchall()
                return [
                    {
                        "audit_id": r["audit_id"],
                        "action_name": r["action_name"],
                        "target_object_type": r["target_object_type"],
                        "target_instance_id": r["target_instance_id"],
                        "parameters": json.loads(r["parameters_json"] or "{}"),
                        "status": r["status"],
                        "execution_result": json.loads(r["execution_result_json"] or "{}"),
                        "executed_at": r["executed_at"],
                    }
                    for r in rows
                ]

    def delete_ontology_object(self, name: str) -> bool:
        return self._delete_by_name("ontology_objects", "name", name)

    def delete_ontology_link(self, name: str) -> bool:
        return self._delete_by_name("ontology_links", "name", name)

    def delete_ontology_action(self, name: str) -> bool:
        return self._delete_by_name("ontology_actions", "name", name)

    def _delete_by_name(self, table: str, column: str, value: str) -> bool:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute(
                    f"DELETE FROM {table} WHERE {column}=?",
                    (value,),
                )
                return cur.rowcount > 0

    def save_semantic_model(self, model_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO semantic_models (
                    name, table_name, grain_json, columns_json, entities_json, agg_time_dimension,
                    endorsement_status, endorsement_note, endorsed_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    table_name=excluded.table_name,
                    grain_json=excluded.grain_json,
                    columns_json=excluded.columns_json,
                    entities_json=excluded.entities_json,
                    agg_time_dimension=excluded.agg_time_dimension,
                    endorsement_status=excluded.endorsement_status,
                    endorsement_note=excluded.endorsement_note,
                    endorsed_by=excluded.endorsed_by
                """,
                    (
                        model_dict["name"],
                        model_dict["table_name"],
                        json.dumps(model_dict.get("grain") or []),
                        json.dumps(model_dict.get("columns") or []),
                        json.dumps(model_dict.get("entities") or []),
                        model_dict.get("agg_time_dimension"),
                        model_dict.get("endorsement_status") or "draft",
                        model_dict.get("endorsement_note") or "",
                        model_dict.get("endorsed_by"),
                    ),
                )

    def list_semantic_models(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT * FROM semantic_models").fetchall()
                res = []
                for r in rows:
                    keys = r.keys()
                    res.append(
                        {
                            "name": r["name"],
                            "table_name": r["table_name"],
                            "grain": json.loads(r["grain_json"] or "[]"),
                            "columns": json.loads(r["columns_json"] or "[]"),
                            "entities": json.loads(r["entities_json"] or "[]"),
                            "agg_time_dimension": r["agg_time_dimension"],
                            "endorsement_status": (
                                r["endorsement_status"] if "endorsement_status" in keys else None
                            )
                            or "draft",
                            "endorsement_note": (
                                r["endorsement_note"] if "endorsement_note" in keys else None
                            )
                            or "",
                            "endorsed_by": r["endorsed_by"] if "endorsed_by" in keys else None,
                        }
                    )
                return res

    def save_lineage_edge(self, source_table: str, target_table: str):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute(
                    """
                INSERT INTO lineage_edges (source_table, target_table)
                VALUES (?, ?)
                ON CONFLICT(source_table, target_table) DO NOTHING
                """,
                    (source_table, target_table),
                )

    def list_lineage_edges(self) -> list[dict[str, str]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute(
                    "SELECT source_table, target_table FROM lineage_edges"
                ).fetchall()
                return [
                    {"source_table": r["source_table"], "target_table": r["target_table"]}
                    for r in rows
                ]

    # --- Context Studio: Guides & Workspace Rules & Playbooks ---
    def save_context_guide(self, guide_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                conn.execute(
                    """
                INSERT INTO context_guides (
                    name, title, content, scope, target_names_json, tags_json, endorsement_status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    title=excluded.title,
                    content=excluded.content,
                    scope=excluded.scope,
                    target_names_json=excluded.target_names_json,
                    tags_json=excluded.tags_json,
                    endorsement_status=excluded.endorsement_status,
                    updated_at=excluded.updated_at
                """,
                    (
                        guide_dict["name"],
                        guide_dict.get("title") or guide_dict["name"],
                        guide_dict.get("content") or "",
                        guide_dict.get("scope") or "workspace",
                        json.dumps(guide_dict.get("target_names") or []),
                        json.dumps(guide_dict.get("tags") or []),
                        guide_dict.get("endorsement_status") or "endorsed",
                        guide_dict.get("updated_at") or now_str,
                    ),
                )

    def list_context_guides(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute(
                    "SELECT * FROM context_guides ORDER BY updated_at DESC"
                ).fetchall()
                return [
                    {
                        "name": r["name"],
                        "title": r["title"],
                        "content": r["content"],
                        "scope": r["scope"],
                        "target_names": json.loads(r["target_names_json"] or "[]"),
                        "tags": json.loads(r["tags_json"] or "[]"),
                        "endorsement_status": r["endorsement_status"] or "endorsed",
                        "updated_at": r["updated_at"],
                    }
                    for r in rows
                ]

    def save_workspace_rule(self, session_id: str, rule_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                conn.execute(
                    """
                INSERT INTO workspace_rules (
                    session_id, system_rules, endorsed_only_default, naming_conventions_json, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    system_rules=excluded.system_rules,
                    endorsed_only_default=excluded.endorsed_only_default,
                    naming_conventions_json=excluded.naming_conventions_json,
                    updated_at=excluded.updated_at
                """,
                    (
                        session_id,
                        rule_dict.get("system_rules") or "",
                        1 if rule_dict.get("endorsed_only_default") else 0,
                        json.dumps(rule_dict.get("naming_conventions") or {}),
                        rule_dict.get("updated_at") or now_str,
                    ),
                )

    def get_workspace_rule(self, session_id: str) -> dict[str, Any] | None:
        with self._lock:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT * FROM workspace_rules WHERE session_id=?", (session_id,)
                ).fetchone()
                if not row:
                    return None
                return {
                    "session_id": row["session_id"],
                    "system_rules": row["system_rules"] or "",
                    "endorsed_only_default": bool(row["endorsed_only_default"]),
                    "naming_conventions": json.loads(row["naming_conventions_json"] or "{}"),
                    "updated_at": row["updated_at"],
                }

    def save_playbook(self, pb_dict: dict[str, Any]):
        with self._lock:
            with self._get_conn() as conn:
                now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                conn.execute(
                    """
                INSERT INTO analysis_playbooks (
                    playbook_id, session_id, title, description, steps_json, parameters_json,
                    endorsement_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(playbook_id) DO UPDATE SET
                    session_id=excluded.session_id,
                    title=excluded.title,
                    description=excluded.description,
                    steps_json=excluded.steps_json,
                    parameters_json=excluded.parameters_json,
                    endorsement_status=excluded.endorsement_status,
                    updated_at=excluded.updated_at
                """,
                    (
                        pb_dict["playbook_id"],
                        pb_dict.get("session_id") or "_global",
                        pb_dict.get("title") or pb_dict["playbook_id"],
                        pb_dict.get("description") or "",
                        json.dumps(pb_dict.get("steps") or []),
                        json.dumps(pb_dict.get("parameters") or {}),
                        pb_dict.get("endorsement_status") or "endorsed",
                        pb_dict.get("created_at") or now_str,
                        pb_dict.get("updated_at") or now_str,
                    ),
                )

    def get_playbook(self, playbook_id: str) -> dict[str, Any] | None:
        with self._lock:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT * FROM analysis_playbooks WHERE playbook_id=?", (playbook_id,)
                ).fetchone()
                if not row:
                    return None
                return self._row_to_playbook(row)

    def list_playbooks(self, session_id: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            with self._get_conn() as conn:
                if session_id and session_id != "_global":
                    rows = conn.execute(
                        "SELECT * FROM analysis_playbooks WHERE session_id IN (?, '_global') ORDER BY updated_at DESC",
                        (session_id,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT * FROM analysis_playbooks ORDER BY updated_at DESC"
                    ).fetchall()
                return [self._row_to_playbook(r) for r in rows]

    def _row_to_playbook(self, r: sqlite3.Row) -> dict[str, Any]:
        return {
            "playbook_id": r["playbook_id"],
            "session_id": r["session_id"],
            "title": r["title"],
            "description": r["description"],
            "steps": json.loads(r["steps_json"] or "[]"),
            "parameters": json.loads(r["parameters_json"] or "{}"),
            "endorsement_status": r["endorsement_status"] or "endorsed",
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
