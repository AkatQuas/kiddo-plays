"""Composable, read-only analytical tools with explicit metric/time contracts."""

import math
from types import SimpleNamespace

from data_analysis.engine.evidence import Stopwatch, structured_evidence
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.operators.business_report import _query, _schema, literal, quote
from data_analysis.operators.profit_decomposition import profit_bridge
from data_analysis.schemas.requests import (
    DecompositionRequest,
    MetricCompareRequest,
    SensitivityRequest,
)
from data_analysis.schemas.responses import AnalyticalToolResponse


class Context:
    def __init__(self, req, extra=()):
        self.req = req
        self.clock = Stopwatch()
        self.sql = []
        self.warnings = []
        self.table, schema = _schema(req.session_id, req.dataset_name)
        columns = {r["column_name"]: r["column_type"] for r in schema}
        if any(n.startswith("__da_") for n in columns):
            raise ValueError("Rename reserved __da_ columns before analysis")
        m, t = req.metric, req.time
        selected = [
            m.column,
            m.numerator,
            m.denominator,
            t.column,
            *m.entity_keys,
            *req.filters,
            *extra,
        ]
        for n in selected:
            if n and n not in columns:
                raise ValueError(f"Unknown column: {n}")
        where = (
            " WHERE "
            + " AND ".join(
                f"CAST({quote(k)} AS VARCHAR)={literal(v)}" for k, v in req.filters.items()
            )
            if req.filters
            else ""
        )
        col = quote(t.column)
        if t.input_mode == "aware_timestamp":
            explicit = (
                "TRUE"
                if "WITH TIME ZONE" in columns[t.column] or "TIMESTAMPTZ" in columns[t.column]
                else f"REGEXP_MATCHES(CAST({col} AS VARCHAR),'(Z|[+-][0-9]{{2}}:[0-9]{{2}})$','i')"
            )
            instant = f"CASE WHEN {explicit} THEN TRY_CAST({col} AS TIMESTAMPTZ) END"
            date_expr = f"CAST(TIMEZONE({literal(t.timezone)}, {instant}) AS DATE)"
        else:
            date_expr = f"TRY_CAST({col} AS DATE)"
            instant = f"CAST({date_expr} AS TIMESTAMP)"
        numeric = [
            n
            for n in [m.column if m.kind != "distinct_count" else None, m.numerator, m.denominator]
            if n
        ]
        valid = (
            " AND ".join(
                f"COALESCE(ISFINITE(TRY_CAST({quote(n)} AS DOUBLE)),FALSE)" for n in numeric
            )
            or "TRUE"
        )
        if m.kind == "distinct_count":
            valid += f" AND {quote(m.column)} IS NOT NULL"
        for n in m.entity_keys:
            valid += f" AND {quote(n)} IS NOT NULL"
        self.b = f"__da_date>=DATE '{t.base_start}' AND __da_date<DATE '{t.base_end}'"
        self.c = f"__da_date>=DATE '{t.current_start}' AND __da_date<DATE '{t.current_end}'"
        try:
            from data_analysis.catalog.context_studio import get_context_studio
            from data_analysis.catalog.meta_registry import get_meta_registry

            asset = get_meta_registry(req.session_id).get_table(req.dataset_name)
            st = (asset.endorsement_status if asset else "draft").lower()
            note = (asset.endorsement_note if asset else "") or ""
            endorsed_req = getattr(req, "endorsed_only", None)
            enforce = (
                get_context_studio(req.session_id).get_workspace_rules().endorsed_only_default
                if endorsed_req is None
                else bool(endorsed_req)
            )
            if st == "deprecated":
                if enforce:
                    raise ValueError(
                        f"Endorsed mode blocked deprecated dataset '{req.dataset_name}'"
                        + (f": {note}" if note else "")
                    )
                self.warnings.append(
                    f"Dataset '{req.dataset_name}' is marked DEPRECATED"
                    + (f": {note}" if note else ".")
                )
            elif st != "endorsed":
                if enforce:
                    raise ValueError(
                        f"Endorsed mode requires 'endorsed' dataset; '{req.dataset_name}' has status '{st}'"
                    )
                if asset is not None and st == "warning":
                    self.warnings.append(
                        f"Dataset '{req.dataset_name}' has warning status"
                        + (f": {note}" if note else ".")
                    )
        except ValueError:
            raise
        except Exception:
            pass
        self.cte = f"""WITH raw AS (SELECT *,ROW_NUMBER() OVER() AS __da_id,{date_expr} AS __da_date,{instant} AS __da_at FROM {self.table}{where}),
          checked AS (SELECT *,({valid}) AS __da_valid FROM raw),
          data AS (SELECT *,CASE WHEN {self.b} THEN 'base' ELSE 'current' END AS __da_period FROM checked
          WHERE __da_date IS NOT NULL AND __da_valid AND (({self.b}) OR ({self.c})))"""
        self.population = self.query(
            self.cte
            + f""" SELECT COUNT(*) AS filtered_source_rows,
          COUNT(*) FILTER(WHERE __da_date IS NULL) AS invalid_time_rows,
          COUNT(*) FILTER(WHERE (({self.b}) OR ({self.c})) AND NOT __da_valid) AS invalid_metric_rows,
          (SELECT COUNT(*) FROM data WHERE __da_period='base') AS base_rows,
          (SELECT COUNT(*) FROM data WHERE __da_period='current') AS current_rows FROM checked"""
        )[0]
        p = self.population
        if req.invalid_rows == "reject" and (p["invalid_time_rows"] or p["invalid_metric_rows"]):
            raise ValueError(
                f"Invalid time rows={p['invalid_time_rows']}, metric/entity rows={p['invalid_metric_rows']}; fix data or explicitly choose invalid_rows=exclude"
            )
        if p["invalid_time_rows"] or p["invalid_metric_rows"]:
            self.warnings.append(
                "Invalid time/metric/entity rows explicitly excluded; invalid dates cannot be assigned to a period."
            )
        if not p["base_rows"] or not p["current_rows"]:
            raise ValueError(
                "Both periods require valid records; missing data is not zero activity"
            )
        cal = self.query(f"""SELECT
          DATE_TRUNC('{t.grain}',DATE '{t.base_start}')=DATE '{t.base_start}' AND DATE_TRUNC('{t.grain}',DATE '{t.base_end}')=DATE '{t.base_end}'
          AND DATE_TRUNC('{t.grain}',DATE '{t.current_start}')=DATE '{t.current_start}' AND DATE_TRUNC('{t.grain}',DATE '{t.current_end}')=DATE '{t.current_end}' AS aligned,
          DATE_DIFF('{t.grain}',DATE '{t.base_start}',DATE '{t.base_end}') AS base_buckets,
          DATE_DIFF('{t.grain}',DATE '{t.current_start}',DATE '{t.current_end}') AS current_buckets""")[
            0
        ]
        self.calendar = cal
        if t.require_aligned and not cal["aligned"]:
            raise ValueError("Period boundaries must align to calendar grain (weeks start Monday)")
        if t.require_equal_buckets and cal["base_buckets"] != cal["current_buckets"]:
            raise ValueError(
                "Unequal calendar bucket counts; explicitly set require_equal_buckets=false to compare"
            )
        if not cal["aligned"]:
            self.warnings.append(
                "Boundary buckets are partial; results are not automatically exposure-adjusted."
            )
        if cal["base_buckets"] != cal["current_buckets"]:
            self.warnings.append(
                "Comparison windows have unequal bucket counts; totals are not normalized."
            )
        if t.complete_until is None:
            self.warnings.append("Data completeness is unknown; no explicit watermark supplied.")
        elif t.complete_until < t.current_end:
            self.warnings.append(
                "Current window extends beyond the supplied completeness watermark."
            )
        if m.kind == "closing_balance":
            keys = ",".join(quote(k) for k in m.entity_keys)
            ties = self.query(
                self.cte
                + f", ties AS (SELECT 1 FROM data GROUP BY __da_period,{keys},__da_at HAVING COUNT(*)>1) SELECT COUNT(*) AS n FROM ties"
            )[0]["n"]
            if ties:
                raise ValueError(
                    "Duplicate entity/timestamp snapshots are ambiguous; deduplicate or supply finer timestamps"
                )
            self.warnings.append(
                "Closing balance uses the last observation per entity WITHIN each window/bucket; no carry-forward or entity-universe completeness is assumed."
            )

    def query(self, sql, limit=2500):
        self.sql.append(sql)
        return _query(self.req.session_id, sql, limit)

    def aggregate(self, source="data", groups="__da_period"):
        m = self.req.metric

        def numeric(n):
            return f"TRY_CAST({quote(n)} AS DOUBLE)"

        if m.kind == "ratio":
            expr = f"SUM({numeric(m.numerator)})/NULLIF(SUM({numeric(m.denominator)}),0)"
            aux = f"SUM({numeric(m.numerator)}) AS numerator,SUM({numeric(m.denominator)}) AS denominator"
        else:
            expr = (
                f"COUNT(DISTINCT {quote(m.column)})::DOUBLE"
                if m.kind == "distinct_count"
                else f"SUM({numeric(m.column)})"
            )
            aux = "NULL::DOUBLE AS numerator,NULL::DOUBLE AS denominator"
        if m.kind == "closing_balance":
            keys = ",".join(quote(k) for k in m.entity_keys)
            source = f"(SELECT * FROM {source} QUALIFY ROW_NUMBER() OVER(PARTITION BY {groups},{keys} ORDER BY __da_at DESC)=1)"
        return f"SELECT {groups},{expr} AS value,{aux},COUNT(*) AS rows_used FROM {source} GROUP BY {groups}"

    def compare(self, source="data", prefix=None):
        cte = prefix or self.cte
        result = self.query(
            cte
            + f""", agg AS ({self.aggregate(source)}), p AS (SELECT
          MAX(value) FILTER(WHERE __da_period='base') AS base_value,MAX(value) FILTER(WHERE __da_period='current') AS current_value,
          MAX(numerator) FILTER(WHERE __da_period='base') AS base_numerator,MAX(numerator) FILTER(WHERE __da_period='current') AS current_numerator,
          MAX(denominator) FILTER(WHERE __da_period='base') AS base_denominator,MAX(denominator) FILTER(WHERE __da_period='current') AS current_denominator,
          COALESCE(MAX(rows_used) FILTER(WHERE __da_period='base'),0) AS base_rows_used,
          COALESCE(MAX(rows_used) FILTER(WHERE __da_period='current'),0) AS current_rows_used FROM agg)
          SELECT *,current_value-base_value AS delta,(current_value-base_value)/NULLIF(ABS(base_value),0)*100 AS change_pct FROM p"""
        )[0]
        if any(isinstance(v, float) and not math.isfinite(v) for v in result.values()):
            raise ValueError(
                "Aggregate overflow/nonfinite result; rescale source units before analysis"
            )
        return result

    def envelope(self, operator, method, result, truncation=None):
        for key in ("comparison", "original", "reviewed"):
            r = result.get(key)
            if isinstance(r, dict) and (
                r.get("base_value") is None or r.get("current_value") is None
            ):
                self.warnings.append(
                    f"{key}: undefined aggregate (zero denominator or no retained records); not zero."
                )
        m = self.req.metric
        return AnalyticalToolResponse(
            summary=NarrativeBuilder.generate_tool_evidence_narrative(operator, result),
            result=result,
            evidence=structured_evidence(
                operator=operator,
                method=method,
                session_id=self.req.session_id,
                dataset_name=self.req.dataset_name,
                parameters=self.req.model_dump(mode="json"),
                population=self.population,
                metric_semantics={
                    "kind": m.kind,
                    "unit": m.unit,
                    "additive_over_time": m.kind == "sum",
                    "zero_denominator": "null",
                    "balance_policy": "last_per_entity_within_window_no_carry"
                    if m.kind == "closing_balance"
                    else None,
                },
                time_semantics={
                    **self.req.time.model_dump(mode="json"),
                    **self.calendar,
                    "end_exclusive": True,
                    "week_start": "Monday",
                    "watermark_source": "caller_assertion",
                    "missing_bucket": "null",
                },
                assumptions=[
                    "Source field business meanings and units are caller-declared.",
                    "Contributions and sensitivity are not causal effects.",
                ],
                warnings=self.warnings,
                truncation=truncation or {"truncated": False},
                sql=self.sql,
                duration_ms=self.clock.ms(),
            ),
        ).model_dump(mode="json")


def compare_metric(req: MetricCompareRequest):
    ctx = Context(req)
    comparison = ctx.compare()
    t = req.time
    series = ctx.query(
        ctx.cte
        + f""", buckets AS (SELECT *,DATE_TRUNC('{t.grain}',__da_date)::DATE AS bucket FROM data),
       agg AS ({ctx.aggregate("buckets", "__da_period,bucket")}),
       calendar AS (SELECT 'base' AS __da_period,d::DATE AS bucket FROM GENERATE_SERIES(DATE_TRUNC('{t.grain}',DATE '{t.base_start}'),DATE_TRUNC('{t.grain}',DATE '{t.base_end}'-INTERVAL '1 day'),INTERVAL '1 {t.grain}') AS t(d)
       UNION ALL SELECT 'current',d::DATE FROM GENERATE_SERIES(DATE_TRUNC('{t.grain}',DATE '{t.current_start}'),DATE_TRUNC('{t.grain}',DATE '{t.current_end}'-INTERVAL '1 day'),INTERVAL '1 {t.grain}') AS t(d))
       SELECT c.__da_period AS period,c.bucket,a.value,a.numerator,a.denominator,COALESCE(a.rows_used,0) AS rows_used
       FROM calendar c LEFT JOIN agg a USING(__da_period,bucket) ORDER BY c.bucket"""
    )
    return ctx.envelope(
        "compare_metric",
        "typed_metric_calendar_comparison",
        {"comparison": comparison, "series": series},
    )


def decompose_change(req: DecompositionRequest):
    mapped = [v for k, v in req.mapping.model_dump().items() if k != "discount_scale" and v]
    ctx = Context(req, [req.dimension, *mapped])
    comparison = ctx.compare()
    if req.mode == "dimension":
        d = quote(req.dimension)
        v = f"TRY_CAST({quote(req.metric.column)} AS DOUBLE)"
        cte = (
            ctx.cte
            + f""", members AS (SELECT CAST({d} AS VARCHAR) AS member,
          COALESCE(SUM({v}) FILTER(WHERE __da_period='base'),0) AS base_value,
          COALESCE(SUM({v}) FILTER(WHERE __da_period='current'),0) AS current_value FROM data GROUP BY 1),
          ranked AS (SELECT *,current_value-base_value AS contribution,ROW_NUMBER() OVER(ORDER BY ABS(current_value-base_value) DESC,member NULLS FIRST) AS rank FROM members)"""
        )
        rows = ctx.query(
            cte
            + f"SELECT member,base_value,current_value,contribution FROM ranked WHERE rank<={req.top_k} ORDER BY rank"
        )
        recon = ctx.query(
            cte
            + f""" SELECT COUNT(*) AS total_members,SUM(contribution) AS all_contributions,
          COALESCE(SUM(contribution) FILTER(WHERE rank<={req.top_k}),0) AS shown_contributions,
          COALESCE(SUM(contribution) FILTER(WHERE rank>{req.top_k}),0) AS omitted_contributions,
          SUM(contribution)-({comparison["delta"]}) AS reconciliation_error FROM ranked"""
        )[0]
        return ctx.envelope(
            "decompose_change",
            "additive_dimension",
            {"comparison": comparison, "contributions": rows, "reconciliation": recon},
            {
                "truncated": recon["total_members"] > len(rows),
                "returned": len(rows),
                "total": recon["total_members"],
            },
        )
    if req.mode == "ratio":
        if comparison["base_denominator"] == 0 or comparison["current_denominator"] == 0:
            raise ValueError("Ratio decomposition undefined for zero aggregate denominator")
        a, b, c, d = [
            comparison[k]
            for k in (
                "base_numerator",
                "current_numerator",
                "base_denominator",
                "current_denominator",
            )
        ]
        effects = ctx.query(f"""WITH f AS (SELECT ({b}-{a})*(1.0/{c}+1.0/{d})/2 AS numerator_effect,
          ({a}+{b})/2*(1.0/{d}-1.0/{c}) AS denominator_effect)
          SELECT *,numerator_effect+denominator_effect-({b}/{d}-{a}/{c}) AS reconciliation_error FROM f""")[
            0
        ]
        ctx.warnings.append(
            "Ratio split is the symmetric midpoint of numerator × reciprocal denominator; linked numerator/denominator changes are not independent causal interventions."
        )
        return ctx.envelope(
            "decompose_change", "ratio_midpoint", {"comparison": comparison, "effects": effects}
        )
    # Reuse the same profit implementation as the legacy report, scoped and timezone-normalized.
    t = req.time
    normalized = f"({ctx.cte} SELECT * REPLACE(__da_date AS {quote(t.column)}) FROM data)"
    proxy = SimpleNamespace(mapping=req.mapping, time_column=t.column, metric=req.metric.column)
    b = f"__date>=DATE '{t.base_start}' AND __date<DATE '{t.base_end}'"
    c = f"__date>=DATE '{t.current_start}' AND __date<DATE '{t.current_end}'"

    def query(_key, sql, limit=2500):
        return ctx.query(sql, limit)

    bridge, orders, checks = profit_bridge(proxy, normalized, "", b, c, query)
    if not bridge:
        raise ValueError("Profit mapping failed: " + "; ".join(checks))
    ctx.warnings.extend(checks)
    return ctx.envelope(
        "decompose_change",
        "hierarchical_midpoint_profit",
        {"comparison": comparison, "profit_bridge": bridge, "amount_mismatch_orders": orders},
        {
            "truncated": bool(orders and orders[0]["total_orders"] > len(orders)),
            "returned": len(orders),
            "total": orders[0]["total_orders"] if orders else 0,
        },
    )


def analyze_sensitivity(req: SensitivityRequest):
    ctx = Context(req, [req.anomaly_column, req.group_by, req.entity_column])
    original = ctx.compare()
    threshold = (
        req.threshold
        if req.threshold is not None
        else {"zscore": 3.0, "iqr": 1.5, "mad": 3.5}[req.method]
    )
    group = f"CAST({quote(req.group_by)} AS VARCHAR)" if req.group_by else "'all'"
    entity = (
        f"CAST({quote(req.entity_column)} AS VARCHAR)" if req.entity_column else "NULL::VARCHAR"
    )
    base_period = " AND __da_period='base'" if req.reference == "base" else ""
    cte = (
        ctx.cte
        + f""", obs AS (SELECT *,TRY_CAST({quote(req.anomaly_column)} AS DOUBLE) AS x,{group} AS grp,{entity} AS entity FROM data),
      ref AS (SELECT * FROM obs WHERE ISFINITE(x){base_period}),
      parameters AS (SELECT grp,AVG(x) AS mean,STDDEV_POP(x) AS std,MEDIAN(x) AS median,
      QUANTILE_CONT(x,0.25) AS q1,QUANTILE_CONT(x,0.75) AS q3,COUNT(*) AS reference_rows FROM ref GROUP BY grp),
      deviations AS (SELECT r.grp,MEDIAN(ABS(r.x-p.median)) AS mad FROM ref r JOIN parameters p ON r.grp IS NOT DISTINCT FROM p.grp GROUP BY r.grp),
      scored AS (SELECT o.*,p.mean,p.std,p.median,p.q1,p.q3,p.reference_rows,d.mad,
      {"ABS(o.x-p.mean)/NULLIF(p.std,0)" if req.method == "zscore" else "0.6744897501960817*ABS(o.x-p.median)/NULLIF(d.mad,0)" if req.method == "mad" else "NULL::DOUBLE"} AS score
      FROM obs o LEFT JOIN parameters p ON o.grp IS NOT DISTINCT FROM p.grp LEFT JOIN deviations d ON o.grp IS NOT DISTINCT FROM d.grp),
      flags AS (SELECT *,COALESCE(ISFINITE(x) AND reference_rows>=2 AND {"std>0" if req.method == "zscore" else "mad>0" if req.method == "mad" else "q1 IS NOT NULL"},FALSE) AS evaluable,
      COALESCE(ISFINITE(x) AND reference_rows>=2 AND {"score>=" + str(threshold) if req.method != "iqr" else "(x<q1-" + str(threshold) + "*(q3-q1) OR x>q3+" + str(threshold) + "*(q3-q1))"},FALSE) AS flagged FROM scored),
      reviewed AS (SELECT * FROM flags WHERE {"entity NOT IN (SELECT entity FROM flags WHERE flagged)" if req.removal == "entity" else "NOT flagged"})"""
    )
    if (
        req.removal == "entity"
        and ctx.query(cte + " SELECT COUNT(*) AS n FROM obs WHERE entity IS NULL")[0]["n"]
    ):
        raise ValueError("Entity removal requires non-null entity IDs in both periods")
    reviewed = ctx.compare("reviewed", cte)
    counts = ctx.query(
        cte
        + """ SELECT COUNT(*) AS rows_evaluated_population,COUNT(*) FILTER(WHERE NOT evaluable) AS unscored_rows,
      COUNT(*) FILTER(WHERE flagged) AS flagged_rows,(SELECT COUNT(*) FROM reviewed) AS retained_rows,
      COUNT(*)-(SELECT COUNT(*) FROM reviewed) AS removed_rows,COUNT(DISTINCT entity) FILTER(WHERE flagged) AS flagged_entities FROM flags"""
    )[0]
    records = ctx.query(
        cte
        + f""" SELECT __da_period AS period,__da_date AS date,__da_id AS query_row_id,entity,grp AS group_value,x AS value,score,
      mean,std,median,mad,q1,q3,reference_rows FROM flags WHERE flagged ORDER BY score DESC NULLS LAST,ABS(x) DESC,__da_id LIMIT {req.limit}"""
    )
    # Keep null outcomes null: an empty retained period is not a zero metric.
    old = original["delta"]
    new = reviewed["delta"]
    impact = ctx.query(
        f"SELECT CAST({new if new is not None else 'NULL'}-({old if old is not None else 'NULL'}) AS DOUBLE) AS delta_difference"
    )[0]
    if counts["unscored_rows"]:
        ctx.warnings.append(
            "Some rows are unscored (nonfinite anomaly value, missing/small reference group, zero std/MAD); they are retained, not proven normal."
        )
    ctx.warnings.extend(
        [
            "Sensitivity excludes rows/entities only in the selected windows and filters; source data is unchanged.",
            "Default reference is baseline only; pooled fitting must be explicitly requested.",
            "query_row_id is transient; use a stable entity ID for investigation.",
        ]
    )
    return ctx.envelope(
        "analyze_sensitivity",
        req.method,
        {
            "original": original,
            "reviewed": reviewed,
            "impact": impact,
            "counts": counts,
            "candidates": records,
            "threshold": threshold,
        },
        {
            "truncated": counts["flagged_rows"] > len(records),
            "returned": len(records),
            "total": counts["flagged_rows"],
        },
    )
