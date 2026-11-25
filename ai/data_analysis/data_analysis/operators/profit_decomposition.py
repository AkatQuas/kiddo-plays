"""Shared midpoint accounting decomposition used by reports and independent tools."""


def quote(name):
    return '"' + name.replace('"', '""') + '"'


_PROFIT_BRIDGE_SQL = """,
      samples AS (SELECT 'reported' AS scenario,* FROM scoped UNION ALL SELECT 'review' AS scenario,* FROM scoped WHERE order_id NOT IN (SELECT order_id FROM flagged)),
      g AS (SELECT scenario,product_id,__period AS period,
        SUM(quantity)::DOUBLE AS q,SUM(quantity*unit_price)/NULLIF(SUM(quantity),0) AS p,
        COALESCE(SUM(quantity*unit_price*discount)/NULLIF(SUM(quantity*unit_price),0),0) AS d,
        SUM(cogs)/NULLIF(SUM(quantity),0) AS c,SUM(residual) AS r,SUM(profit) AS profit,
        SUM(profit-(sales-cogs)) AS ledger_gap
        FROM samples GROUP BY ALL),
      pairs AS (SELECT scenario,product_id,
        COALESCE(MAX(q) FILTER(WHERE period='base'),0) AS q0,COALESCE(MAX(q) FILTER(WHERE period='current'),0) AS q1,
        COALESCE(MAX(p) FILTER(WHERE period='base'),MAX(p) FILTER(WHERE period='current')) AS p0,
        COALESCE(MAX(p) FILTER(WHERE period='current'),MAX(p) FILTER(WHERE period='base')) AS p1,
        COALESCE(MAX(d) FILTER(WHERE period='base'),MAX(d) FILTER(WHERE period='current')) AS d0,
        COALESCE(MAX(d) FILTER(WHERE period='current'),MAX(d) FILTER(WHERE period='base')) AS d1,
        COALESCE(MAX(c) FILTER(WHERE period='base'),MAX(c) FILTER(WHERE period='current')) AS c0,
        COALESCE(MAX(c) FILTER(WHERE period='current'),MAX(c) FILTER(WHERE period='base')) AS c1,
        COALESCE(SUM(r) FILTER(WHERE period='current'),0)-COALESCE(SUM(r) FILTER(WHERE period='base'),0) AS residual_effect,
        COALESCE(SUM(ledger_gap) FILTER(WHERE period='current'),0)-COALESCE(SUM(ledger_gap) FILTER(WHERE period='base'),0) AS ledger_effect,
        COALESCE(SUM(profit) FILTER(WHERE period='base'),0) AS base_profit,
        COALESCE(SUM(profit) FILTER(WHERE period='current'),0) AS current_profit
        FROM g GROUP BY scenario,product_id),
      totals AS (SELECT *,SUM(q0) OVER(PARTITION BY scenario) AS Q_base,SUM(q1) OVER(PARTITION BY scenario) AS Q_current,
        p0*(1-d0)-c0 AS m0,p1*(1-d1)-c1 AS m1 FROM pairs),
      effects AS (SELECT *,q0/NULLIF(Q_base,0) AS s0,q1/NULLIF(Q_current,0) AS s1 FROM totals),
      result AS (SELECT scenario,MAX(Q_base) AS base_quantity,MAX(Q_current) AS current_quantity,
        SUM(base_profit) AS base_profit,SUM(current_profit) AS current_profit,
        SUM((Q_current-Q_base)*(s0*m0+s1*m1)/2) AS volume_effect,
        SUM((Q_base+Q_current)/2*(s1-s0)*(m0+m1)/2) AS mix_effect,
        SUM((Q_base+Q_current)/2*(s0+s1)/2*(p1-p0)*(1-(d0+d1)/2)) AS price_effect,
        SUM(-(Q_base+Q_current)/2*(s0+s1)/2*(p0+p1)/2*(d1-d0)) AS discount_effect,
        SUM(-(Q_base+Q_current)/2*(s0+s1)/2*(c1-c0)) AS cost_effect,
        SUM(residual_effect) AS residual_effect,SUM(ledger_effect) AS ledger_effect
        FROM effects GROUP BY scenario)
      SELECT *,current_profit-base_profit AS delta,
        (current_profit-base_profit)/NULLIF(ABS(base_profit),0)*100 AS change_pct,
        current_profit-base_profit-volume_effect-mix_effect-price_effect-discount_effect-cost_effect-residual_effect-ledger_effect AS reconciliation_error,
        base_quantity>0 AND current_quantity>0 AS comparable FROM result ORDER BY scenario"""


def profit_bridge(req, table, filter_sql, b, c, query):
    m = req.mapping

    def num(key):
        return f"TRY_CAST({quote(getattr(m, key))} AS DOUBLE)"

    order = (
        f"CAST({quote(m.order)} AS VARCHAR)" if m.order else "CAST(ROW_NUMBER() OVER() AS VARCHAR)"
    )
    raw = f"""WITH n AS (SELECT TRY_CAST({quote(req.time_column)} AS DATE) AS __date,
      CAST({quote(m.product)} AS VARCHAR) AS product_id,{order} AS order_id,
      {num("quantity")} AS quantity,{num("price")} AS unit_price,{num("discount")}/{m.discount_scale} AS discount,
      {num("sales")} AS sales,{num("cost")} AS cogs,TRY_CAST({quote(req.metric)} AS DOUBLE) AS profit FROM {table}{filter_sql}),
      scoped_raw AS (SELECT * FROM n WHERE ({b}) OR ({c}))"""
    validations = query(
        "profit_validation",
        raw
        + """ SELECT COUNT(*) AS rows,
      COUNT(*) FILTER(WHERE product_id IS NULL OR order_id IS NULL OR NOT COALESCE(
      ISFINITE(quantity) AND quantity>0 AND ISFINITE(unit_price) AND unit_price>=0 AND ISFINITE(discount) AND discount>=0 AND discount<=1
      AND ISFINITE(cogs) AND cogs>=0 AND ISFINITE(sales) AND ISFINITE(profit),FALSE)) AS invalid_rows,
      COUNT(*) FILTER(WHERE ABS(profit-(sales-cogs))>0.01) AS ledger_mismatch FROM scoped_raw""",
    )[0]
    checks = []
    if validations["invalid_rows"] or validations["ledger_mismatch"]:
        return (
            [],
            [],
            [
                f"利润映射校验未通过：{validations['invalid_rows']} 行非法/缺失数值、非正数量或折扣范围错误；{validations['ledger_mismatch']} 行指标不等于销售额−销售成本（容差0.01）。退货/净利润等需另建适用口径。"
            ],
        )
    source = (
        raw
        + f""",source AS (SELECT *,CASE WHEN {b} THEN 'base' ELSE 'current' END AS __period,
      sales-quantity*unit_price*(1-discount) AS residual FROM scoped_raw),
      flagged AS (SELECT DISTINCT order_id FROM source WHERE ABS(residual)>0.01),scoped AS (SELECT * FROM source)"""
    )
    bridge = query("profit_bridge", source + _PROFIT_BRIDGE_SQL)
    # Whole-order sensitivity within the selected comparison scope; never delete source records.
    orders = query(
        "amount_mismatch",
        source
        + """ SELECT order_id,MIN(__date) AS date,SUM(profit) AS profit,
      SUM(residual) AS amount_gap,COUNT(*) AS lines,COUNT(*) OVER() AS total_orders FROM source
      WHERE order_id IN (SELECT order_id FROM flagged) GROUP BY order_id ORDER BY ABS(amount_gap) DESC LIMIT 20""",
    )
    checks.extend(
        [
            "利润桥以所选两个期间计算，与源数据年份无关。",
            "层级中点法区分件数、SKU组合、同品标价、折扣、单位成本；标价/单位成本变化不等于整体均价变化。",
            "金额公式偏差容差为源金额单位0.01；排除含偏差记录的订单只是敏感性对照，范围外/窗口外明细不参与；不修改数据。",
            "成本字段必须为行总销售成本；折扣是减免比例（0.2代表减免20%），不是八折的0.8。",
        ]
    )
    if not m.order:
        checks.append("未映射订单号：敏感性对照按行排除，不能解释为整单排除。")
    if any(not r["comparable"] for r in bridge):
        checks.append("排除异常后可能缺少完整比较期；不可比的桥不应解释。")
    return bridge, orders, checks
