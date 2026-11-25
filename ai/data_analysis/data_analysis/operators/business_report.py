"""General reports over uploaded session tables; all computation runs in DuckDB.

No generated SQL identifiers from model guesses: validate schema membership, quote
identifiers, bind/escape literals, and use the existing read-only SQL operator.
"""

from data_analysis.engine.evidence import Stopwatch, structured_evidence
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.operators.sandbox import run_duckdb_sql
from data_analysis.schemas.requests import BusinessReportRequest


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def _query(session_id, sql, limit=2500):
    return run_duckdb_sql(
        session_id, sql, limit=limit, governed=True, endorsed_only=False, record_trail=False
    )["data"]


def _schema(session_id, table):
    if not isinstance(table, str) or not table.strip():
        raise ValueError("数据表不存在或会话已失效，请重新导入")
    safe = quote(table)
    try:
        schema = _query(session_id, f"DESCRIBE {safe}")
    except Exception as exc:
        raise ValueError("数据表不存在或会话已失效，请重新导入") from exc
    if any(r["column_name"] in ("__date", "__metric") for r in schema):
        raise ValueError("请先重命名保留字段 __date / __metric")
    return safe, schema


def discover_report(session_id, dataset_name, grain="month"):
    if grain not in ("day", "week", "month", "quarter", "year"):
        raise ValueError("未知时间粒度")
    table, schema = _schema(session_id, dataset_name)
    names = [r["column_name"] for r in schema]
    numeric = [
        r["column_name"]
        for r in schema
        if any(t in r["column_type"] for t in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "REAL"))
    ]
    aliases = {
        "metric": [
            "profit",
            "利润",
            "毛利",
            "sales",
            "销售额",
            "revenue",
            "收入",
            "amount",
            "金额",
        ],
        "time_column": ["order_date", "date", "日期", "订单日期", "交易日期", "timestamp", "时间"],
        "product": ["product_id", "sku", "商品编号", "商品", "产品"],
        "quantity": ["quantity", "qty", "数量", "销量"],
        "price": ["unit_price", "list_price", "标价", "单价"],
        "discount": ["discount", "折扣率", "discount_rate"],
        "sales": ["sales", "revenue", "销售额", "收入", "amount", "金额"],
        "cost": ["cogs", "成本", "销售成本"],
        "order": ["order_id", "订单号", "订单编号"],
    }
    suggestions = {
        k: next((n for a in values for n in names if n.lower() == a.lower()), None)
        for k, values in aliases.items()
    }
    suggestions["metric"] = suggestions["metric"] or (numeric[0] if numeric else None)
    suggestions["time_column"] = suggestions["time_column"] or next(
        (
            r["column_name"]
            for r in schema
            if "DATE" in r["column_type"] or "TIMESTAMP" in r["column_type"]
        ),
        None,
    )
    periods = None
    if suggestions["time_column"]:
        col = quote(suggestions["time_column"])
        periods = _query(
            session_id,
            f"""WITH x AS (SELECT DATE_TRUNC('{grain}',MAX(TRY_CAST({col} AS DATE))) AS d FROM {table})
          SELECT CAST(d-INTERVAL '1 {grain}' AS DATE) AS base_start,CAST(d AS DATE) AS base_end,
          CAST(d AS DATE) AS current_start,CAST(d+INTERVAL '1 {grain}' AS DATE) AS current_end FROM x""",
        )[0]
    return {
        "columns": schema,
        "numeric_columns": numeric,
        "suggestions": suggestions,
        "periods": periods,
        "notice": "字段匹配只是候选，请确认业务含义。默认比较最新有记录期间与前一期；最新期间可能不完整。指标按SUM计算，比例/余额/去重人数不能直接相加。",
    }


def generate_business_report(req: BusinessReportRequest):
    clock = Stopwatch()
    table, schema = _schema(req.session_id, req.dataset_name)
    names = {r["column_name"] for r in schema}
    chosen = [
        req.metric,
        req.time_column,
        *req.dimensions,
        *req.filters.keys(),
        *[v for k, v in req.mapping.model_dump().items() if k != "discount_scale" and v],
        req.filter_dimension,
    ]
    for col in chosen:
        if col is not None and col not in names:
            raise ValueError(f"字段不存在：{col}")
    metric = quote(req.metric)
    time = quote(req.time_column)
    filters = dict(req.filters)
    if req.filter_dimension:
        filters[req.filter_dimension] = req.filter_value
    filter_sql = (
        (
            " WHERE "
            + " AND ".join(
                f"CAST({quote(k)} AS VARCHAR) = {literal(v)}" for k, v in filters.items()
            )
        )
        if filters
        else ""
    )
    source = f"WITH raw AS (SELECT *,TRY_CAST({time} AS DATE) AS __date,TRY_CAST({metric} AS DOUBLE) AS __metric FROM {table}{filter_sql}), valid AS (SELECT * FROM raw WHERE __date IS NOT NULL AND ISFINITE(__metric))"
    b = f"__date >= DATE '{req.base_start}' AND __date < DATE '{req.base_end}'"
    c = f"__date >= DATE '{req.current_start}' AND __date < DATE '{req.current_end}'"
    window = f"__date >= DATE '{req.base_start}' AND __date < DATE '{req.current_end}'"
    queries = {}

    def query(key, sql, limit=2500):
        queries[key] = sql
        return _query(req.session_id, sql, limit)

    stats = query(
        "comparison",
        source
        + f""", agg AS (SELECT COUNT(*) AS valid_rows,
        COALESCE(SUM(__metric) FILTER(WHERE {b}),0) AS base_value,COALESCE(SUM(__metric) FILTER(WHERE {c}),0) AS current_value,
        COUNT(*) FILTER(WHERE {b}) AS base_rows,COUNT(*) FILTER(WHERE {c}) AS current_rows,
        MIN(__date) AS observed_start,MAX(__date) AS observed_end FROM valid)
      SELECT *,current_value-base_value AS delta,(current_value-base_value)/NULLIF(ABS(base_value),0)*100 AS change_pct,
      (SELECT COUNT(*) FROM raw) AS total_rows,(SELECT COUNT(*) FROM raw WHERE __date IS NULL OR NOT COALESCE(ISFINITE(__metric),FALSE)) AS excluded_rows FROM agg""",
    )[0]
    if not stats["base_rows"] or not stats["current_rows"]:
        raise ValueError("基期或当期没有有效记录，请调整比较窗口；不将缺失期间冒充零业务")
    grain = req.grain
    series = query(
        "time",
        source
        + f""", calendar AS (SELECT d::DATE AS period FROM GENERATE_SERIES(DATE_TRUNC('{grain}',DATE '{req.base_start}'),DATE_TRUNC('{grain}',DATE '{req.current_end}'-INTERVAL '1 day'),INTERVAL '1 {grain}') AS t(d)),
      g AS (SELECT DATE_TRUNC('{grain}',__date)::DATE AS period,SUM(__metric) AS value,COUNT(*) AS rows FROM valid WHERE {window} GROUP BY 1),
      s AS (SELECT c.period,g.value,COALESCE(g.rows,0) AS rows FROM calendar c LEFT JOIN g USING(period))
      SELECT a.*,a.value-LAG(a.value) OVER(ORDER BY a.period) AS previous_delta,
      (a.value-LAG(a.value) OVER(ORDER BY a.period))/NULLIF(ABS(LAG(a.value) OVER(ORDER BY a.period)),0)*100 AS previous_pct,
      {"NULL" if grain == "week" else "a.value-b.value"} AS yoy_delta,
      {"NULL" if grain == "week" else "(a.value-b.value)/NULLIF(ABS(b.value),0)*100"} AS yoy_pct
      FROM s a LEFT JOIN s b ON b.period=(a.period-INTERVAL '1 year')::DATE ORDER BY a.period""",
    )
    dims = []
    for dim in req.dimensions:
        d = quote(dim)
        rows = query(
            "dimension_" + dim,
            source
            + f""", g AS (SELECT CAST({d} AS VARCHAR) AS member,
          COALESCE(SUM(__metric) FILTER(WHERE {b}),0) AS base_value,COALESCE(SUM(__metric) FILTER(WHERE {c}),0) AS current_value
          FROM valid WHERE ({b}) OR ({c}) GROUP BY 1), ranked AS (SELECT *,current_value-base_value AS delta FROM g)
          SELECT *,SUM(delta) OVER() AS dimension_delta,COUNT(*) OVER() AS total_members FROM ranked ORDER BY ABS(delta) DESC LIMIT 50""",
        )
        dims.append(
            {
                "dimension": dim,
                "rows": rows,
                "truncated": bool(rows and rows[0]["total_members"] > 50),
            }
        )
    anomalies = query(
        "anomalies",
        source
        + f""", z AS (SELECT __date AS date,__metric AS value,
        (__metric-AVG(__metric) OVER())/NULLIF(STDDEV_POP(__metric) OVER(),0) AS z_score FROM valid WHERE ({b}) OR ({c}))
        SELECT *,COUNT(*) OVER() AS total_anomalies FROM z WHERE ABS(z_score)>=3 ORDER BY ABS(z_score) DESC LIMIT 20""",
    )
    skipped = []
    checks = [
        f"排除 {stats['excluded_rows']} 行无法解析的日期/非有限指标值。",
        "指标采用 SUM；确认是可加总的流量指标，不是比例、快照余额或去重人数。",
        f"基期 {req.base_start} 至 {req.base_end}，当期 {req.current_start} 至 {req.current_end}；结束日不包含。",
        "无记录的时间桶保留为空，不自动补零；首末桶、最新期间及不等长窗口需核对完整性。同比只在报告时间窗含上一年同期时计算，周同比不计算；闰日需谨慎。",
        "维度分别分解同一总变化，不可跨维度重复相加；Top 50 可能截断。",
    ]
    next_steps = ["先核查日期、金额单位、退货和重复记录，以及两段期间是否完整可比。"]
    for group in dims:
        if group["rows"]:
            r = group["rows"][0]
            next_steps.append(
                f"沿 {group['dimension']} = {r['member']} 下钻：变化 {r['delta']:,.2f}；核对客户/商品/渠道明细。"
            )
    if anomalies:
        next_steps.append(
            "核查极端记录的原始凭证；|Z|≥3 只是候选异常，重尾数据可能不适用，不自动删除。"
        )
    bridge = []
    orders = []
    mapping = req.mapping
    fields = ["product", "quantity", "price", "discount", "sales", "cost"]
    missing = [k for k in fields if not getattr(mapping, k)]
    if missing:
        skipped.append("量价成本分解未执行，缺少字段映射：" + ", ".join(missing))
    else:
        bridge, orders, profit_checks = _profit(req, table, filter_sql, b, c, query)
        checks.extend(profit_checks)
        if not bridge:
            skipped.append("量价分解未启用：映射字段或利润口径未通过校验，请看核查项。")
        else:
            r = next(x for x in bridge if x["scenario"] == "reported")
            labels = {
                "volume_effect": "销量",
                "mix_effect": "商品组合",
                "price_effect": "同品标价",
                "discount_effect": "折扣",
                "cost_effect": "单位成本",
                "residual_effect": "金额公式差额",
            }
            for key in sorted(labels, key=lambda k: r.get(k) or 0)[:2]:
                if (r.get(key) or 0) < -0.01:
                    next_steps.append(
                        f"{labels[key]}负向贡献 {r[key]:,.2f}：核对对应交易、合同、折扣审批或成本凭证；这是会计贡献，不是因果效应。"
                    )
    summary = NarrativeBuilder.generate_business_report_narrative(stats, req.metric)
    standardized = structured_evidence(
        operator="generate_business_report",
        method="sum_report_with_optional_profit_midpoint",
        session_id=req.session_id,
        dataset_name=req.dataset_name,
        parameters=req.model_dump(mode="json"),
        population={
            k: stats[k]
            for k in ["total_rows", "valid_rows", "excluded_rows", "base_rows", "current_rows"]
        },
        metric_semantics={
            "kind": "sum",
            "column": req.metric,
            "additive_over_time": True,
            "unit": "caller_defined",
        },
        time_semantics={
            "column": req.time_column,
            "grain": req.grain,
            "end_exclusive": True,
            "missing_bucket": "null",
            "completeness": "unknown",
            "contract": "legacy_report",
        },
        assumptions=["The caller declares an additive metric."],
        warnings=checks
        + skipped
        + [
            "Legacy report does not enforce completeness watermark; use compare_metric for the strict time contract."
        ],
        truncation={
            "truncated": any(g["truncated"] for g in dims)
            or bool(anomalies and anomalies[0]["total_anomalies"] > len(anomalies))
            or bool(orders and orders[0]["total_orders"] > len(orders)),
            "dimension_limit": 50,
            "anomaly_limit": 20,
            "order_limit": 20,
        },
        sql=queries.values(),
        duration_ms=clock.ms(),
    )
    return {
        "session_id": req.session_id,
        "dataset_name": req.dataset_name,
        "summary": summary,
        "statistics": stats,
        "series": series,
        "dimensions": dims,
        "anomalies": anomalies,
        "profit_bridge": bridge,
        "checks": checks,
        "next_steps": next_steps,
        "skipped": skipped,
        "evidence": {
            **standardized,
            "request": req.model_dump(mode="json"),
            "queries": queries,
            "orders": orders,
            "method": "SUM contribution; hierarchical midpoint profit decomposition; population Z-score; no causal identification",
        },
    }


# Shared independent implementation; preserve the legacy report call signature.
from data_analysis.operators.profit_decomposition import profit_bridge as _profit
