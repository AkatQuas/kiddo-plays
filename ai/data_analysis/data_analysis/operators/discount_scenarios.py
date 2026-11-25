"""Read-only repricing scenarios. Demand reductions are assumptions, not estimates."""

from data_analysis.operators.business_report import literal
from data_analysis.operators.discount_order_audit import _audit_context
from data_analysis.schemas.requests import DiscountScenarioRequest


def simulate_discount_scenarios(req: DiscountScenarioRequest):
    ctx, cte, _ = _audit_context(req)
    selection = ctx.query(
        cte
        + """ SELECT COUNT(*) AS current_lines,COUNT(DISTINCT oid) AS current_orders,
      COUNT(*) FILTER(WHERE reference_rate IS NULL) AS unbenchmarked_lines,
      (SELECT COUNT(*) FROM audit_excluded) AS excluded_orders,
      SUM(profit) AS actual_profit,SUM(after_discount_formula_profit) AS formula_profit,
      SUM(profit-after_discount_formula_profit) AS ledger_residual FROM scored"""
    )[0]
    if not selection["current_lines"]:
        raise ValueError("No retained current-period rows for selected products")
    if ctx.query(cte + " SELECT COUNT(*) AS n FROM scored WHERE NOT accounting_valid")[0]["n"]:
        raise ValueError(
            "Scenario requires reconciled amount and profit fields; repair or exclude mismatched orders"
        )
    caps = sorted(set(req.discount_caps))
    drops = sorted(set([0, *req.volume_reductions]))
    share = req.variable_cost_share
    cte += f""", scenario_inputs AS (SELECT c.cap,v.volume_drop FROM (VALUES {",".join(f"({x})" for x in caps)}) c(cap)
      CROSS JOIN (VALUES {",".join(f"({x})" for x in drops)}) v(volume_drop)),
      scenario_lines AS (SELECT s.*,i.cap,i.volume_drop,LEAST(discount,cap) AS scenario_discount,
        gross*(1-LEAST(discount,cap))*(1-volume_drop)-cost*(1-{share}*volume_drop) AS scenario_profit,
        gross*(discount-LEAST(discount,cap)) AS fixed_uplift,
        gross*(1-LEAST(discount,cap))-cost*{share} AS contribution_after_cap
        FROM scored s CROSS JOIN scenario_inputs i)"""

    def aggregate(group):
        key = "sku," if group else ""
        return ctx.query(
            cte
            + f""" SELECT {key}cap,volume_drop,SUM(profit) AS actual_profit,
          SUM(after_discount_formula_profit) AS formula_profit,SUM(scenario_profit) AS scenario_profit,
          SUM(scenario_profit-after_discount_formula_profit) AS uplift,
          SUM(scenario_profit-profit) AS versus_actual,
          SUM(fixed_uplift) AS fixed_uplift,
          CASE WHEN SUM(contribution_after_cap)>0 THEN SUM(fixed_uplift)/SUM(contribution_after_cap) END AS volume_loss_tolerance,
          COUNT(*) FILTER(WHERE discount>cap) AS changed_lines,
          COUNT(*) OVER() AS total_rows FROM scenario_lines GROUP BY {key}cap,volume_drop
          ORDER BY {key}cap,volume_drop LIMIT 2500"""
        )

    scenarios = aggregate(False)
    products = aggregate(True)
    cases = sorted(set(req.cost_share_cases))
    risk_cte = (
        cte
        + f""", risk_inputs AS (SELECT c.cap,a.cost_share FROM (VALUES {",".join(f"({x})" for x in caps)}) c(cap)
      CROSS JOIN (VALUES {",".join(f"({x})" for x in cases)}) a(cost_share)),
      risk_totals AS (SELECT GROUPING(sku) AS is_total,sku,cap,cost_share,
        SUM(gross*(1-LEAST(discount,cap))-cost) AS initial_profit,
        SUM(after_discount_formula_profit) AS baseline_profit,
        SUM(gross*(1-LEAST(discount,cap))-cost*cost_share) AS loss_slope
        FROM scored CROSS JOIN risk_inputs GROUP BY GROUPING SETS ((cap,cost_share),(sku,cap,cost_share))),
      risk_bounds AS (SELECT *,initial_profit-baseline_profit AS fixed_uplift,
        CASE WHEN loss_slope>0 THEN (initial_profit-baseline_profit)/loss_slope END AS preserve_profit_root,
        CASE WHEN loss_slope<>0 THEN initial_profit/loss_slope END AS zero_profit_root,
        CASE WHEN loss_slope>0 THEN LEAST(1,GREATEST(0,(initial_profit-baseline_profit)/loss_slope)) ELSE 1 END AS preserve_profit_max_drop,
        CASE WHEN initial_profit<0 THEN NULL WHEN loss_slope>0 THEN LEAST(1,initial_profit/loss_slope) ELSE 1 END AS nonloss_max_drop,
        CASE WHEN initial_profit<0 THEN 'initial_loss' WHEN loss_slope<=0 THEN 'all_feasible' WHEN initial_profit/loss_slope>=1 THEN 'all_feasible' ELSE 'crosses_zero' END AS break_even_status,
        initial_profit-loss_slope*{req.robustness_volume_drop} AS stress_profit,
        initial_profit-loss_slope*{req.robustness_volume_drop}-baseline_profit AS stress_uplift
        FROM risk_totals)"""
    )
    risk = ctx.query(
        risk_cte
        + " SELECT *,COUNT(*) OVER() AS total_rows FROM risk_bounds ORDER BY is_total DESC,sku,cap,cost_share LIMIT 2500"
    )
    robustness = ctx.query(
        risk_cte
        + """ SELECT cap,MIN(stress_uplift) FILTER(WHERE is_total=1) AS worst_total_uplift,
      MIN(stress_profit) FILTER(WHERE is_total=1) AS worst_total_profit,
      MIN(preserve_profit_max_drop) FILTER(WHERE is_total=1) AS conservative_preserve_drop,
      MIN(nonloss_max_drop) FILTER(WHERE is_total=1) AS conservative_nonloss_drop,
      COUNT(*) FILTER(WHERE is_total=0 AND stress_uplift<0) AS product_case_deteriorations,
      COUNT(*) FILTER(WHERE is_total=0 AND stress_profit<0) AS product_case_losses,
      CASE WHEN MIN(stress_uplift)>=-1e-8 AND MIN(stress_profit)>=-1e-8 THEN 'passes_all_cases'
        WHEN MIN(stress_uplift) FILTER(WHERE is_total=1)>=-1e-8 AND MIN(stress_profit) FILTER(WHERE is_total=1)>=-1e-8 THEN 'total_only'
        WHEN MIN(stress_profit) FILTER(WHERE is_total=1)>=-1e-8 THEN 'profit_erodes' ELSE 'loss_risk' END AS robustness
      FROM risk_bounds GROUP BY cap ORDER BY cap"""
    )
    ids = (
        "oid IN (" + ",".join(literal(x) for x in req.order_ids) + ")" if req.order_ids else "TRUE"
    )
    orders = ctx.query(
        cte
        + f""" SELECT *,1-(list_amount-before_discount_formula_profit)/NULLIF(list_amount,0) AS target_break_even_discount,
      1-((list_amount-before_discount_formula_profit)-(scoped_order_profit-selected_profit))/NULLIF(list_amount,0) AS whole_break_even_discount,
      CASE WHEN unbenchmarked_lines=0 THEN reference_formula_profit-after_discount_formula_profit END AS restore_uplift,
      CASE WHEN unbenchmarked_lines=0 THEN scoped_order_profit+reference_formula_profit-selected_profit END AS restored_whole_profit,
      COUNT(*) OVER() AS total_rows FROM ranked_priority WHERE {ids} ORDER BY priority_rank,oid LIMIT 100""",
        100,
    )
    lines = ctx.query(
        cte
        + f""" SELECT oid,sku,customer,channel,quantity,price,cost,profit,discount,reference_rate,
      reference_level,reference_orders,break_even_discount,reference_formula_profit,discount_burden,
      gap,ledger_gap,COUNT(*) OVER() AS total_rows FROM scored WHERE {ids} ORDER BY oid,sku,__da_id LIMIT 100""",
        100,
    )
    for row in orders:
        data = req.model_dump(mode="json")
        for k in [
            "discount_caps",
            "volume_reductions",
            "variable_cost_share",
            "order_ids",
            "cost_share_cases",
            "robustness_volume_drop",
        ]:
            data.pop(k)
        row["drilldown"] = {
            "tool": "audit_discount_orders",
            "request": {
                **data,
                "focus_order_id": row["oid"],
                "focus_customer": None,
                "focus_channel": None,
            },
        }
    ctx.warnings.extend(
        [
            "折扣为减免比例，30%表示付标价70%。上限仅收紧超过上限的行；基期恢复则逐行采用参考比例，可能增加部分行折扣。",
            "固定销量：数量、标价、映射成本不变。压力测试：目标商品各行数量同比例下降，收入同比例下降；成本仅可变部分同比例下降，其余成本保留。非目标商品不变。",
            "销量下降为用户假设，未估计价格弹性；容忍降幅为保持原公式毛利的数学边界，不是需求预测。边界超过100%或为空需结合成本解释。",
            "保本阈值是目标商品统一减免比例的代数阈值，负值表示零折扣也无法保本；整单仅涵盖当前筛选范围。未包含未映射税费和期间费用。",
            "基期参考沿用三级回退，非同客户匹配不证明同客户折扣变化；参考缺失时整单恢复结果为空。uplift以公式毛利为基准，versus_actual另含账式舍入差。",
        ]
    )
    ctx.warnings.append(
        "风险临界点只针对目标商品毛利。preserve_profit_max_drop 为保持原公式毛利的0–100%可行边界；nonloss_max_drop仅在初始不亏损时定义，初始亏损返回null。零毛利根为代数根，可能在可行域外。稳健性仅比较配置成本案例与指定销量压力，未计需求弹性；更严折扣上限可能导致更大降量。"
    )
    checks = [
        "先核对重点订单合同、促销授权、成本完整性及基期参考适用性。",
        "优先核查折扣后亏损订单，保本阈值按更低折扣安全取整，避免四舍五入后仍亏损。",
        "在实施折扣上限前核查客户流失、竞品报价与合同限制；用历史调价或小范围试验验证销量风险。",
        "区分短期不可撤销成本和长期可变成本，核对采购承诺、库存、运费与产能成本；不要把销售成本机械视为随销量即时消失。",
        "优先检查压力下单商品亏损或退化，即使组合总体仍盈利；通过客户报价测试估计各上限的差异化需求反应，不能据同一降量假设直接选最严上限。",
    ]
    truncated = any(x and x[0]["total_rows"] > len(x) for x in [products, orders, lines, risk])
    return ctx.envelope(
        "simulate_discount_scenarios",
        "fixed_volume_discount_cap_and_demand_stress",
        {
            "scenario_selection": selection,
            "scenarios": scenarios,
            "product_scenarios": products,
            "scenario_orders": orders,
            "scenario_lines": lines,
            "risk_frontiers": risk,
            "robustness": robustness,
            "cost_share_cases": cases,
            "robustness_volume_drop": req.robustness_volume_drop,
            "variable_cost_share": share,
            "next_checks": checks,
        },
        {
            "truncated": bool(truncated),
            "products_returned": len(products),
            "order_details_returned": len(orders),
            "lines_returned": len(lines),
        },
    )
