"""Exact midpoint allocation of profit-bridge discount effect with stable drill context."""

from types import SimpleNamespace

from data_analysis.operators.analytical_tools import Context
from data_analysis.operators.business_report import literal, quote
from data_analysis.operators.profit_decomposition import profit_bridge
from data_analysis.schemas.requests import DiscountDriversRequest


def analyze_discount_drivers(req: DiscountDriversRequest):
    m = req.mapping
    dims = list(dict.fromkeys([m.product, *req.dimensions]))
    ctx = Context(
        req, [*dims, *[v for k, v in m.model_dump().items() if k != "discount_scale" and v]]
    )
    comparison = ctx.compare()

    def n(k):
        return f"TRY_CAST({quote(getattr(m, k))} AS DOUBLE)"

    # Internal names are isolated from source fields; dimensions remain available in data.
    cte = (
        ctx.cte
        + f""", dd_lines AS (SELECT __da_id,__da_period,__da_date,
      CAST({quote(m.order)} AS VARCHAR) AS oid,CAST({quote(m.product)} AS VARCHAR) AS sku,
      {n("quantity")} AS q,{n("price")} AS p,{n("discount")}/{m.discount_scale} AS d,
      {n("sales")} AS sales,{n("cost")} AS cost,TRY_CAST({quote(req.metric.column)} AS DOUBLE) AS profit FROM data),
      dd_amounts AS (SELECT *,q*p AS gross,sales-q*p*(1-d) AS gap,profit-(sales-cost) AS ledger_gap FROM dd_lines),
      dd_excluded AS (SELECT DISTINCT oid FROM dd_amounts WHERE
        {"ABS(gap)>" + str(req.amount_tolerance) + " OR ABS(ledger_gap)>" + str(req.amount_tolerance) if req.exclude_amount_mismatches else "FALSE"}
        {" OR oid IN (" + ",".join(literal(x) for x in req.exclude_order_ids) + ")" if req.exclude_order_ids else ""}),
      dd_clean AS (SELECT * FROM dd_amounts WHERE oid NOT IN (SELECT oid FROM dd_excluded))"""
    )
    bad = ctx.query(
        cte
        + """ SELECT COUNT(*) AS n FROM dd_lines WHERE oid IS NULL OR sku IS NULL OR NOT COALESCE(
      ISFINITE(q) AND q>0 AND ISFINITE(p) AND p>=0 AND ISFINITE(d) AND d BETWEEN 0 AND 1
      AND ISFINITE(sales) AND ISFINITE(cost) AND cost>=0,FALSE)"""
    )[0]["n"]
    if bad:
        raise ValueError(
            f"{bad} invalid mapped rows; fix quantities, prices, discounts or identifiers"
        )
    selection = ctx.query(
        cte
        + """ SELECT (SELECT COUNT(*) FROM dd_excluded) AS excluded_orders,
      COUNT(*) FILTER(WHERE oid IN (SELECT oid FROM dd_excluded)) AS excluded_lines,
      COUNT(*) FILTER(WHERE oid NOT IN (SELECT oid FROM dd_excluded) AND __da_period='base') AS retained_base_rows,
      COUNT(*) FILTER(WHERE oid NOT IN (SELECT oid FROM dd_excluded) AND __da_period='current') AS retained_current_rows FROM dd_amounts"""
    )[0]
    if not selection["retained_base_rows"] or not selection["retained_current_rows"]:
        raise ValueError("Both periods require retained records after exclusion")
    excluded = ctx.query(cte + " SELECT oid FROM dd_excluded ORDER BY oid LIMIT 501", 501)
    t = req.time
    table = f"({cte} SELECT * REPLACE(__da_date AS {quote(t.column)}) FROM data WHERE CAST({quote(m.order)} AS VARCHAR) NOT IN (SELECT oid FROM dd_excluded))"
    b = f"__date>=DATE '{t.base_start}' AND __date<DATE '{t.base_end}'"
    c = f"__date>=DATE '{t.current_start}' AND __date<DATE '{t.current_end}'"
    bridge, _, checks = profit_bridge(
        SimpleNamespace(mapping=m, time_column=t.column, metric=req.metric.column),
        table,
        "",
        b,
        c,
        lambda key, sql, limit=2500: ctx.query(sql, limit),
    )
    if not bridge:
        raise ValueError("Profit identity required: " + "; ".join(checks))
    bridge = next(x for x in bridge if x["scenario"] == "reported")
    common = (
        cte
        + """, dd_sku AS (SELECT sku,__da_period,SUM(q) AS q,SUM(gross) AS gross,
       SUM(gross*d) AS discount_amount FROM dd_clean GROUP BY sku,__da_period),
      dd_pairs AS (SELECT sku,COALESCE(MAX(q) FILTER(WHERE __da_period='base'),0) AS sq0,
       COALESCE(MAX(q) FILTER(WHERE __da_period='current'),0) AS sq1,
       COALESCE(MAX(gross) FILTER(WHERE __da_period='base'),0) AS sg0,
       COALESCE(MAX(gross) FILTER(WHERE __da_period='current'),0) AS sg1,
       COALESCE(MAX(gross/q) FILTER(WHERE __da_period='base'),MAX(gross/q) FILTER(WHERE __da_period='current')) AS p0,
       COALESCE(MAX(gross/q) FILTER(WHERE __da_period='current'),MAX(gross/q) FILTER(WHERE __da_period='base')) AS p1
       FROM dd_sku GROUP BY sku),
      dd_coeff AS (SELECT *, (SUM(sq0) OVER()+SUM(sq1) OVER())/2 *
        (sq0/SUM(sq0) OVER()+sq1/SUM(sq1) OVER())/2 * (p0+p1)/2 AS coefficient FROM dd_pairs)"""
    )
    views = []
    focus = None
    for dimension in dims:
        col = quote(dimension)
        sql = (
            common
            + f""", dd_cells AS (SELECT a.sku,CAST(src.{col} AS VARCHAR) AS member,a.__da_period,
          SUM(a.gross) AS gross,SUM(a.gross*a.d) AS discounted,COUNT(*) AS rows
          FROM dd_clean a JOIN data src USING(__da_id) GROUP BY a.sku,member,a.__da_period),
          dd_cell_pairs AS (SELECT sku,member,
            COALESCE(MAX(gross) FILTER(WHERE __da_period='base'),0) AS g0,
            COALESCE(MAX(gross) FILTER(WHERE __da_period='current'),0) AS g1,
            MAX(discounted/NULLIF(gross,0)) FILTER(WHERE __da_period='base') AS actual_rate0,
            MAX(discounted/NULLIF(gross,0)) FILTER(WHERE __da_period='current') AS actual_rate1,
            COALESCE(MAX(rows) FILTER(WHERE __da_period='base'),0) AS rows0,
            COALESCE(MAX(rows) FILTER(WHERE __da_period='current'),0) AS rows1 FROM dd_cells GROUP BY sku,member),
          dd_weights AS (SELECT *,CASE WHEN sg0>0 THEN g0/sg0 WHEN sg1>0 THEN g1/sg1 ELSE 0 END AS w0,
            CASE WHEN sg1>0 THEN g1/sg1 WHEN sg0>0 THEN g0/sg0 ELSE 0 END AS w1,
            CASE WHEN sq0>0 AND sg0=0 THEN 0 ELSE COALESCE(actual_rate0,actual_rate1,0) END AS r0,
            CASE WHEN sq1>0 AND sg1=0 THEN 0 ELSE COALESCE(actual_rate1,actual_rate0,0) END AS r1
            FROM dd_cell_pairs JOIN dd_coeff USING(sku)),
          dd_effects AS (SELECT *, -coefficient*(w0+w1)/2*(r1-r0) AS rate_effect,
            -coefficient*(r0+r1)/2*(w1-w0) AS structure_effect,
            rate_effect+structure_effect AS contribution FROM dd_weights),
          dd_members AS (SELECT member,SUM(rate_effect) AS rate_effect,SUM(structure_effect) AS structure_effect,
            SUM(contribution) AS contribution,SUM(g0) AS base_list_amount,SUM(g1) AS current_list_amount,
            SUM(g0*actual_rate0)/NULLIF(SUM(g0),0) AS base_discount_rate,
            SUM(g1*actual_rate1)/NULLIF(SUM(g1),0) AS current_discount_rate,
            SUM(rows0) AS base_rows,SUM(rows1) AS current_rows FROM dd_effects GROUP BY member),
          dd_ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY ABS(contribution) DESC,member NULLS FIRST) AS rank FROM dd_members)"""
        )
        rows = ctx.query(
            sql + f" SELECT * EXCLUDE(rank) FROM dd_ranked WHERE rank<={req.top_k} ORDER BY rank"
        )
        totals = ctx.query(
            sql
            + f""" SELECT COUNT(*) AS members,SUM(rate_effect) AS rate_effect,SUM(structure_effect) AS structure_effect,
          SUM(contribution) AS contribution,SUM(contribution)-({bridge["discount_effect"]}) AS reconciliation_error,
          COALESCE(SUM(contribution) FILTER(WHERE rank>{req.top_k}),0) AS omitted_contribution,
          (SELECT COUNT(*) FROM dd_effects) AS product_member_cells,
          (SELECT COUNT(*) FROM dd_effects WHERE actual_rate0 IS NOT NULL AND actual_rate1 IS NOT NULL) AS comparable_rate_cells,
          (SELECT COUNT(*) FROM dd_effects WHERE actual_rate0 IS NULL OR actual_rate1 IS NULL) AS missing_rate_cells FROM dd_ranked"""
        )[0]
        for row in rows:
            if row["member"] is not None:
                row["drilldown"] = {
                    "tool": "analyze_discount_drivers",
                    "request": {
                        **req.model_dump(mode="json"),
                        "focus_dimension": dimension,
                        "focus_member": row["member"],
                    },
                }
        views.append(
            {
                "dimension": dimension,
                "rows": rows,
                "totals": totals,
                "truncated": totals["members"] > len(rows),
            }
        )
        if req.focus_dimension == dimension:
            member = literal(req.focus_member)
            cells = ctx.query(
                sql
                + f""" SELECT sku,member,g0 AS base_list_amount,g1 AS current_list_amount,actual_rate0 AS base_discount_rate,
              actual_rate1 AS current_discount_rate,w0 AS base_within_sku_share,w1 AS current_within_sku_share,
              coefficient,rate_effect,structure_effect,contribution,rows0 AS base_rows,rows1 AS current_rows,
              actual_rate0 IS NULL OR actual_rate1 IS NULL AS missing_rate_carried,
              COUNT(*) OVER() AS matched_cells FROM dd_effects WHERE member={member} ORDER BY ABS(contribution) DESC,sku LIMIT 100""",
                100,
            )
            orders = ctx.query(
                cte
                + f""" SELECT a.oid,a.__da_period AS period,a.sku,SUM(a.gross) AS list_amount,
              SUM(a.gross*a.d)/NULLIF(SUM(a.gross),0) AS discount_rate,SUM(a.sales) AS sales,SUM(a.profit) AS profit,
              COUNT(*) OVER() AS matched_groups FROM dd_clean a JOIN data src USING(__da_id)
              WHERE CAST(src.{col} AS VARCHAR)={member} GROUP BY a.oid,a.__da_period,a.sku
              ORDER BY SUM(a.gross*a.d) DESC,a.oid,a.__da_period,a.sku LIMIT 100""",
                100,
            )
            focus = {
                "dimension": dimension,
                "member": req.focus_member,
                "cells": cells,
                "orders": orders,
                "cells_truncated": bool(cells and cells[0]["matched_cells"] > len(cells)),
                "orders_truncated": bool(orders and orders[0]["matched_groups"] > len(orders)),
            }
    ctx.warnings.extend(
        [
            "各维度是同一折扣贡献的不同视图，不可跨商品/客户/区域/渠道相加。贡献是中点账式分摊，不是因果证明。",
            "同商品内按标价销售额加权：折扣加深项=平均份额×折扣率变化；结构项=平均折扣率×份额变化，再乘共享利润桥系数。商品间销量结构贡献在profit_bridge.mix_effect中，不能混同于此处同商品内结构。",
            "新增/消失成员沿用另一期间折扣率作分摊约定，其影响进入结构项，不推断未观测的真实折扣；零标价销售额另作零折扣约定。缺失实际率仍显示null。",
            "focus仅筛核查明细，不改变参考集或分解系数。列表按贡献绝对值排序；遗漏贡献、订单明细截断明确返回。排除后业务不等于已验证正常。",
        ]
    )
    return ctx.envelope(
        "analyze_discount_drivers",
        "within_sku_symmetric_discount_rate_structure",
        {
            "original_comparison": comparison,
            "comparison": {
                "base_value": bridge["base_profit"],
                "current_value": bridge["current_profit"],
                "delta": bridge["delta"],
                "change_pct": bridge["change_pct"],
            },
            "selection": selection,
            "excluded_order_ids": [x["oid"] for x in excluded[:500]],
            "profit_bridge": bridge,
            "views": views,
            "focus": focus,
        },
        {
            "truncated": len(excluded) > 500
            or any(v["truncated"] for v in views)
            or bool(focus and (focus["cells_truncated"] or focus["orders_truncated"])),
            "excluded_orders_truncated": len(excluded) > 500,
            "views": {v["dimension"]: v["truncated"] for v in views},
        },
    )
