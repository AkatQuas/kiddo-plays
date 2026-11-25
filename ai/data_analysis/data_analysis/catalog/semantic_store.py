import hashlib
import threading
from typing import Any, Optional

from pydantic import BaseModel, Field

from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.engine.sql_guard import safe_ident, safe_predicate, safe_table_ref


class MetricDefinition(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = ""
    table_name: str
    formula: str  # e.g. "SUM(sales)", "AVG(dwell_time)", "SUM(profit) / NULLIF(SUM(sales), 0)"
    aggregation_type: str = "SUM"  # SUM, AVG, COUNT, RATIO, CUSTOM, CUMULATIVE
    # RATIO divides the numerator metric's aggregate by the denominator metric's aggregate.
    numerator_metric: str | None = None
    denominator_metric: str | None = None
    dimensions: list[str] = Field(default_factory=list)
    filter_expr: str | None = None
    format: str = "number"  # number, currency, percentage
    endorsement_status: str = "draft"  # endorsed, draft, deprecated, warning
    endorsement_note: str = ""
    endorsed_by: str | None = None


class SemanticMetricStore:
    """Semantic metric layer. Default ("_global") namespace is DB-backed; per-session
    namespaces are in-memory and isolated."""

    _instance = None
    _lock = threading.RLock()
    _session_instances: dict[str, "SemanticMetricStore"] = {}

    def __init__(self, persistent: bool = True, db: MetadataDB | None = None):
        self.persistent = persistent or db is not None
        self.db = db if db is not None else (MetadataDB.get_instance() if persistent else None)
        self._metrics: dict[str, MetricDefinition] = {}
        self._models: dict[str, SemanticModel] = {}
        if self.persistent and self.db is not None:
            self._restore_models()

    @classmethod
    def get_instance(cls) -> "SemanticMetricStore":
        return get_semantic_store("_global")

    def _restore_models(self) -> None:
        if self.db is None:
            return
        for row in self.db.list_semantic_models():
            self._models[row["name"]] = SemanticModel(**row)

    def register_metric(self, metric: MetricDefinition) -> MetricDefinition:
        with self._lock:
            if self.persistent:
                self.db.save_metric(metric.model_dump())
            else:
                self._metrics[metric.name] = metric
            return metric

    def get_metric(self, metric_name: str) -> MetricDefinition | None:
        with self._lock:
            if self.persistent:
                data = self.db.get_metric(metric_name)
                return MetricDefinition(**data) if data else None
            return self._metrics.get(metric_name)

    def list_metrics(self) -> list[MetricDefinition]:
        with self._lock:
            if self.persistent:
                return [MetricDefinition(**r) for r in self.db.list_metrics()]
            return list(self._metrics.values())

    def compile_query(
        self,
        metric_names: list[str],
        dimensions: list[str] | None = None,
        filters: str | None = None,
        order_by: str | None = None,
        limit: int = 100,
    ) -> str:
        """Compile standardized semantic metrics and dimensions into executable DuckDB SQL."""
        if not metric_names:
            raise ValueError("metric_names cannot be empty")

        with self._lock:
            first_m = self.get_metric(metric_names[0])
            if not first_m:
                raise ValueError(f"Metric '{metric_names[0]}' not defined in Semantic Store")

            table_name = first_m.table_name

            select_parts = []
            if dimensions:
                for dim in dimensions:
                    select_parts.append(safe_ident(dim))

            for m_name in metric_names:
                m_def = self.get_metric(m_name)
                if not m_def:
                    raise ValueError(f"Metric '{m_name}' not defined in Semantic Store")
                if m_def.table_name != table_name:
                    raise ValueError(
                        f"Cross-table semantic joins not supported in single query: {m_def.table_name} vs {table_name}"
                    )
                if dimensions and m_def.dimensions:
                    unknown = [d for d in dimensions if d not in m_def.dimensions]
                    if unknown:
                        raise ValueError(
                            f"Metric '{m_name}' does not declare dimension(s) {unknown}. "
                            f"Declared: {list(m_def.dimensions)}"
                        )
                select_parts.append(
                    f"({safe_predicate(self._formula_sql(m_def))}) AS {safe_ident(m_name)}"
                )

            sql = f"SELECT {', '.join(select_parts)} FROM {safe_table_ref(table_name)}"

            raw_wheres = []
            if filters:
                raw_wheres.append(filters)
            for m_name in metric_names:
                defined = self.get_metric(m_name)
                if defined is not None and defined.filter_expr:
                    raw_wheres.append(defined.filter_expr)
            where_sql = _where_sql(raw_wheres)
            if where_sql:
                sql += where_sql

            if dimensions:
                dim_indices = [str(i + 1) for i in range(len(dimensions))]
                sql += f" GROUP BY {', '.join(dim_indices)}"

            if order_by:
                sql += f" ORDER BY {safe_predicate(order_by)}"
            elif metric_names:
                sql += f" ORDER BY {safe_ident(metric_names[0])} DESC"

            sql += f" LIMIT {int(limit)}"
            return sql

    def _formula_sql(self, metric: MetricDefinition) -> str:
        """Aggregate expression. RATIO divides two aggregates; it does not average a row ratio."""
        if (metric.aggregation_type or "").upper() != "RATIO":
            return metric.formula
        num = self.get_metric(metric.numerator_metric or "")
        den = self.get_metric(metric.denominator_metric or "")
        if num is None or den is None:
            raise ValueError(
                f"RATIO metric '{metric.name}' requires numerator_metric and denominator_metric "
                "that are already registered. Each side is aggregated, then the aggregates are divided."
            )
        if (num.aggregation_type or "").upper() == "RATIO" or (
            den.aggregation_type or ""
        ).upper() == "RATIO":
            raise ValueError("RATIO metrics cannot nest other RATIO metrics")
        return f"({num.formula}) / NULLIF(({den.formula}), 0)"

    def metric_version(self, metric_name: str) -> str:
        metric = self.get_metric(metric_name)
        if metric is None:
            raise ValueError(f"Metric '{metric_name}' not defined in Semantic Store")
        raw = "|".join(
            [
                metric.name,
                metric.table_name,
                metric.formula,
                metric.aggregation_type,
                metric.numerator_metric or "",
                metric.denominator_metric or "",
                ",".join(metric.dimensions),
            ]
        )
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def register_model(self, model: "SemanticModel") -> "SemanticModel":
        with self._lock:
            self._models[model.name] = model
            if self.persistent and self.db is not None:
                self.db.save_semantic_model(model.model_dump())
            return model

    def list_models(self) -> list["SemanticModel"]:
        with self._lock:
            return list(self._models.values())

    def get_model(self, model_name: str) -> Optional["SemanticModel"]:
        with self._lock:
            return self._models.get(model_name)

    def endorse_metric(
        self,
        metric_name: str,
        status: str = "endorsed",
        endorsement_note: str = "",
        endorsed_by: str | None = None,
    ) -> MetricDefinition:
        status_norm = (status or "endorsed").strip().lower()
        if status_norm not in ("endorsed", "draft", "deprecated", "warning"):
            raise ValueError(
                f"Invalid endorsement_status {status!r}; expected endorsed, draft, deprecated, or warning"
            )
        with self._lock:
            metric = self.get_metric(metric_name)
            if metric is None:
                raise ValueError(f"Metric '{metric_name}' not defined in Semantic Store")
            metric.endorsement_status = status_norm
            metric.endorsement_note = endorsement_note or ""
            metric.endorsed_by = endorsed_by
            return self.register_metric(metric)

    def endorse_model(
        self,
        model_name: str,
        status: str = "endorsed",
        endorsement_note: str = "",
        endorsed_by: str | None = None,
    ) -> "SemanticModel":
        status_norm = (status or "endorsed").strip().lower()
        if status_norm not in ("endorsed", "draft", "deprecated", "warning"):
            raise ValueError(
                f"Invalid endorsement_status {status!r}; expected endorsed, draft, deprecated, or warning"
            )
        with self._lock:
            model = self._models.get(model_name)
            if model is None:
                raise ValueError(f"Semantic model '{model_name}' not defined in Semantic Store")
            model.endorsement_status = status_norm
            model.endorsement_note = endorsement_note or ""
            model.endorsed_by = endorsed_by
            return self.register_model(model)

    def check_endorsement_warnings(
        self,
        metric_names: list[str],
        endorsed_only: bool = False,
    ) -> list[str]:
        """Inspect endorsement status of requested metrics and their underlying semantic models."""
        warnings: list[str] = []
        with self._lock:
            for name in metric_names:
                m = self.get_metric(name)
                if m is None:
                    raise ValueError(f"Metric '{name}' not defined in Semantic Store")
                m_status = (m.endorsement_status or "draft").lower()
                if m_status == "deprecated":
                    msg = f"Metric '{name}' is marked DEPRECATED" + (
                        f": {m.endorsement_note}" if m.endorsement_note else ""
                    )
                    if endorsed_only:
                        raise ValueError(f"Endorsed mode rejected query: {msg}")
                    warnings.append(msg)
                elif m_status != "endorsed":
                    msg = f"Metric '{name}' has status '{m_status}' (not endorsed)" + (
                        f": {m.endorsement_note}" if m.endorsement_note else ""
                    )
                    if endorsed_only:
                        raise ValueError(f"Endorsed mode requires 'endorsed' metrics; {msg}")
                    warnings.append(msg)
                model = self._model_for_table(m.table_name)
                if model is not None:
                    mod_status = (model.endorsement_status or "draft").lower()
                    if mod_status == "deprecated":
                        msg = f"Semantic model '{model.name}' (table '{model.table_name}') is marked DEPRECATED"
                        if endorsed_only:
                            raise ValueError(f"Endorsed mode rejected query: {msg}")
                        warnings.append(msg)
                    elif endorsed_only and mod_status != "endorsed":
                        raise ValueError(
                            f"Endorsed mode requires 'endorsed' semantic model; '{model.name}' has status '{mod_status}'"
                        )
        return warnings

    def import_dbt_semantic_yaml(
        self,
        yaml_content: str,
        default_endorsement_status: str = "endorsed",
    ) -> dict[str, Any]:
        """Parse dbt Semantic Layer (MetricFlow) / OSI YAML and register SemanticModels and MetricDefinitions."""
        import re

        import yaml

        if not isinstance(yaml_content, str) or not yaml_content.strip():
            raise ValueError("yaml_content must be a non-empty YAML string")
        try:
            docs = [d for d in yaml.safe_load_all(yaml_content) if isinstance(d, dict)]
        except Exception as exc:
            raise ValueError(f"Invalid YAML syntax: {exc}") from exc
        if not docs:
            raise ValueError("YAML did not contain any valid mapping document")

        raw_models: list[dict[str, Any]] = []
        raw_metrics: list[dict[str, Any]] = []
        for doc in docs:
            if isinstance(doc.get("semantic_models"), list):
                raw_models.extend(x for x in doc["semantic_models"] if isinstance(x, dict))
            if isinstance(doc.get("metrics"), list):
                raw_metrics.extend(x for x in doc["metrics"] if isinstance(x, dict))
            # Support single-object YAML documents as well
            if doc.get("semantic_model") and isinstance(doc["semantic_model"], dict):
                raw_models.append(doc["semantic_model"])
            if doc.get("metric") and isinstance(doc["metric"], dict):
                raw_metrics.append(doc["metric"])

        measure_lookup: dict[str, dict[str, Any]] = {}
        registered_models: list[dict[str, Any]] = []
        registered_metrics: list[dict[str, Any]] = []

        for sm in raw_models:
            name = str(sm.get("name") or "").strip()
            if not name:
                raise ValueError("Each semantic_model in YAML requires a 'name'")
            model_ref = str(sm.get("model") or sm.get("table_name") or name).strip()
            m_ref = re.search(r"ref\(\s*['\"]([^'\"]+)['\"]\s*\)", model_ref)
            if m_ref:
                table_name = m_ref.group(1)
            else:
                m_src = re.search(
                    r"source\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)", model_ref
                )
                table_name = m_src.group(1) if m_src else model_ref

            entities: list[EntityRef] = []
            grain: list[str] = []
            cols: list[str] = list(sm.get("columns") or [])
            for ent in sm.get("entities") or []:
                if not isinstance(ent, dict):
                    continue
                e_name = str(ent.get("name") or "").strip()
                e_type_raw = str(ent.get("type") or "primary").strip().lower()
                e_type = "primary" if e_type_raw in ("primary", "unique") else "foreign"
                e_expr = str(ent.get("expr") or e_name).strip()
                if e_name:
                    entities.append(EntityRef(name=e_name, type=e_type, expr=e_expr))
                    if e_type == "primary" and e_expr not in grain:
                        grain.append(e_expr)
                    if e_expr not in cols:
                        cols.append(e_expr)

            agg_time_dim = sm.get("agg_time_dimension")
            defaults = sm.get("defaults")
            if not agg_time_dim and isinstance(defaults, dict):
                agg_time_dim = defaults.get("agg_time_dimension")

            for dim in sm.get("dimensions") or []:
                if not isinstance(dim, dict):
                    continue
                d_name = str(dim.get("name") or "").strip()
                d_expr = str(dim.get("expr") or d_name).strip()
                d_type = str(dim.get("type") or "categorical").strip().lower()
                for col_candidate in (d_name, d_expr):
                    if col_candidate and col_candidate not in cols and "(" not in col_candidate:
                        cols.append(col_candidate)
                if d_type == "time" and not agg_time_dim:
                    agg_time_dim = d_expr if "(" not in d_expr else d_name

            if agg_time_dim and agg_time_dim not in cols:
                cols.append(agg_time_dim)
            if not grain and cols:
                grain = [cols[0]]

            status = str(sm.get("endorsement_status") or default_endorsement_status).lower()
            sem_model = SemanticModel(
                name=name,
                table_name=table_name,
                grain=grain,
                columns=cols,
                entities=entities,
                agg_time_dimension=agg_time_dim,
                endorsement_status=status,
                endorsement_note=str(sm.get("description") or ""),
            )
            self.register_model(sem_model)
            registered_models.append(sem_model.model_dump())

            for meas in sm.get("measures") or []:
                if not isinstance(meas, dict):
                    continue
                ms_name = str(meas.get("name") or "").strip()
                if not ms_name:
                    continue
                agg_raw = str(meas.get("agg") or "sum").strip().upper()
                expr = str(meas.get("expr") or ms_name).strip()
                if agg_raw in ("SUM", "AVG", "MIN", "MAX", "MEDIAN"):
                    formula = f"{agg_raw}({expr})"
                    agg_type = agg_raw if agg_raw in ("SUM", "AVG") else "CUSTOM"
                elif agg_raw == "COUNT_DISTINCT":
                    formula = f"COUNT(DISTINCT {expr})"
                    agg_type = "COUNT"
                elif agg_raw == "COUNT":
                    formula = "COUNT(*)" if expr in ("1", "*") else f"COUNT({expr})"
                    agg_type = "COUNT"
                elif agg_raw == "SUM_BOOLEAN":
                    formula = f"SUM(CASE WHEN {expr} THEN 1 ELSE 0 END)"
                    agg_type = "SUM"
                else:
                    formula = f"SUM({expr})"
                    agg_type = "SUM"

                measure_lookup[ms_name] = {
                    "table_name": table_name,
                    "formula": formula,
                    "aggregation_type": agg_type,
                    "dimensions": list(cols),
                    "description": str(meas.get("description") or ""),
                }
                if meas.get("create_metric") is True:
                    m_obj = MetricDefinition(
                        name=ms_name,
                        display_name=str(meas.get("label") or ms_name),
                        description=str(meas.get("description") or ""),
                        table_name=table_name,
                        formula=formula,
                        aggregation_type=agg_type,
                        dimensions=list(cols),
                        endorsement_status=status,
                    )
                    self.register_metric(m_obj)
                    registered_metrics.append(m_obj.model_dump())

        def _ensure_measure_metric(measure_ref: Any) -> MetricDefinition:
            if isinstance(measure_ref, dict):
                m_name = str(measure_ref.get("name") or "").strip()
            else:
                m_name = str(measure_ref or "").strip()
            existing = self.get_metric(m_name)
            if existing is not None:
                return existing
            if m_name in measure_lookup:
                info = measure_lookup[m_name]
                auto_m = MetricDefinition(
                    name=m_name,
                    display_name=m_name,
                    description=info["description"],
                    table_name=info["table_name"],
                    formula=info["formula"],
                    aggregation_type=info["aggregation_type"],
                    dimensions=info["dimensions"],
                    endorsement_status=default_endorsement_status,
                )
                return self.register_metric(auto_m)
            raise ValueError(
                f"Referenced measure or metric '{m_name}' not found in semantic_models or store"
            )

        for mt in raw_metrics:
            m_name = str(mt.get("name") or "").strip()
            if not m_name:
                raise ValueError("Each metric in YAML requires a 'name'")
            m_type = str(mt.get("type") or "simple").strip().lower()
            type_params = mt.get("type_params") or {}
            filter_raw = mt.get("filter")
            if isinstance(filter_raw, str):
                # Strip simple Jinja Dimension/Entity wrappers if present, e.g. {{ Dimension('x') }} -> x
                filter_clean = re.sub(
                    r"\{\{\s*(?:Dimension|TimeDimension|Entity)\(\s*['\"]([^'\"]+)['\"][^)]*\)\s*\}\}",
                    lambda m: m.group(1).split("__")[-1],
                    filter_raw,
                ).strip()
            else:
                filter_clean = None

            status = str(mt.get("endorsement_status") or default_endorsement_status).lower()
            label = str(mt.get("label") or mt.get("display_name") or m_name)
            desc = str(mt.get("description") or "")

            if m_type in ("simple", "cumulative"):
                meas_ref = type_params.get("measure") or mt.get("measure") or m_name
                if isinstance(meas_ref, dict):
                    meas_name = str(meas_ref.get("name") or "").strip()
                else:
                    meas_name = str(meas_ref).strip()
                if meas_name in measure_lookup:
                    info = measure_lookup[meas_name]
                    t_name = info["table_name"]
                    formula = info["formula"]
                    agg_type = "CUMULATIVE" if m_type == "cumulative" else info["aggregation_type"]
                    dims = list(mt.get("dimensions") or info["dimensions"])
                else:
                    t_name = str(mt.get("table_name") or "").strip()
                    formula = str(mt.get("formula") or "").strip()
                    if not t_name or not formula:
                        raise ValueError(
                            f"Metric '{m_name}' references unknown measure '{meas_name}' and lacks table_name/formula"
                        )
                    agg_type = (
                        "CUMULATIVE"
                        if m_type == "cumulative"
                        else str(mt.get("aggregation_type") or "SUM").upper()
                    )
                    dims = list(mt.get("dimensions") or [])
                m_def = MetricDefinition(
                    name=m_name,
                    display_name=label,
                    description=desc,
                    table_name=t_name,
                    formula=formula,
                    aggregation_type=agg_type,
                    dimensions=dims,
                    filter_expr=filter_clean,
                    endorsement_status=status,
                )
            elif m_type == "ratio":
                num_ref = type_params.get("numerator") or mt.get("numerator_metric")
                den_ref = type_params.get("denominator") or mt.get("denominator_metric")
                num_m = _ensure_measure_metric(num_ref)
                den_m = _ensure_measure_metric(den_ref)
                m_def = MetricDefinition(
                    name=m_name,
                    display_name=label,
                    description=desc,
                    table_name=num_m.table_name,
                    formula=f"({num_m.formula}) / NULLIF(({den_m.formula}), 0)",
                    aggregation_type="RATIO",
                    numerator_metric=num_m.name,
                    denominator_metric=den_m.name,
                    dimensions=list(mt.get("dimensions") or num_m.dimensions),
                    filter_expr=filter_clean,
                    format="percentage",
                    endorsement_status=status,
                )
            elif m_type in ("derived", "custom"):
                expr = str(type_params.get("expr") or mt.get("formula") or "").strip()
                input_metrics = type_params.get("metrics") or []
                t_name = str(mt.get("table_name") or "").strip()
                dims = list(mt.get("dimensions") or [])
                formula = expr
                for im in input_metrics:
                    im_obj = _ensure_measure_metric(im)
                    alias = (
                        str(im.get("alias") or im.get("name")) if isinstance(im, dict) else str(im)
                    )
                    if not t_name:
                        t_name = im_obj.table_name
                    if not dims:
                        dims = list(im_obj.dimensions)
                    formula = re.sub(
                        r"\b" + re.escape(alias) + r"\b", f"({im_obj.formula})", formula
                    )
                if not t_name and registered_models:
                    t_name = registered_models[0]["table_name"]
                if not t_name or not formula:
                    raise ValueError(
                        f"Derived metric '{m_name}' requires valid expression and table_name"
                    )
                m_def = MetricDefinition(
                    name=m_name,
                    display_name=label,
                    description=desc,
                    table_name=t_name,
                    formula=formula,
                    aggregation_type="CUSTOM",
                    dimensions=dims,
                    filter_expr=filter_clean,
                    endorsement_status=status,
                )
            else:
                raise ValueError(f"Unsupported dbt metric type '{m_type}' for metric '{m_name}'")

            self.register_metric(m_def)
            registered_metrics.append(m_def.model_dump())

        return {
            "models_imported": len(registered_models),
            "metrics_imported": len(registered_metrics),
            "models": registered_models,
            "metrics": registered_metrics,
        }

    def export_dbt_semantic_yaml(self) -> str:
        """Export registered SemanticModels and MetricDefinitions as dbt MetricFlow YAML."""
        import yaml

        with self._lock:
            sm_list = []
            for m in self._models.values():
                sm_list.append(
                    {
                        "name": m.name,
                        "model": f"ref('{m.table_name}')",
                        "description": m.endorsement_note or "",
                        "endorsement_status": m.endorsement_status,
                        "defaults": {"agg_time_dimension": m.agg_time_dimension}
                        if m.agg_time_dimension
                        else {},
                        "entities": [e.model_dump() for e in m.entities],
                        "dimensions": [
                            {
                                "name": c,
                                "type": "time" if c == m.agg_time_dimension else "categorical",
                            }
                            for c in m.columns
                        ],
                    }
                )
            mt_list = []
            for mt in self.list_metrics():
                item: dict[str, Any] = {
                    "name": mt.name,
                    "label": mt.display_name or mt.name,
                    "description": mt.description or "",
                    "table_name": mt.table_name,
                    "endorsement_status": mt.endorsement_status,
                }
                if (mt.aggregation_type or "").upper() == "RATIO":
                    item["type"] = "ratio"
                    item["type_params"] = {
                        "numerator": mt.numerator_metric,
                        "denominator": mt.denominator_metric,
                    }
                elif (mt.aggregation_type or "").upper() == "CUMULATIVE":
                    item["type"] = "cumulative"
                    item["formula"] = mt.formula
                else:
                    item["type"] = "simple"
                    item["formula"] = mt.formula
                    item["aggregation_type"] = mt.aggregation_type
                if mt.dimensions:
                    item["dimensions"] = list(mt.dimensions)
                if mt.filter_expr:
                    item["filter"] = mt.filter_expr
                mt_list.append(item)
            payload = {"semantic_models": sm_list, "metrics": mt_list}
            return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)

    def _model_for_table(self, table_name: str) -> Optional["SemanticModel"]:
        for model in self._models.values():
            if model.table_name == table_name:
                return model
        return None

    def compile_governed(
        self,
        metric_names: list[str],
        dimensions: list[str] | None = None,
        filters: str | None = None,
        order_by: str | None = None,
        limit: int = 100,
    ) -> str:
        """Compile metrics by aggregating each one on its own table, then joining.

        Joins only follow a foreign key toward a primary key, at most two hops.
        A dimension that would require joining into a one-to-many child is rejected,
        because that fan-out changes the metric.
        """
        dimensions = dimensions or []
        if not metric_names:
            raise ValueError("metric_names cannot be empty")
        metrics = []
        for name in metric_names:
            metric = self.get_metric(name)
            if metric is None:
                raise ValueError(f"Metric '{name}' not defined in Semantic Store")
            metrics.append(metric)

        if all(self._model_for_table(m.table_name) is None for m in metrics):
            return self.compile_query(metric_names, dimensions, filters, order_by, limit)

        ctes = []
        for metric in metrics:
            model = self._model_for_table(metric.table_name)
            if model is None:
                raise ValueError(
                    f"Metric '{metric.name}' has no semantic model for table '{metric.table_name}'"
                )
            if (metric.aggregation_type or "").upper() == "CUMULATIVE":
                if dimensions and dimensions != [model.agg_time_dimension]:
                    raise ValueError(
                        f"Cumulative metric '{metric.name}' compiles on the model time spine only"
                    )
                ctes.append(self._cumulative_cte(metric, model, filters))
                continue
            joins = []
            group_exprs = []
            select_dims = []
            for dim in dimensions:
                path = _join_path(model, dim, list(self._models.values()))
                for step in path:
                    if step not in joins:
                        joins.append(step)
                holder = model if not path else path[-1][2]
                select_dims.append(f"{_alias(holder)}.{safe_ident(dim)} AS {safe_ident(dim)}")
                group_exprs.append(f"{_alias(holder)}.{safe_ident(dim)}")
            from_sql = f"{safe_table_ref(model.table_name)} {_alias(model)}"
            for src, entity, dst in joins:
                from_sql += (
                    f" JOIN {safe_table_ref(dst.table_name)} {_alias(dst)}"
                    f" ON {_alias(src)}.{safe_ident(entity.expr)} = {_alias(dst)}.{safe_ident(_primary_expr(dst, entity.name))}"
                )
            raw_wheres = []
            if filters:
                raw_wheres.append(filters)
            if metric.filter_expr:
                raw_wheres.append(metric.filter_expr)
            where = _where_sql(raw_wheres)
            dim_sql = (", ".join(select_dims) + ", ") if select_dims else ""
            group_sql = (
                f" GROUP BY {', '.join(str(i + 1) for i in range(len(select_dims)))}"
                if select_dims
                else ""
            )
            ctes.append(
                f"{safe_ident(metric.name + '_agg')} AS ("
                f"SELECT {dim_sql}({safe_predicate(self._formula_sql(metric))}) AS {safe_ident(metric.name)} "
                f"FROM {from_sql}{where}{group_sql})"
            )

        order_sql = f" ORDER BY {safe_predicate(order_by)}" if order_by else ""
        if len(ctes) == 1 and (metrics[0].aggregation_type or "").upper() == "CUMULATIVE":
            return (
                f"WITH {ctes[0]} SELECT * FROM {safe_ident(metrics[0].name + '_agg')}"
                f"{order_sql} LIMIT {int(limit)}"
            )

        first = metrics[0].name + "_agg"
        if len(metrics) == 1:
            select_cols = [safe_ident(d) for d in dimensions]
        else:
            select_cols = [
                f"COALESCE({', '.join(f'a{i}.{safe_ident(d)}' for i in range(len(metrics)))}) AS {safe_ident(d)}"
                for d in dimensions
            ]
        select_cols.extend(safe_ident(m.name) for m in metrics)
        sql = "WITH " + ", ".join(ctes)
        sql += f" SELECT {', '.join(select_cols)} FROM {safe_ident(first)} a0"
        for i, metric in enumerate(metrics[1:], start=1):
            cond = (
                " AND ".join(
                    f"a0.{safe_ident(d)} IS NOT DISTINCT FROM a{i}.{safe_ident(d)}"
                    for d in dimensions
                )
                or "TRUE"
            )
            sql += f" FULL OUTER JOIN {safe_ident(metric.name + '_agg')} a{i} ON {cond}"
        sql += f"{order_sql} LIMIT {int(limit)}"
        return sql

    def _cumulative_cte(
        self,
        metric: "MetricDefinition",
        model: "SemanticModel",
        filters: str | None = None,
    ) -> str:
        if not model.agg_time_dimension:
            raise ValueError(
                f"Cumulative metric '{metric.name}' requires agg_time_dimension on its model"
            )
        time_col = safe_ident(model.agg_time_dimension)
        raw_wheres = []
        if filters:
            raw_wheres.append(filters)
        if metric.filter_expr:
            raw_wheres.append(metric.filter_expr)
        where = _where_sql(raw_wheres)
        return (
            f"{safe_ident(metric.name + '_agg')} AS ("
            f"WITH daily AS ("
            f"SELECT CAST({time_col} AS DATE) AS {safe_ident('metric_time')}, "
            f"({safe_predicate(self._formula_sql(metric))}) AS v "
            f"FROM {safe_table_ref(model.table_name)}{where} GROUP BY 1), "
            f"spine AS ("
            f"SELECT CAST(d AS DATE) AS {safe_ident('metric_time')} FROM generate_series("
            f"(SELECT MIN({safe_ident('metric_time')}) FROM daily), "
            f"(SELECT MAX({safe_ident('metric_time')}) FROM daily), "
            f"INTERVAL 1 DAY) t(d)) "
            f"SELECT spine.{safe_ident('metric_time')}, "
            f"SUM(COALESCE(daily.v, 0)) OVER (ORDER BY spine.{safe_ident('metric_time')}) "
            f"AS {safe_ident(metric.name)} "
            f"FROM spine LEFT JOIN daily USING ({safe_ident('metric_time')}))"
        )


class EntityRef(BaseModel):
    name: str
    type: str  # primary or foreign
    expr: str


class SemanticModel(BaseModel):
    name: str
    table_name: str
    grain: list[str]
    columns: list[str] = Field(default_factory=list)
    entities: list[EntityRef] = Field(default_factory=list)
    agg_time_dimension: str | None = None
    endorsement_status: str = "draft"  # endorsed, draft, deprecated, warning
    endorsement_note: str = ""
    endorsed_by: str | None = None


def _where_sql(parts: list[str]) -> str:
    cleaned: list[str] = []
    for part in parts:
        if part and part not in cleaned:
            cleaned.append(safe_predicate(part))
    if not cleaned:
        return ""
    return " WHERE " + " AND ".join(cleaned)


def _alias(model: SemanticModel) -> str:
    return safe_ident("_m_" + model.name)


def _primary_expr(model: SemanticModel, entity_name: str) -> str:
    for entity in model.entities:
        if entity.name == entity_name and entity.type == "primary":
            return entity.expr
    raise ValueError(f"Model '{model.name}' has no primary entity '{entity_name}'")


def _join_path(start: SemanticModel, column: str, models: list[SemanticModel], max_hops: int = 2):
    """Foreign-key to primary-key hops only. One-to-many is rejected by omission."""
    if column in start.columns:
        return []
    primary = {}
    for model in models:
        for entity in model.entities:
            if entity.type == "primary":
                primary.setdefault(entity.name, []).append(model)
    found = []

    def walk(model: SemanticModel, hops: list, seen: set):
        if len(hops) >= max_hops:
            return
        for entity in model.entities:
            if entity.type != "foreign":
                continue
            for target in primary.get(entity.name, []):
                if target.name in seen:
                    continue
                step = (model, entity, target)
                path = [*hops, step]
                if column in target.columns:
                    found.append(path)
                else:
                    walk(target, path, seen | {target.name})

    walk(start, [], {start.name})
    if len(found) > 1:
        raise ValueError(f"Ambiguous join path to dimension '{column}' ({len(found)} routes)")
    if not found:
        raise ValueError(
            f"Dimension '{column}' is not reachable from '{start.table_name}' within {max_hops} many-to-one hops. "
            "Joining into a one-to-many child is refused because it would fan out the metric."
        )
    return found[0]


def get_semantic_store(session_id: str = "_global") -> SemanticMetricStore:
    with SemanticMetricStore._lock:
        inst = SemanticMetricStore._session_instances.get(session_id)
        if inst is None:
            inst = SemanticMetricStore(persistent=(session_id == "_global"))
            SemanticMetricStore._session_instances[session_id] = inst
        if session_id == "_global":
            SemanticMetricStore._instance = inst
        return inst


def _forget_session(session_id: str) -> None:
    """Session closed / expired / evicted: its store must not outlive it."""
    with SemanticMetricStore._lock:
        SemanticMetricStore._session_instances.pop(session_id, None)


def _register_session_cleanup() -> None:
    from data_analysis.cluster.session_manager import SessionManager

    SessionManager.add_close_listener(_forget_session)


_register_session_cleanup()
