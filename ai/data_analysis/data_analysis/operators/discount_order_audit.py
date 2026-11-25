"""Deterministic discount review priorities with explicit baseline fallbacks and order scope."""

from data_analysis.operators.analytical_tools import Context
from data_analysis.operators.business_report import literal, quote
from data_analysis.schemas.requests import DiscountOrderAuditRequest


def _audit_context(req: DiscountOrderAuditRequest):
    m = req.mapping
    ctx = Context(
        req,
        [
            req.customer_column,
            req.channel_column,
            *[v for k, v in m.model_dump().items() if k != "discount_scale" and v],
        ],
    )
    original = ctx.compare()

    def n(k):
        return f"TRY_CAST({quote(getattr(m, k))} AS DOUBLE)"

    selected = (
        "sku IN (" + ",".join(literal(x) for x in req.product_ids) + ")"
        if req.product_ids
        else "TRUE"
    )
    cte = (
        ctx.cte
        + f""", audit_lines AS (SELECT __da_id,__da_period,__da_date,
      CAST({quote(m.order)} AS VARCHAR) AS oid,CAST({quote(m.product)} AS VARCHAR) AS sku,
      CAST({quote(req.customer_column)} AS VARCHAR) AS customer,CAST({quote(req.channel_column)} AS VARCHAR) AS channel,
      {n("quantity")} AS quantity,{n("price")} AS price,{n("discount")}/{m.discount_scale} AS discount,
      {n("sales")} AS sales,{n("cost")} AS cost,TRY_CAST({quote(req.metric.column)} AS DOUBLE) AS profit FROM data),
      audit_values AS (SELECT *,quantity*price AS gross,sales-gross*(1-discount) AS gap,profit-(sales-cost) AS ledger_gap FROM audit_lines),
      audit_excluded AS (SELECT DISTINCT oid FROM audit_values WHERE
        {"ABS(gap)>" + str(req.amount_tolerance) + " OR ABS(ledger_gap)>" + str(req.amount_tolerance) if req.exclude_amount_mismatches else "FALSE"}
        {" OR oid IN (" + ",".join(literal(x) for x in req.exclude_order_ids) + ")" if req.exclude_order_ids else ""}),
      audit_clean AS (SELECT * FROM audit_values WHERE oid NOT IN (SELECT oid FROM audit_excluded)),
      audit_target AS (SELECT * FROM audit_clean WHERE {selected}),
      ref_exact AS (SELECT sku,customer,channel,COUNT(DISTINCT oid) AS n,SUM(gross*discount)/NULLIF(SUM(gross),0) AS rate
        FROM audit_target WHERE __da_period='base' GROUP BY sku,customer,channel),
      ref_channel AS (SELECT sku,channel,COUNT(DISTINCT oid) AS n,SUM(gross*discount)/NULLIF(SUM(gross),0) AS rate
        FROM audit_target WHERE __da_period='base' GROUP BY sku,channel),
      ref_product AS (SELECT sku,COUNT(DISTINCT oid) AS n,SUM(gross*discount)/NULLIF(SUM(gross),0) AS rate
        FROM audit_target WHERE __da_period='base' GROUP BY sku),
      benchmark AS (SELECT t.*,CASE WHEN e.n>={req.min_reference_orders} AND e.rate IS NOT NULL THEN e.rate
        WHEN ch.n>={req.min_reference_orders} AND ch.rate IS NOT NULL THEN ch.rate
        WHEN p.n>={req.min_reference_orders} AND p.rate IS NOT NULL THEN p.rate END AS reference_rate,
        CASE WHEN e.n>={req.min_reference_orders} AND e.rate IS NOT NULL THEN 'same_product_customer_channel'
        WHEN ch.n>={req.min_reference_orders} AND ch.rate IS NOT NULL THEN 'same_product_channel'
        WHEN p.n>={req.min_reference_orders} AND p.rate IS NOT NULL THEN 'same_product' ELSE 'unavailable' END AS reference_level,
        CASE WHEN e.n>={req.min_reference_orders} AND e.rate IS NOT NULL THEN e.n
        WHEN ch.n>={req.min_reference_orders} AND ch.rate IS NOT NULL THEN ch.n
        WHEN p.n>={req.min_reference_orders} AND p.rate IS NOT NULL THEN p.n END AS reference_orders
        FROM audit_target t LEFT JOIN ref_exact e ON t.sku=e.sku AND t.customer=e.customer AND t.channel=e.channel
        LEFT JOIN ref_channel ch ON t.sku=ch.sku AND t.channel=ch.channel LEFT JOIN ref_product p ON t.sku=p.sku
        WHERE t.__da_period='current'),
      scored AS (SELECT *,discount-reference_rate AS discount_increase,
        gross*(discount-reference_rate) AS discount_burden,
        gross*(1-reference_rate)-cost AS reference_formula_profit,
        gross-cost AS before_discount_formula_profit,gross*(1-discount)-cost AS after_discount_formula_profit,
        1-cost/NULLIF(gross,0) AS break_even_discount,
        ABS(gap)<={req.amount_tolerance} AND ABS(ledger_gap)<={req.amount_tolerance} AS accounting_valid FROM benchmark),
      whole_orders AS (SELECT oid,SUM(profit) AS scoped_order_profit,SUM(gross-cost) AS scoped_order_before_discount,
        BOOL_AND(ABS(gap)<={req.amount_tolerance} AND ABS(ledger_gap)<={req.amount_tolerance}) AS whole_accounting_valid,
        COUNT(*) AS scoped_order_lines FROM audit_clean WHERE __da_period='current' GROUP BY oid),
      order_totals AS (SELECT s.oid,MIN(__da_date) AS date,STRING_AGG(DISTINCT customer,', ' ORDER BY customer) AS customers,
        STRING_AGG(DISTINCT channel,', ' ORDER BY channel) AS channels,SUM(s.profit) AS selected_profit,SUM(gross) AS list_amount,
        SUM(gross*discount)/NULLIF(SUM(gross),0) AS discount_rate,
        SUM(gross*reference_rate)/NULLIF(SUM(gross) FILTER(WHERE reference_rate IS NOT NULL),0) AS reference_rate,
        SUM(discount_burden) AS discount_burden,SUM(GREATEST(discount_burden,0)) FILTER(WHERE discount_burden IS NOT NULL) AS deeper_discount_amount,
        SUM(reference_formula_profit) AS reference_formula_profit,SUM(before_discount_formula_profit) AS before_discount_formula_profit,
        SUM(after_discount_formula_profit) AS after_discount_formula_profit,
        COUNT(*) AS selected_lines,COUNT(*) FILTER(WHERE reference_rate IS NULL) AS unbenchmarked_lines,
        BOOL_AND(accounting_valid) AND BOOL_AND(w.whole_accounting_valid) AS accounting_valid,
        STRING_AGG(DISTINCT reference_level,', ' ORDER BY reference_level) AS reference_levels,
        MAX(w.scoped_order_profit) AS scoped_order_profit,MAX(w.scoped_order_before_discount) AS scoped_order_before_discount,
        MAX(w.scoped_order_lines) AS scoped_order_lines FROM scored s JOIN whole_orders w USING(oid) GROUP BY s.oid),
      prioritized AS (SELECT *,CASE
        WHEN NOT accounting_valid THEN 'P0_ACCOUNTING'
        WHEN scoped_order_profit<0 AND scoped_order_before_discount>=0 THEN 'P1_LOSS'
        WHEN selected_profit<0 AND before_discount_formula_profit>=0 AND deeper_discount_amount>0 THEN 'P2_SELECTED_LOSS'
        WHEN deeper_discount_amount>={req.materiality} AND deeper_discount_amount>0 THEN 'P2_MATERIAL'
        WHEN unbenchmarked_lines>0 THEN 'P3_REFERENCE'
        ELSE 'P3_ROUTINE' END AS priority,
        CASE WHEN scoped_order_profit<0 AND scoped_order_before_discount>=0 THEN TRUE ELSE FALSE END AS order_crosses_break_even
        FROM order_totals),
      ranked_priority AS (SELECT *,CASE priority WHEN 'P0_ACCOUNTING' THEN 0 WHEN 'P1_LOSS' THEN 1 WHEN 'P2_SELECTED_LOSS' THEN 2 WHEN 'P2_MATERIAL' THEN 3 WHEN 'P3_REFERENCE' THEN 4 ELSE 5 END AS priority_rank FROM prioritized)"""
    )
    bad = ctx.query(
        cte
        + """ SELECT COUNT(*) AS n FROM audit_lines WHERE oid IS NULL OR sku IS NULL OR NOT COALESCE(
      ISFINITE(quantity) AND quantity>0 AND ISFINITE(price) AND price>=0 AND ISFINITE(discount) AND discount BETWEEN 0 AND 1
      AND ISFINITE(sales) AND ISFINITE(cost) AND cost>=0,FALSE)"""
    )[0]["n"]
    if bad:
        raise ValueError(f"{bad} invalid mapped rows; repair source/mapping before auditing")
    return ctx, cte, original


def audit_discount_orders(req: DiscountOrderAuditRequest):
    ctx, cte, original = _audit_context(req)
    counts = ctx.query(
        cte
        + """ SELECT (SELECT COUNT(*) FROM audit_excluded) AS excluded_orders,
      COUNT(*) FILTER(WHERE __da_period='base') AS selected_base_rows,
      COUNT(*) FILTER(WHERE __da_period='current') AS selected_current_rows FROM audit_target"""
    )[0]
    if not counts["selected_current_rows"]:
        raise ValueError("No retained current-period rows for selected products")
    summary = ctx.query(
        cte
        + """ SELECT COUNT(*) AS current_orders,SUM(selected_profit) AS selected_profit,
      SUM(discount_burden) AS discount_burden,SUM(deeper_discount_amount) AS deeper_discount_amount,
      CAST(SUM(unbenchmarked_lines) AS BIGINT) AS unbenchmarked_lines,
      COUNT(*) FILTER(WHERE selected_profit<0) AS selected_loss_orders,
      COUNT(*) FILTER(WHERE scoped_order_profit<0) AS loss_orders,
      SUM(scoped_order_profit) FILTER(WHERE scoped_order_profit<0) AS loss_order_profit,
      COUNT(*) FILTER(WHERE priority='P1_LOSS') AS p1_orders,
      COUNT(*) FILTER(WHERE priority IN ('P2_SELECTED_LOSS','P2_MATERIAL')) AS p2_orders,
      COUNT(*) FILTER(WHERE priority='P0_ACCOUNTING') AS accounting_review_orders FROM prioritized"""
    )[0]
    orders = ctx.query(
        cte
        + f""" SELECT *,COUNT(*) OVER() AS matched_orders FROM ranked_priority
       ORDER BY priority_rank,deeper_discount_amount DESC NULLS LAST,scoped_order_profit,oid LIMIT {req.top_k}""",
        req.top_k,
    )
    breakdown = {}
    for dimension in ["sku", "customer", "channel"]:
        breakdown[dimension] = ctx.query(
            cte
            + f""" SELECT {dimension} AS member,COUNT(DISTINCT oid) AS orders,
          SUM(profit) AS selected_profit,SUM(discount_burden) AS discount_burden,
          SUM(gross*discount)/NULLIF(SUM(gross),0) AS current_discount_rate,
          SUM(gross*reference_rate)/NULLIF(SUM(gross) FILTER(WHERE reference_rate IS NOT NULL),0) AS reference_rate,
          COUNT(*) FILTER(WHERE reference_rate IS NULL) AS unbenchmarked_lines,
          COUNT(*) OVER() AS total_members FROM scored GROUP BY {dimension}
          ORDER BY discount_burden DESC NULLS LAST,member NULLS FIRST LIMIT {req.top_k}""",
            req.top_k,
        )
    for key in ["customer", "channel"]:
        for row in breakdown[key]:
            if row["member"] is not None:
                row["drilldown"] = {
                    "tool": "audit_discount_orders",
                    "request": {
                        **req.model_dump(mode="json"),
                        "focus_order_id": None,
                        "focus_customer": row["member"] if key == "customer" else None,
                        "focus_channel": row["member"] if key == "channel" else None,
                    },
                }
    coverage = ctx.query(
        cte
        + """ SELECT reference_level,COUNT(*) AS lines,SUM(gross) AS list_amount,
      SUM(discount_burden) AS discount_burden FROM scored GROUP BY reference_level ORDER BY reference_level"""
    )
    focus = None
    focus_conditions = [
        f"{column}={literal(value)}"
        for column, value in [
            ("oid", req.focus_order_id),
            ("customer", req.focus_customer),
            ("channel", req.focus_channel),
        ]
        if value is not None
    ]
    if focus_conditions:
        focus_where = " AND ".join(focus_conditions)
        focusrows = ctx.query(
            cte
            + f""" SELECT *,COUNT(*) OVER() AS matched_lines FROM scored WHERE {focus_where}
          ORDER BY discount_burden DESC NULLS LAST,sku,__da_id LIMIT 100""",
            100,
        )
        whole = ctx.query(
            cte
            + f""" SELECT oid,sku,customer,channel,quantity,price,discount,sales,cost,profit,gap,ledger_gap,
          COUNT(*) OVER() AS matched_lines FROM audit_clean WHERE __da_period='current' AND oid IN (SELECT oid FROM scored WHERE {focus_where})
          ORDER BY sku,__da_id LIMIT 100""",
            100,
        )
        focus = {
            "order_id": req.focus_order_id,
            "customer": req.focus_customer,
            "channel": req.focus_channel,
            "selected_lines": focusrows,
            "scoped_order_lines": whole,
            "selected_truncated": bool(
                focusrows and focusrows[0]["matched_lines"] > len(focusrows)
            ),
            "whole_truncated": bool(whole and whole[0]["matched_lines"] > len(whole)),
        }
    reasons = {
        "P0_ACCOUNTING": "先修复金额或利润账式；折扣解释暂不可靠。",
        "P1_LOSS": "当前筛选范围整单亏损、未折扣公式毛利非负；优先核对折扣合同与审批，是否加深须另看基期参考。",
        "P2_SELECTED_LOSS": "目标商品亏损且存在超基准折扣，但筛选范围整单未必亏损。",
        "P2_MATERIAL": "超基准折扣金额达到配置门槛，核对促销、客户等级和授权。",
        "P3_REFERENCE": "缺少足量基期参考订单，先补充可比价格/合同证据。",
        "P3_ROUTINE": "未命中更高优先级规则；不代表已经审计通过。",
    }
    for row in orders:
        row["reason"] = reasons[row["priority"]] + (
            f" 基期参考不足 {row['unbenchmarked_lines']} 行，基准金额仅覆盖其余行。"
            if row["unbenchmarked_lines"]
            else ""
        )
        row["drilldown"] = {
            "tool": "audit_discount_orders",
            "request": {**req.model_dump(mode="json"), "focus_order_id": row["oid"]},
        }
    ctx.warnings.extend(
        [
            "基期参考依次尝试同商品×客户×渠道、同商品×渠道、同商品；每层需达到不同订单数门槛。回退不是同客户折扣变化的证明，覆盖和级别逐行返回。",
            "discount_burden=当期数量×标价×(实际减免比例−基期参考比例)，正值表示固定当期销量/价格/成本下毛利压低；不是跨期利润贡献，也不是保证可追回金额。",
            "亏损仅指映射成本后的毛利；未包含期间费用。整单指当前窗口和filters内全部商品，不保证包含范围外订单行。目标商品亏损与整单亏损分开。",
            "优先级为可配置核查规则，不是违规/因果结论；若参考不全，汇总金额仅覆盖可评分行。统计行数和参考级别不能当作置信度。",
            "商品/客户/渠道是同一当前期金额的不同视图，不可跨视图累加。focus仅展开证据，不改变参考、选择或优先级。",
        ]
    )
    return ctx.envelope(
        "audit_discount_orders",
        "hierarchical_baseline_discount_loss_priority",
        {
            "original_comparison": original,
            "selection": counts,
            "audit_summary": summary,
            "orders": orders,
            "breakdown": breakdown,
            "reference_coverage": coverage,
            "priority_rules": reasons,
            "focus": focus,
        },
        {
            "truncated": summary["current_orders"] > len(orders)
            or any(x and x[0]["total_members"] > len(x) for x in breakdown.values())
            or bool(focus and (focus["selected_truncated"] or focus["whole_truncated"])),
            "returned_orders": len(orders),
            "total_orders": summary["current_orders"],
            "breakdown": {
                k: {"returned": len(v), "total": v[0]["total_members"] if v else 0}
                for k, v in breakdown.items()
            },
        },
    )
