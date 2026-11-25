from typing import Any, Literal

from pydantic import BaseModel, Field


class AssetResponse(BaseModel):
    protocol: Literal["analysis-bridge@1"]
    sourceRef: str
    receipt: dict[str, Any] = Field(
        description="Fresh scope fingerprint and asset action; completed tasks reference immutable versions, not in-memory sessions"
    )
    result: dict[str, Any]


class InsightItem(BaseModel):
    type: str  # driver, outlier, trend, dominance, anomaly
    title: str
    summary: str
    significance_score: float = 1.0
    details: dict[str, Any] = {}


class StatSummary(BaseModel):
    test_name: str | None = None
    statistic_value: float | None = None
    p_value: float | None = None
    significant: bool | None = None
    effect_size: dict[str, Any] | None = None


class AnalysisResponse(BaseModel):
    status: str = "success"
    session_id: str | None = None
    summary_text: str = Field(
        ..., description="High-density deterministic natural language summary for LLM context"
    )
    insights: list[InsightItem] = Field(default_factory=list)
    statistics: dict[str, Any] | None = None
    data_preview: list[dict[str, Any]] | None = None
    chart_spec: dict[str, Any] | None = Field(
        None, description="Vega-Lite / ECharts declarative visual spec"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class BridgeResponse(BaseModel):
    protocol: str = "analysis-bridge@1"
    sessionId: str
    sourceRef: str
    receipt: dict[str, Any] = Field(
        description="Source/completeness evidence and original querySha256. Optional sqlNormalization {rule,sql,rules?} and executedQuerySha256 describe known identifier quoting and DATE substring casts before output LIMIT; querySha256 always hashes the original query."
    )
    result: dict[str, Any]


# ---- Ported from data-agent: analytical / Hex response schemas ----


class BusinessReportResponse(BaseModel):
    session_id: str
    dataset_name: str
    summary: str
    statistics: dict[str, Any]
    series: list[dict[str, Any]]
    dimensions: list[dict[str, Any]]
    anomalies: list[dict[str, Any]]
    profit_bridge: list[dict[str, Any]] = Field(default_factory=list)
    checks: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)


class ToolEvidence(BaseModel):
    schema_version: str = "2.0"
    operator: str
    method: str
    session_id: str
    dataset_name: str
    parameters: dict[str, Any]
    population: dict[str, Any]
    metric_semantics: dict[str, Any]
    time_semantics: dict[str, Any]
    assumptions: list[str]
    warnings: list[str]
    truncation: dict[str, Any]
    sql: list[str]
    query_sha256: str
    duration_ms: float
    causal_claim: bool = False


class AnalyticalToolResponse(BaseModel):
    status: str = "success"
    summary: str
    result: dict[str, Any]
    evidence: ToolEvidence


class OrderInvestigationResponse(AnalyticalToolResponse):
    """Evidence v2; result includes categories, orders, line_evidence and reconciliation.

    Category contributions cover all scoped order-periods; order_ids limits details only.
    Checks-passed labels are provisional, never a claim of business approval.
    """

    result: dict[str, Any] = Field(
        description="comparison, categories (mutually exclusive contributions), reconciliation, orders (flags and drilldown requests), line_evidence, line_evidence_truncated, next_checks"
    )


class OrderReconciliationResponse(AnalyticalToolResponse):
    result: dict[str, Any] = Field(
        description="comparison, selection, orders, line_evidence, tax_fee_status, duplicate_id_status, profit_bridges, effect_changes, exclusion_summary, skipped; evidence hypotheses are not verified root causes"
    )


class DiscountDriversResponse(AnalyticalToolResponse):
    result: dict[str, Any] = Field(
        description="original_comparison, comparison (retained scope), selection, excluded_order_ids, profit_bridge, views (within-SKU rate/structure contributions and closure), focus (stable-reference cells and orders)"
    )


class DiscountOrderAuditResponse(AnalyticalToolResponse):
    result: dict[str, Any] = Field(
        description="original_comparison, selection, audit_summary, orders with priorities/drilldown, breakdown, reference_coverage, priority_rules, focus; burden is a current-volume benchmark, not period-change attribution"
    )


class DiscountScenarioResponse(AnalyticalToolResponse):
    result: dict[str, Any] = Field(
        description="scenario_selection, scenarios, product_scenarios, scenario_orders with break-even and restore uplift, scenario_lines, variable_cost_share, risk_frontiers (bounded preserve-profit/nonloss limits, algebraic roots and initial-loss status), robustness (all configured cost cases and products), next_checks; demand stress is assumed, not forecast"
    )


class ContextHierarchyResponse(BaseModel):
    status: str = "success"
    session_id: str
    endorsed_mode: bool
    hierarchy: dict[str, Any]
    proactive_warnings: list[str] = Field(default_factory=list)


class PlaybookReplayResponse(BaseModel):
    status: str = "success"
    playbook_id: str
    title: str
    session_id: str
    steps_executed: int
    parameter_overrides: dict[str, Any] = Field(default_factory=dict)
    results: list[dict[str, Any]] = Field(default_factory=list)


class ContextHealthResponse(BaseModel):
    status: str = "success"
    session_id: str
    context_health_score: float
    coverage: dict[str, Any]
    trail_telemetry: dict[str, Any]
    proactive_warnings: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
