"""Automated insight discovery — an orchestration layer over the deterministic operators.

This is the local-implementable slice of the newer "automated insight" paradigm
(InsightPilot / DataSage / Insight Graph / data storytelling): it treats the
existing operators as *Analysis Actions*, runs an intent-biased subset of them
over a dataset, normalizes every finding into a structured Insight, wires the
Insights into an **Insight Graph** (relationships between findings), and composes
a coherent **data story** (narrative).

Deliberate boundary (matches this repo's philosophy — deterministic compute in
operators, LLM reasoning in the caller): the semantic *intent understanding*,
multi-agent debating, and RAG business-context layers are left to the calling
Agent. This engine provides the deterministic actions, the insight graph, and the
narrative scaffold that such an Agent orchestrates. `intent` here is only a light
keyword bias, not full NLU.
"""

from typing import Any

from data_analysis.copilot.llm_ranker import rank_insights
from data_analysis.engine.schema_infer import SemanticType
from data_analysis.operators.correlation import run_correlation_analysis
from data_analysis.operators.eda import run_eda_profile
from data_analysis.operators.insights.dominance import detect_dominance
from data_analysis.operators.insights.outliers import detect_outliers
from data_analysis.operators.insights.trends import detect_trends

# Bound the fan-out so discovery stays fast on wide tables.
_MAX_MEASURES = 5
_MAX_DIMS = 3


def _roles(profile: dict[str, Any]):
    measures, dims_cat, dims_time = [], [], []
    cols = profile.get("columns", [])
    # EDA returns columns as a {name: report} dict; tolerate a list too.
    col_reports = list(cols.values()) if isinstance(cols, dict) else cols
    for col in col_reports:
        st = col.get("semantic_type")
        name = col.get("column_name")
        if st == SemanticType.MEASURE.value:
            measures.append(name)
        elif st == SemanticType.DIMENSION_CATEGORICAL.value:
            dims_cat.append(name)
        elif st == SemanticType.DIMENSION_TEMPORAL.value:
            dims_time.append(name)
    return measures[:_MAX_MEASURES], dims_cat[:_MAX_DIMS], dims_time[:1]


def _intent_actions(intent: str | None) -> set:
    """Map a free-text intent to the action types to prioritize (light bias)."""
    all_actions = {"anomaly", "correlation", "dominance", "trend"}
    if not intent:
        return all_actions
    text = intent.lower()
    wanted = set()
    if any(k in text for k in ["异常", "outlier", "anomal"]):
        wanted.add("anomaly")
    if any(k in text for k in ["相关", "correl", "关系"]):
        wanted.add("correlation")
    if any(k in text for k in ["集中", "占比", "头部", "dominance", "concentrat", "pareto"]):
        wanted.add("dominance")
    if any(k in text for k in ["趋势", "trend", "增长", "下降", "时间"]):
        wanted.add("trend")
    return wanted or all_actions


def _mk(insight_id, itype, title, detail, severity, columns, evidence):
    return {
        "id": insight_id,
        "type": itype,
        "title": title,
        "statement": detail,
        "severity": round(max(0.0, min(1.0, severity)), 3),
        "subject": {"columns": [c for c in columns if c]},
        "evidence": evidence,
    }


def discover_insights(
    session_id: str,
    dataset_name: str,
    intent: str | None = None,
    target_metric: str | None = None,
    category_col: str | None = None,
    time_col: str | None = None,
    max_insights: int = 8,
) -> dict[str, Any]:
    """Run intent-biased Analysis Actions and assemble insights + graph + story."""
    profile = run_eda_profile(session_id, dataset_name)
    measures, dims_cat, dims_time = _roles(profile)
    if target_metric and target_metric not in measures:
        measures = [target_metric, *measures]
    cat = category_col or (dims_cat[0] if dims_cat else None)
    tcol = time_col or (dims_time[0] if dims_time else None)
    actions = _intent_actions(intent)

    insights: list[dict[str, Any]] = []
    caveats: list[dict[str, Any]] = []
    n = 0

    def _fail(action: str, column: str | None, exc: Exception) -> None:
        caveats.append({"action": action, "column": column, "error": str(exc)})

    # Action: anomalies (per measure)
    if "anomaly" in actions:
        for m in measures:
            try:
                r = detect_outliers(session_id, dataset_name, m, method="z_score")
                cnt = r.get("outlier_count", 0)
                if cnt > 0:
                    total = max(1, profile.get("total_rows", 1))
                    insights.append(
                        _mk(
                            f"i{n}",
                            "anomaly",
                            f"指标 {m} 存在 {cnt} 个异常点",
                            f"「{m}」检出 {cnt} 个离群点（均值 {r.get('baseline_mean')}, 标准差 {r.get('baseline_std')}），需关注数据质量或业务突发。",
                            cnt / total * 5,
                            [m],
                            r,
                        )
                    )
                    n += 1
            except Exception as exc:
                _fail("anomaly", m, exc)

    # Action: correlation (across measures)
    if "correlation" in actions and len(measures) >= 2:
        try:
            r = run_correlation_analysis(session_id, dataset_name, columns=measures, group_col=cat)
            for note in r.get("evidence", {}).get("caveats", []):
                if note.startswith("Simpson:"):
                    caveats.append({"action": "correlation", "column": None, "note": note})
            for p in r.get("high_correlation_pairs", []):
                if not p.get("fdr_significant"):
                    continue
                q = p.get("q_value")
                insights.append(
                    _mk(
                        f"i{n}",
                        "correlation",
                        f"{p['col1']} 与 {p['col2']} {p['strength']} 线性相关 (r={p['r']})",
                        f"「{p['col1']}」与「{p['col2']}」呈 {p['strength']} 线性相关（r={p['r']}, p={p['p_value']}, q={q}）。这是相关，不是因果效应。",
                        abs(p["r"]),
                        [p["col1"], p["col2"]],
                        p,
                    )
                )
                n += 1
        except Exception as exc:
            _fail("correlation", None, exc)

    # Action: dominance (category x metric)
    if "dominance" in actions and cat:
        for m in measures[:2]:
            try:
                r = detect_dominance(session_id, dataset_name, cat, m)
                gini = r.get("gini_coefficient", 0)
                n_cats = r.get("total_categories", 0)
                share = r.get("top_k_concentration_share_pct", 0)
                # Only a real concentration signal: high Gini, or a genuine top-K
                # share that isn't just "K >= number of categories" (which is ~100%
                # and always trivially true).
                concentrated = gini >= 0.4 or (share >= 60 and n_cats > 5)
                if concentrated:
                    insights.append(
                        _mk(
                            f"i{n}",
                            "dominance",
                            f"{m} 在 {cat} 上高度集中 (Gini={gini})",
                            f"按「{cat}」看「{m}」头部集中：Gini={gini}，{r.get('pareto_80_rule_ratio')}。",
                            gini,
                            [cat, m],
                            r,
                        )
                    )
                    n += 1
            except Exception as exc:
                _fail("dominance", m, exc)

    # Action: trend (time x metric)
    if "trend" in actions and tcol:
        for m in measures[:2]:
            try:
                r = detect_trends(session_id, dataset_name, tcol, m)
                if r.get("statistically_significant"):
                    insights.append(
                        _mk(
                            f"i{n}",
                            "trend",
                            f"{m} 随 {tcol} 呈{r.get('trend_direction')}趋势",
                            f"「{m}」随「{tcol}」呈显著{r.get('trend_direction')}趋势（斜率 {r.get('slope')}, R²={r.get('r_squared')}）。",
                            r.get("r_squared", 0),
                            [tcol, m],
                            r,
                        )
                    )
                    n += 1
            except Exception as exc:
                _fail("trend", m, exc)

    insights, rank_meta = rank_insights(insights)
    insights = insights[:max_insights]

    graph = _build_graph(insights)
    narrative = _build_narrative(dataset_name, profile, insights, graph, intent)

    return {
        "dataset_name": dataset_name,
        "intent": intent,
        "actions_run": sorted(actions),
        "total_insights": len(insights),
        "insights": insights,
        "insight_graph": graph,
        "narrative": narrative,
        "caveats": caveats,
        "ranking_method": rank_meta["ranking_method"],
        "ranking_caveat": rank_meta["caveat"],
    }


def _build_graph(insights: list[dict[str, Any]]) -> dict[str, Any]:
    """Insight Graph: link insights that share a column/metric (relationship network)."""
    nodes = [
        {"id": i["id"], "type": i["type"], "title": i["title"], "severity": i["severity"]}
        for i in insights
    ]
    edges = []
    for a in range(len(insights)):
        for b in range(a + 1, len(insights)):
            shared = set(insights[a]["subject"]["columns"]) & set(insights[b]["subject"]["columns"])
            if shared:
                edges.append(
                    {
                        "source": insights[a]["id"],
                        "target": insights[b]["id"],
                        "relation": "shares:" + ",".join(sorted(shared)),
                    }
                )
    return {"nodes": nodes, "edges": edges}


def _build_narrative(dataset_name, profile, insights, graph, intent) -> dict[str, Any]:
    """Compose a coherent data story from the ranked insights and their relationships."""
    rows = profile.get("total_rows", "?")
    score = profile.get("quality_score", "?")
    headline = f"【数据故事 · {dataset_name}】{rows} 行，数据质量 {score}/100。"
    if intent:
        headline += f" 围绕意图「{intent}」的自动洞察："
    if not insights:
        return {
            "headline": headline,
            "sections": [
                "未发现显著洞察（可放宽阈值或指定 target_metric/time_col/category_col）。"
            ],
            "recommendation": None,
        }

    sections = []
    by_type: dict[str, list[str]] = {}
    for i in insights:
        by_type.setdefault(i["type"], []).append(i["statement"])
    type_label = {
        "anomaly": "异常",
        "correlation": "相关性",
        "dominance": "集中度",
        "trend": "趋势",
    }
    for t, stmts in by_type.items():
        sections.append(f"{type_label.get(t, t)}：" + " ".join(stmts))

    if graph["edges"]:
        rel = "；".join(
            f"{e['source']}↔{e['target']}（{e['relation']}）" for e in graph["edges"][:5]
        )
        sections.append(
            f"洞察关联：{rel}。多条洞察围绕同一指标/维度，提示存在共同的业务驱动因子，可进一步做归因下钻。"
        )

    top = insights[0]
    recommendation = f"优先关注「{top['title']}」（严重度 {top['severity']}），建议用 driver_attribution_analysis 对相关指标做因子级归因。"
    return {"headline": headline, "sections": sections, "recommendation": recommendation}
