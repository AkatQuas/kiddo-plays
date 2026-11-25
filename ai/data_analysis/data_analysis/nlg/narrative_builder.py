from typing import Any


class NarrativeBuilder:
    """
    Deterministic, rule-based & template-driven Natural Language Generator (NLG).
    100% self-contained local synthesis of mathematical & statistical results into professional analyst insights.
    NO external LLM API needed!
    """

    @classmethod
    def generate_eda_narrative(cls, eda_data: dict[str, Any]) -> str:
        total_rows = eda_data.get("total_rows", 0)
        total_cols = eda_data.get("total_columns", 0)
        q_score = eda_data.get("quality_score", 100)
        cols = eda_data.get("columns", {})

        measures = [k for k, v in cols.items() if v.get("semantic_type") == "MEASURE"]
        categoricals = [
            k for k, v in cols.items() if v.get("semantic_type") == "DIMENSION_CATEGORICAL"
        ]
        null_issues = [
            f"{k} ({v.get('null_percentage')}% 缺失)"
            for k, v in cols.items()
            if v.get("null_percentage", 0) > 5
        ]

        parts = [
            f"【数据资产画像】数据集共包含 {total_rows:,} 行、{total_cols} 列，综合数据质量评分为 {q_score}/100 分。",
            f"识别出连续度量指标 {len(measures)} 个（{', '.join(measures[:4])}{'等' if len(measures) > 4 else ''}），"
            f"离散分类维度 {len(categoricals)} 个（{', '.join(categoricals[:4])}{'等' if len(categoricals) > 4 else ''}）。",
        ]
        if null_issues:
            parts.append(f"⚠️ 质量警示：发现明显数据缺失列 {', '.join(null_issues)}。")
        else:
            parts.append("✅ 数据完整性良好，未发现异常缺失字段。")
        sample_rows = eda_data.get("type_inference_sample_rows")
        if sample_rows is not None:
            parts.append(f"Semantic types inferred from the first {sample_rows} sample rows.")
        distinct_methods = sorted(
            {
                str(v.get("distinct_count_method"))
                for v in cols.values()
                if v.get("distinct_count_method")
            }
        )
        quantile_methods = sorted(
            {str(v.get("quantile_method")) for v in cols.values() if v.get("quantile_method")}
        )
        if distinct_methods or quantile_methods:
            parts.append(
                "计数方法："
                + (", ".join(distinct_methods) if distinct_methods else "未标注")
                + "；分位数方法："
                + (", ".join(quantile_methods) if quantile_methods else "未标注")
                + "。"
            )
        return " ".join(parts)

    @classmethod
    def generate_driver_narrative(cls, driver_data: dict[str, Any]) -> str:
        metric = driver_data.get("target_metric", "Target")
        diff = driver_data.get("diff_total", 0.0)
        rate = driver_data.get("growth_rate_pct", 0.0)
        hierarchy = driver_data.get("hierarchy", [])

        direction_word = "增长" if diff > 0 else "下滑"
        parts = [
            f"【异动归因分析】目标指标 '{metric}' 整体发生波动：{direction_word} {abs(diff):,.2f} ({rate:+.2f}%)。"
        ]
        method = driver_data.get("method")
        if method:
            parts.append(f"分解方法为 {method}。")
        sun = driver_data.get("sun_shapley")
        if sun is None:
            parts.append("sun_shapley is empty in this result.")
        elif isinstance(sun, dict):
            parts.append(f"Sun-Shapley 记录了 {sun.get('orderings_used')} 种顺序。")
        unclosed = [
            str(layer.get("dimension_level")) for layer in hierarchy if layer.get("closes") is False
        ]
        if unclosed:
            parts.append(
                f"Dimension(s) {', '.join(unclosed)} do not close to the total difference (unclosed)."
            )

        for layer in hierarchy:
            dim = layer.get("dimension_level")
            top_pos = layer.get("top_positive_drivers", [])
            top_neg = layer.get("top_negative_drivers", [])

            layer_strs = []
            if diff < 0 and top_neg:
                lead = top_neg[0]
                layer_strs.append(
                    f"主导负向拖累项为 '{lead['dimension_value']}' (变动 {lead['diff_value']:,.2f}, 贡献率 {lead['contribution_percentage']}%)"
                )
            elif diff > 0 and top_pos:
                lead = top_pos[0]
                layer_strs.append(
                    f"主导正向拉动项为 '{lead['dimension_value']}' (变动 +{lead['diff_value']:,.2f}, 贡献率 {lead['contribution_percentage']}%)"
                )

            if layer_strs:
                parts.append(f"在维度 '{dim}' 层级：{'; '.join(layer_strs)}。")

        return " ".join(parts)

    @classmethod
    def generate_spss_narrative(cls, spss_data: dict[str, Any]) -> str:
        test_name = spss_data.get("test_name", "Statistical Test")
        p_val = spss_data.get("p_value", 1.0)
        sig = spss_data.get("significant", False)
        conclusion = spss_data.get("formal_conclusion", "")

        if sig:
            verdict = f"【SPSS 统计推断 - 拒绝原假设】{test_name} 判定显著 (p={p_val:.4e})。"
        else:
            verdict = (
                f"SPSS inference — fail to reject the null hypothesis: {test_name} "
                f"is not significant (p={p_val:.4e}). Significance also requires effect-size gates."
            )

        return f"{verdict} {conclusion}"

    @classmethod
    def generate_regression_narrative(cls, reg_data: dict[str, Any]) -> str:
        coefs = reg_data.get("coefficients", [])
        sig_vars = [
            c["variable"] for c in coefs if c.get("significant") and c["variable"] != "const"
        ]
        model_type = str(reg_data.get("model_type") or "")
        is_logistic = "logistic" in model_type.lower() or (
            "pseudo_r_squared" in reg_data and "r_squared" not in reg_data
        )
        if is_logistic:
            pseudo = reg_data.get("pseudo_r_squared", 0.0)
            llr_p = reg_data.get("llr_p_value", 1.0)
            parts = [
                f"【二元 Logistic 回归】Pseudo R²={pseudo:.4f}，似然比检验 p={llr_p:.4e} "
                f"(模型{'显著有效' if llr_p < 0.05 else '不显著'})。"
            ]
            if sig_vars:
                parts.append(f"其中显著自变量包含：{', '.join(sig_vars)}。")
            return " ".join(parts)

        r2 = reg_data.get("r_squared", 0.0)
        f_p = reg_data.get("f_p_value", 1.0)
        vifs = reg_data.get("multicollinearity_vif", [])
        vif_warns = [v["variable"] for v in vifs if v.get("multicollinearity_warning")]

        parts = [
            f"【多元线性回归模型诊断】模型拟合优度 R²={r2:.4f}，全局显著性 F 检验 p={f_p:.4e} (模型{'显著有效' if f_p < 0.05 else '不显著'})。"
        ]
        if sig_vars:
            parts.append(f"其中对因变量产生显著影响的核心自变量包含：{', '.join(sig_vars)}。")
        if vif_warns:
            parts.append(
                f"⚠️ 计量预警：变量 {', '.join(vif_warns)} 的 VIF 因子超过 10，存在严重多重共线性，建议进行变量剔除或岭回归。"
            )
        return " ".join(parts)

    @classmethod
    def generate_business_report_narrative(cls, statistics: dict[str, Any], metric: str) -> str:
        """Evidence-backed report summary; does not assert a causal explanation."""
        rate = statistics.get("change_pct")
        rate_text = f"{rate:+.2f}%" if rate is not None else "基期为零，变化率不定义"
        return (
            f"{metric} 从 {statistics['base_value']:,.2f} 变为 {statistics['current_value']:,.2f}，"
            f"变化 {statistics['delta']:+,.2f}（{rate_text}）。"
            "以下贡献用于定位变化来源，不能单独证明因果。"
        )

    @classmethod
    def generate_tool_evidence_narrative(cls, operator: str, result: dict[str, Any]) -> str:
        comparison = result.get("comparison", result.get("original", {}))
        delta = comparison.get("delta")
        change = f"{delta:+,.6g}" if delta is not None else "未定义（请检查分母或有效样本）"
        if operator == "simulate_discount_scenarios":
            return f"折扣情景：覆盖 {result['scenario_selection']['current_orders']} 笔目标订单；固定销量、假设销量下降与多成本案例的维持毛利/保本边界分别返回。稳健性仅针对配置压力及商品检查。改善以原公式毛利为基准；需求弹性未经估计，不能视作收益承诺。"
        if operator == "audit_discount_orders":
            return f"折扣订单核查：{result['audit_summary']['current_orders']} 笔当期订单，P1优先核查 {result['audit_summary']['p1_orders']} 笔；参考级别和目标商品/整单毛利分别返回。金额为当期业务量下的基准对照，不是同比贡献或保证可追回损失。"
        if operator == "analyze_discount_drivers":
            return f"折扣深查：排除 {result['selection']['excluded_orders']} 笔订单后，利润变化 {change}。各维度分别拆解同一折扣贡献，不可跨视图相加；折扣加深与结构项是会计分摊，不是因果证明。"
        if operator == "reconcile_order_amounts":
            return f"金额深查：选中 {result['selection']['selected_orders']} 笔订单，原始利润变化 {change}。重复、倍率和税费只作为核查假设；排除前后分解不是已纠正的真实利润。"
        if operator == "investigate_orders":
            return f"订单核查：利润变化 {change}；分类贡献已对账，金额与折扣标记可重叠。检查通过仅表示规则未命中，不能证明订单正常或构成因果结论。"
        return f"{operator}：所选口径的变化为 {change}。计算证据、适用条件和截断信息见 evidence；不构成因果证明。"
