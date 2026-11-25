# DATE-substring normalization is REST-only. MCP SQL keeps its original
# types and cannot access bridge sessions or bypass the signed-scope protocol.
# Durable asset jobs, version queries and materializations are also signed
# BusinessHost REST-only. MCP does not obtain an actor scope from a service key;
# never expose the private PG ledger, storage objects or upload tickets here.
import functools
import json
import os
from typing import Any

from fastmcp import FastMCP

from data_analysis.catalog.meta_registry import ColumnMeta as _CM
from data_analysis.catalog.meta_registry import TableAsset as _TA
from data_analysis.cluster.request_scope import request_scope
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.connectors.factory import ConnectorFactory
from data_analysis.connectors.trace_importer import TraceImporter
from data_analysis.logging_setup import configure_logging
from data_analysis.ontology.ontology_engine import get_ontology_engine

# MCP 运行在 stdio transport，日志只能写文件或 stderr
# configure_logging() 默认写 stdout 会污染协议流，这里先导入模块让后续代码能用 logger
configure_logging()
from data_analysis.catalog.meta_registry import ColumnMeta, TableAsset, get_meta_registry
from data_analysis.catalog.semantic_store import (
    EntityRef,
    MetricDefinition,
    SemanticModel,
    get_semantic_store,
)
from data_analysis.copilot.insight_engine import discover_insights as _discover_insights
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.observability.schema_drift import SchemaDrifter
from data_analysis.operators.correlation import run_correlation_analysis
from data_analysis.operators.eda import run_eda_profile
from data_analysis.operators.insights.dominance import detect_dominance
from data_analysis.operators.insights.outliers import detect_outliers
from data_analysis.operators.insights.trends import detect_trends
from data_analysis.operators.mining.clustering import run_kmeans_clustering, run_rfm_segmentation
from data_analysis.operators.mining.timeseries import run_timeseries_forecast
from data_analysis.operators.olap import run_olap_query, run_pivot_table
from data_analysis.operators.sandbox import run_duckdb_sql
from data_analysis.operators.spss.hypothesis import run_spss_hypothesis_test
from data_analysis.operators.spss.regression import run_spss_regression
from data_analysis.operators.variance import run_variance_decomposition
from data_analysis.operators.web_analytics.flow import calculate_user_flow
from data_analysis.operators.web_analytics.funnel import calculate_funnel
from data_analysis.operators.web_analytics.page_analytics import calculate_page_metrics
from data_analysis.operators.web_analytics.retention import calculate_retention
from data_analysis.operators.web_analytics.trace_replay import (
    get_session_action_replay,
    get_trace_waterfall,
)
from data_analysis.retl.audience_exporter import AudienceExporter
from data_analysis.retl.destination_sync import DestinationSync
from data_analysis.retl.webhook_pusher import WebhookPusher
from data_analysis.schemas.charts import ChartSpecBuilder
from data_analysis.transform.data_cleaner import DataCleaner
from data_analysis.transform.materializer import Materializer
from data_analysis.transform.pipeline_dag import get_pipeline_engine

mcp = FastMCP(settings.MCP_SERVER_NAME)

_register_tool = mcp.tool


def _scoped_tool(*tool_args, **tool_kwargs):
    """`mcp.tool` plus a request scope around every call.

    Over the sse / http transports several tool calls can run at once. The scope
    serializes calls that touch the same session (one DuckDB connection holds one
    pending result) exactly as the REST middleware does. functools.wraps keeps the
    signature FastMCP introspects, and the decorated name stays a plain callable.
    """
    register = _register_tool(*tool_args, **tool_kwargs)

    def decorate(fn):
        @functools.wraps(fn)
        def scoped(*args, **kwargs):
            with request_scope(owner=None):
                return fn(*args, **kwargs)

        register(scoped)
        return scoped

    return decorate


mcp.tool = _scoped_tool


@mcp.tool(
    name="connect_and_load_db",
    description="Connect to PostgreSQL/MySQL/MSSQL/SQLite/File, load data into in-memory session with projection & predicate pushdown. mode='materialize' (ConnectorX, default) or 'scanner' (DuckDB ATTACH + pushdown, PG/MySQL).",
)
def connect_and_load_db(
    conn_str: str,
    query_or_table: str,
    dataset_name: str,
    session_id: str | None = None,
    select_cols: list[str] | None = None,
    filter_sql: str | None = None,
    partition_col: str | None = None,
    num_partitions: int = 1,
    limit: int | None = None,
    mode: str = "materialize",
) -> str:
    mgr = SessionManager()
    sess = mgr.get_or_create_session(session_id)
    connector = ConnectorFactory.get_connector(conn_str)
    arrow_table = connector.fetch_to_arrow(
        query_or_table=query_or_table,
        filter_sql=filter_sql,
        select_cols=select_cols,
        partition_col=partition_col,
        num_partitions=num_partitions,
        limit=limit,
        mode=mode,
    )
    meta = sess.register_dataset(
        dataset_name, arrow_table, {"conn_str": conn_str, "source": query_or_table}
    )

    # Auto-register into Data Catalog
    cat = get_meta_registry(sess.session_id)
    cols = [ColumnMeta(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        TableAsset(
            dataset_name=dataset_name,
            display_name=dataset_name,
            description=f"Imported from {conn_str}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["imported", "raw"],
        )
    )

    return json.dumps(
        {
            "status": "success",
            "session_id": sess.session_id,
            "dataset_name": dataset_name,
            "row_count": meta.row_count,
            "column_count": meta.column_count,
            "columns": meta.column_names,
            "memory_bytes": meta.memory_bytes,
            "summary": f"Successfully loaded {meta.row_count:,} rows across {meta.column_count} columns into session '{sess.session_id}' (table '{dataset_name}').",
        },
        ensure_ascii=False,
    )


@mcp.tool(
    name="eda_profile",
    description="Run comprehensive EDA data profiling, distribution statistics, and data quality scoring.",
)
def eda_profile(session_id: str, dataset_name: str) -> str:
    res = run_eda_profile(session_id, dataset_name)
    summary = NarrativeBuilder.generate_eda_narrative(res)
    return json.dumps(
        {
            "status": "success",
            "summary": summary,
            "quality_score": res.get("quality_score"),
            "total_rows": res.get("total_rows"),
            "columns": res.get("columns"),
        },
        ensure_ascii=False,
    )


@mcp.tool(
    name="driver_attribution_analysis",
    description="Drill a metric change by dimension. SUM uses an additive contribution that closes and a Sun-Shapley average over dimension order. Other aggregations leave sun_shapley null. rate_col + volume_col returns Laspeyres on the first dimension only, plus a two-ordering Sun-Shapley of rate and volume.",
)
def driver_attribution_analysis(
    session_id: str,
    dataset_name: str,
    target_metric: str,
    dimension_path: list[str],
    base_filter: str,
    current_filter: str,
    agg_func: str = "SUM",
    top_k: int = 5,
    rate_col: str | None = None,
    volume_col: str | None = None,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = DistributedDriverAnalysis.analyze_driver(
        con=con,
        table_name=dataset_name,
        target_metric=target_metric,
        dimension_path=dimension_path,
        base_filter=base_filter,
        current_filter=current_filter,
        agg_func=agg_func,
        top_k=top_k,
        rate_col=rate_col,
        volume_col=volume_col,
    )
    summary = NarrativeBuilder.generate_driver_narrative(res)
    chart_data = []
    if res.get("hierarchy"):
        first_layer = res["hierarchy"][0].get("branches", [])
        chart_data = [
            {"category": b["dimension_value"], "diff": b["diff_value"]} for b in first_layer
        ]
    chart_spec = ChartSpecBuilder.build_waterfall_chart(chart_data, "category", "diff")
    return json.dumps(
        {
            "status": "success",
            "summary": summary,
            "method": res.get("method"),
            "orderings_used": res.get("orderings_used"),
            "sun_shapley": res.get("sun_shapley"),
            "driver_hierarchy": res.get("hierarchy"),
            "chart_spec": chart_spec,
            "evidence": res.get("evidence"),
        },
        ensure_ascii=False,
    )


@mcp.tool(
    name="spss_hypothesis_test",
    description="Execute SPSS-grade hypothesis tests (independent_t_test, paired_t_test, one_way_anova, chi_square, mann_whitney).",
)
def spss_hypothesis_test(
    session_id: str,
    dataset_name: str,
    test_type: str,
    dependent_var: str,
    group_var: str,
    alpha: float = 0.05,
) -> str:
    res = run_spss_hypothesis_test(
        session_id, dataset_name, test_type, dependent_var, group_var, alpha
    )
    summary = NarrativeBuilder.generate_spss_narrative(res)
    return json.dumps(
        {"status": "success", "summary": summary, "statistics": res}, ensure_ascii=False
    )


@mcp.tool(
    name="spss_regression_analysis",
    description="Run OLS or Logistic regression with full diagnostic battery (R2, F-test, VIF, DW residual test).",
)
def spss_regression_analysis(
    session_id: str,
    dataset_name: str,
    dependent_var: str,
    independent_vars: list[str],
    model_type: str = "ols",
) -> str:
    res = run_spss_regression(session_id, dataset_name, dependent_var, independent_vars, model_type)
    summary = NarrativeBuilder.generate_regression_narrative(res)
    return json.dumps(
        {"status": "success", "summary": summary, "model_report": res}, ensure_ascii=False
    )


@mcp.tool(
    name="detect_automated_insights",
    description="Detect anomaly outliers, temporal change points, and Gini dominance patterns.",
)
def detect_automated_insights(
    session_id: str,
    dataset_name: str,
    metric: str,
    category_col: str | None = None,
    time_col: str | None = None,
    outlier_method: str = "z_score",
    group_col: str | None = None,
) -> str:
    insights = {}
    if metric:
        dims = [group_col] if group_col else None
        outliers = detect_outliers(
            session_id,
            dataset_name,
            metric,
            dimension_cols=dims,
            method=outlier_method,
        )
        insights["outliers"] = outliers
    if category_col and metric:
        dominance = detect_dominance(session_id, dataset_name, category_col, metric)
        insights["dominance"] = dominance
    if time_col and metric:
        trends = detect_trends(session_id, dataset_name, time_col, metric)
        insights["trends"] = trends

    return json.dumps({"status": "success", "insights": insights}, ensure_ascii=False)


@mcp.tool(
    name="memory_olap_aggregation",
    description="Fast multi-dimensional OLAP aggregation (Rollup/Cube/Slice&Dice) in memory.",
)
def memory_olap_aggregation(
    session_id: str,
    dataset_name: str,
    dimensions: list[str],
    metrics: list[str],
    agg_funcs: list[str] | None = None,
    filters: str | None = None,
    rollup: bool = False,
    cube: bool = False,
    order_by: str | None = None,
    limit: int = 100,
) -> str:
    res = run_olap_query(
        session_id,
        dataset_name,
        dimensions,
        metrics,
        agg_funcs,
        filters,
        rollup=rollup,
        cube=cube,
        order_by=order_by,
        limit=limit,
    )
    return json.dumps({"status": "success", "result": res}, ensure_ascii=False)


@mcp.tool(
    name="duckdb_sql_sandbox",
    description="Execute read-only DuckDB SQL in-memory (use double quotes for identifiers). REST-only bridge quote/date normalization is not applied by this MCP tool. signed-scope bridge sessions require the REST analysis-bridge@1 signed-scope protocol; never use this MCP tool to bypass that authorization.",
)
def duckdb_sql_sandbox(session_id: str, sql_query: str, limit: int = 100) -> str:
    res = run_duckdb_sql(session_id, sql_query, limit)
    return json.dumps({"status": "success", "result": res}, ensure_ascii=False)


@mcp.tool(
    name="correlation_analysis",
    description="Compute a Pearson/Spearman correlation matrix and surface strongly-correlated column pairs.",
)
def correlation_analysis(
    session_id: str, dataset_name: str, columns: list[str] | None = None, method: str = "pearson"
) -> str:
    res = run_correlation_analysis(session_id, dataset_name, columns, method)
    return json.dumps({"status": "success", "correlation": res}, ensure_ascii=False)


@mcp.tool(
    name="pivot_table",
    description="Build a multi-dimensional pivot table (rows x columns aggregated by a measure).",
)
def pivot_table(
    session_id: str,
    dataset_name: str,
    rows: list[str],
    columns: str,
    values: str,
    agg_func: str = "SUM",
    filters: str | None = None,
    limit: int = 100,
) -> str:
    res = run_pivot_table(session_id, dataset_name, rows, columns, values, agg_func, filters, limit)
    return json.dumps({"status": "success", "pivot": res}, ensure_ascii=False)


@mcp.tool(
    name="kmeans_clustering",
    description="KMeans clustering with optional automatic k selection (silhouette) over feature columns.",
)
def kmeans_clustering(
    session_id: str,
    dataset_name: str,
    feature_cols: list[str],
    n_clusters: int | None = None,
    auto_k_range: list[int] | None = None,
) -> str:
    res = run_kmeans_clustering(
        session_id, dataset_name, feature_cols, n_clusters, auto_k_range or [2, 6]
    )
    return json.dumps({"status": "success", "clustering": res}, ensure_ascii=False)


@mcp.tool(
    name="rfm_segmentation",
    description="RFM (Recency/Frequency/Monetary) customer value segmentation.",
)
def rfm_segmentation(
    session_id: str, dataset_name: str, user_col: str, date_col: str, amount_col: str
) -> str:
    res = run_rfm_segmentation(session_id, dataset_name, user_col, date_col, amount_col)
    return json.dumps({"status": "success", "rfm": res}, ensure_ascii=False)


@mcp.tool(
    name="timeseries_forecast",
    description="Time-series forecast (ARIMA-family) for a value column over a horizon.",
)
def timeseries_forecast(
    session_id: str,
    dataset_name: str,
    time_col: str,
    value_col: str,
    horizon: int = 12,
    model_type: str = "arima",
) -> str:
    res = run_timeseries_forecast(
        session_id, dataset_name, time_col, value_col, horizon, model_type
    )
    return json.dumps({"status": "success", "forecast": res}, ensure_ascii=False)


@mcp.tool(
    name="discover_insights",
    description="Automated insight discovery: orchestrates Analysis Actions (anomaly/correlation/dominance/trend) over a dataset into ranked structured insights, an Insight Graph (relationships between findings), and a coherent data-story narrative. Optional 'intent' lightly biases which actions run; deeper NLU/agent reasoning is the caller's job.",
)
def discover_insights(
    session_id: str,
    dataset_name: str,
    intent: str | None = None,
    target_metric: str | None = None,
    category_col: str | None = None,
    time_col: str | None = None,
    max_insights: int = 8,
) -> str:
    res = _discover_insights(
        session_id,
        dataset_name,
        intent=intent,
        target_metric=target_metric,
        category_col=category_col,
        time_col=time_col,
        max_insights=max_insights,
    )
    return json.dumps({"status": "success", "insight_report": res}, ensure_ascii=False)


# ---------------- Trace Ingestion (Path B) ----------------


@mcp.tool(
    name="import_traces",
    description="Ingest trace/telemetry data (OTLP JSON, span JSON/NDJSON array, or CSV/Parquet) as a data source into an in-memory session table, so the full MDS pipeline (clean/model/EDA/OLAP/SPSS/funnel/waterfall/quality/reverse-ETL) can run on it — the same engine as the DB-connector path.",
)
def import_traces(
    source: str | None = None,
    dataset_name: str = "traces",
    session_id: str | None = None,
    fmt: str | None = None,
    records: list[dict[str, Any]] | None = None,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_or_create_session(session_id)
    if records is not None:
        arrow_table = TraceImporter.load_source(records=records)
    else:
        arrow_table = TraceImporter.load_source(source=source, fmt=fmt)
    meta = sess.register_dataset(dataset_name, arrow_table, {"source": source, "kind": "trace"})

    from data_analysis.catalog.meta_registry import get_meta_registry

    cat = get_meta_registry(sess.session_id)
    cols = [_CM(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        _TA(
            dataset_name=dataset_name,
            display_name=dataset_name,
            description=f"Trace data imported from {source}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["trace", "imported"],
        )
    )
    return json.dumps(
        {
            "status": "success",
            "session_id": sess.session_id,
            "dataset_name": dataset_name,
            "row_count": meta.row_count,
            "columns": meta.column_names,
            "summary": f"Imported {meta.row_count:,} trace spans/events into session '{sess.session_id}' (table '{dataset_name}').",
        },
        ensure_ascii=False,
    )


# ---------------- Trace / Web Analytics (on a session-resident table) ----------------


@mcp.tool(
    name="analyze_conversion_funnel",
    description="Calculate sequential conversion funnel, drop-off and step conversion over a session-resident trace/event table.",
)
def analyze_conversion_funnel(
    session_id: str,
    dataset_name: str,
    steps: list[str],
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    res = calculate_funnel(session_id, dataset_name, steps, date_from, date_to)
    return json.dumps({"status": "success", "funnel": res}, ensure_ascii=False)


@mcp.tool(
    name="analyze_user_flow",
    description="Calculate page navigation transition matrix and Sankey nodes/links over a session-resident trace/event table.",
)
def analyze_user_flow(session_id: str, dataset_name: str, limit_paths: int = 15) -> str:
    res = calculate_user_flow(session_id, dataset_name, limit_paths=limit_paths)
    return json.dumps({"status": "success", "user_flow": res}, ensure_ascii=False)


@mcp.tool(
    name="analyze_cohort_retention",
    description="Calculate N-day cohort retention grid over a session-resident trace/event table.",
)
def analyze_cohort_retention(session_id: str, dataset_name: str, days: int = 7) -> str:
    res = calculate_retention(session_id, dataset_name, days=days)
    return json.dumps({"status": "success", "retention": res}, ensure_ascii=False)


@mcp.tool(
    name="analyze_page_performance",
    description="Calculate PV/UV and average dwell by page path over a session-resident trace/event table.",
)
def analyze_page_performance(session_id: str, dataset_name: str, limit: int = 20) -> str:
    res = calculate_page_metrics(session_id, dataset_name, limit=limit)
    return json.dumps({"status": "success", "page_metrics": res}, ensure_ascii=False)


@mcp.tool(
    name="inspect_trace_and_replay",
    description="Retrieve an OpenTelemetry span waterfall (by trace_id) or a breadcrumb replay timeline (by telemetry session) from a session-resident trace table.",
)
def inspect_trace_and_replay(
    session_id: str,
    dataset_name: str,
    trace_id: str | None = None,
    telemetry_session_id: str | None = None,
) -> str:
    result = {}
    if trace_id:
        result["waterfall"] = get_trace_waterfall(session_id, dataset_name, trace_id)
    if telemetry_session_id:
        result["replay"] = get_session_action_replay(session_id, dataset_name, telemetry_session_id)
    return json.dumps({"status": "success", "data": result}, ensure_ascii=False)


# ---------------- Modern Data Stack (MDS) Tools ----------------


@mcp.tool(
    name="query_semantic_metric",
    description="Query standardized business metrics from Semantic Metric Store with auto-compiled SQL.",
)
def query_semantic_metric(
    session_id: str,
    metric_names: list[str],
    dimensions: list[str] | None = None,
    filters: str | None = None,
    order_by: str | None = None,
    limit: int = 100,
) -> str:
    store = get_semantic_store(session_id)
    sql = store.compile_query(metric_names, dimensions, filters, order_by, limit)
    res = run_duckdb_sql(session_id, sql, limit=limit)
    return json.dumps({"status": "success", "compiled_sql": sql, "result": res}, ensure_ascii=False)


@mcp.tool(
    name="execute_data_cleaning",
    description="Clean dirty data: deduplicate, fill missing values (mean/median/mode/constant), and clip outliers.",
)
def execute_data_cleaning(
    session_id: str,
    source_table: str,
    target_table: str,
    dedup_keys: list[str] | None = None,
    fillna_rules: dict[str, Any] | None = None,
    outlier_clip_cols: dict[str, dict[str, float]] | None = None,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = DataCleaner.clean_table(
        con, source_table, target_table, dedup_keys, fillna_rules, outlier_clip_cols
    )
    return json.dumps({"status": "success", "cleaning_result": res}, ensure_ascii=False)


@mcp.tool(
    name="run_dag_pipeline",
    description="Execute dbt-style topological DAG SQL transformation pipeline.",
)
def run_dag_pipeline(session_id: str) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    pipe = get_pipeline_engine(session_id)
    res = pipe.run_pipeline(con)
    return json.dumps({"status": "success", "pipeline_execution": res}, ensure_ascii=False)


@mcp.tool(
    name="reverse_sync_destination",
    description="Reverse ETL: sync analytical table/RFM scores back to target database or file.",
)
def reverse_sync_destination(
    session_id: str,
    source_table: str,
    dest_conn_str: str,
    dest_table_name: str,
    mode: str = "replace",
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = DestinationSync.sync_table_to_destination(
        con, source_table, dest_conn_str, dest_table_name, mode
    )
    return json.dumps({"status": "success", "sync_result": res}, ensure_ascii=False)


@mcp.tool(
    name="export_audience_cohort",
    description="Export specific audience segment or churn-risk users to JSON or CSV for CRM/marketing activation.",
)
def export_audience_cohort(
    session_id: str,
    source_table: str,
    filter_sql: str | None = None,
    export_columns: list[str] | None = None,
    format_type: str = "json",
    limit: int = 1000,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = AudienceExporter.export_cohort(
        con, source_table, filter_sql, export_columns, format_type, limit
    )
    return json.dumps({"status": "success", "audience": res}, ensure_ascii=False)


@mcp.tool(
    name="send_operational_webhook_alert",
    description="Send automated operational alerts or attribution findings to Feishu, DingTalk, Slack, or Webhook.",
)
def send_operational_webhook_alert(
    webhook_url: str,
    title: str,
    message: str,
    platform: str = "generic",
    extra_metrics: dict[str, Any] | None = None,
) -> str:
    res = WebhookPusher.send_alert(webhook_url, title, message, platform, extra_metrics)
    # The outer status must tell the truth: an agent reads it, not the nested result.
    delivered = res.get("status") == "SUCCESS"
    return json.dumps(
        {"status": "success" if delivered else "error", "alert_result": res}, ensure_ascii=False
    )


@mcp.tool(
    name="assert_data_quality",
    description="Run Great-Expectations style declarative data quality assertions suite (nulls, uniqueness, range, rows).",
)
def assert_data_quality(session_id: str, table: str, rules: list[dict[str, Any]]) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = DataQualityAssertions.run_suite(con, table, rules)
    return json.dumps({"status": "success", "quality_report": res}, ensure_ascii=False)


@mcp.tool(
    name="detect_table_schema_drift",
    description="Detect column additions, removals, and type alterations against baseline schema.",
)
def detect_table_schema_drift(session_id: str, table: str, baseline_schema: dict[str, str]) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    res = SchemaDrifter.detect_drift(con, table, baseline_schema)
    return json.dumps({"status": "success", "drift_report": res}, ensure_ascii=False)


# ---------------- Palantir-Style Agentic Ontology Tools ----------------


@mcp.tool(
    name="ontology_list_schema",
    description="List business entities (ObjectTypes), relation graphs (LinkTypes), and available actions (ActionTypes).",
)
def ontology_list_schema() -> str:
    engine = get_ontology_engine()
    summary = engine.get_ontology_schema_summary()
    return json.dumps({"status": "success", "ontology_schema": summary}, ensure_ascii=False)


@mcp.tool(
    name="ontology_query_objects",
    description="Query business entity instances (e.g. Customers, Orders, Devices) with property projections and filters.",
)
def ontology_query_objects(
    session_id: str,
    object_type: str,
    filters: str | None = None,
    properties: list[str] | None = None,
    limit: int = 50,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    res = engine.query_object_instances(con, object_type, filters, properties, limit)
    return json.dumps({"status": "success", "data": res}, ensure_ascii=False)


@mcp.tool(
    name="ontology_traverse_links",
    description="Graph-traverse from a source entity instance along relation links to discover connected business entities.",
)
def ontology_traverse_links(
    session_id: str,
    source_object_type: str,
    source_instance_id: str,
    link_name: str,
    limit: int = 50,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    res = engine.traverse_links(con, source_object_type, source_instance_id, link_name, limit)
    return json.dumps({"status": "success", "traversal": res}, ensure_ascii=False)


@mcp.tool(
    name="ontology_execute_action",
    description="Execute an atomic business action on an entity instance (e.g. ApplyDiscount, RerouteOrder) with audit logging.",
)
def ontology_execute_action(
    session_id: str,
    action_name: str,
    instance_id: str,
    parameters: dict[str, Any],
    dry_run: bool = True,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    try:
        audit = engine.execute_action(con, action_name, instance_id, parameters, dry_run)
    except (ValueError, FileNotFoundError) as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps({"status": "success", "action_audit": audit}, ensure_ascii=False)


@mcp.tool(
    name="import_excel_or_csv",
    description="Load an Excel (.xlsx) or CSV file into the session as a queryable dataset. Legacy .xls is not supported: re-save as .xlsx or .csv. sheet_name selects a worksheet (default: the first one).",
)
def import_excel_or_csv(
    file_path: str,
    dataset_name: str,
    session_id: str | None = None,
    sheet_name: str | None = None,
    limit: int | None = None,
) -> str:
    mgr = SessionManager()
    sess = mgr.get_or_create_session(session_id)
    conn_str = f"file://{file_path}"
    connector = ConnectorFactory.get_connector(conn_str)
    arrow_table = connector.fetch_to_arrow(query_or_table=sheet_name or "Sheet1", limit=limit)
    rejected_rows = int(getattr(connector, "rejected_rows", 0) or 0)
    meta = sess.register_dataset(dataset_name, arrow_table, {"source_file": file_path})

    # Register into Catalog
    cat = get_meta_registry(sess.session_id)
    cols = [ColumnMeta(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        TableAsset(
            dataset_name=dataset_name,
            display_name=dataset_name,
            description=f"Imported from {os.path.basename(file_path)}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["file_import", "excel_csv"],
        )
    )

    return json.dumps(
        {
            "status": "success",
            "session_id": sess.session_id,
            "dataset_name": dataset_name,
            "row_count": meta.row_count,
            "column_count": meta.column_count,
            "columns": meta.column_names,
            "column_types": {f.name: str(f.type) for f in meta.table.schema},
            "memory_bytes": meta.memory_bytes,
            "rejected_rows": rejected_rows,
            "summary": (
                f"WARNING: {rejected_rows:,} malformed row(s) were skipped. "
                if rejected_rows
                else ""
            )
            + f"Successfully loaded {os.path.basename(file_path)} with {meta.row_count:,} rows and {meta.column_count} columns into session '{sess.session_id}'.",
        },
        ensure_ascii=False,
    )


# ===== Ported from data-agent (A): variance + business/analytical/hex MCP tools =====


@mcp.tool(
    name="variance_decomposition",
    description="Decompose a numeric metric across categorical dimensions. Between-group and within-group sums of squares close. sun_shapley averages sequential increments over dimension order (at most 4 dimensions, 24 orderings). An interaction term is returned only for exactly two dimensions when the design is balanced.",
)
def variance_decomposition(
    session_id: str,
    dataset_name: str,
    metric: str,
    dimensions: list[str],
    filters: str | None = None,
) -> str:
    res = run_variance_decomposition(session_id, dataset_name, metric, dimensions, filters)
    return json.dumps({"status": "success", "variance_decomposition": res}, ensure_ascii=False)


@mcp.tool(
    name="discover_business_report",
    description="Inspect a session dataset and suggest field mappings and latest comparison windows. Suggestions are candidates, not business semantics. Reuse session_id from import/connect. No external writes.",
)
def discover_business_report(session_id: str, dataset_name: str, grain: str = "month") -> str:
    from data_analysis.operators.business_report import discover_report

    return json.dumps(
        discover_report(session_id, dataset_name, grain), ensure_ascii=False, default=str
    )


@mcp.tool(
    name="generate_business_report",
    description="Generate a general evidence report for an uploaded/session dataset: SUM metric changes, selected time grain, up to two separate dimension contributions, Z-score anomalies, checks and next steps. Pass config matching BusinessReportRequest: metric, time_column, dimensions, grain, base_start/base_end/current_start/current_end (ISO dates, end-exclusive); optional mapping product/quantity/price/discount/sales/cost/order and discount_scale 1 or 100 enables validated profit midpoint decomposition. Optional filter_dimension/filter_value enables iterative drilldown. Reports are accounting evidence, not causal proof; missing capabilities are explicit; no writes.",
)
def generate_business_report_tool(
    session_id: str, dataset_name: str, config: dict[str, Any]
) -> str:
    from data_analysis.operators.business_report import generate_business_report
    from data_analysis.schemas.requests import BusinessReportRequest

    req = BusinessReportRequest(
        **{**config, "session_id": session_id, "dataset_name": dataset_name}
    )
    return json.dumps(generate_business_report(req), ensure_ascii=False, default=str)


from data_analysis.schemas.requests import (
    DecompositionRequest,
    MetricCompareRequest,
    SensitivityRequest,
)


@mcp.tool(
    name="compare_metric",
    description="Compare a typed metric (sum, ratio of sums, distinct_count, closing_balance) across explicit end-exclusive windows and calendar buckets. Strict mode requires caller completeness watermark; aware timestamps require offsets and IANA timezone. Returns v2 evidence identical to REST. No writes or Agent loop.",
)
def compare_metric_tool(request: MetricCompareRequest) -> dict:
    from data_analysis.operators.analytical_tools import compare_metric

    return compare_metric(request)


@mcp.tool(
    name="decompose_change",
    description="Independent change decomposition: additive dimension (sum only), numerator/denominator ratio midpoint, or validated hierarchical profit midpoint with field mapping. Returns full reconciliation and Top-K omitted contribution, v2 evidence. Contribution is not causality. Uses the same metric/time contract as compare_metric.",
)
def decompose_change_tool(request: DecompositionRequest) -> dict:
    from data_analysis.operators.analytical_tools import decompose_change

    return decompose_change(request)


@mcp.tool(
    name="analyze_sensitivity",
    description="Independent read-only anomaly sensitivity: baseline-fitted Z-score/IQR/MAD, optional group cohorts, row or entity exclusion, original versus reviewed typed metric comparisons. Zero dispersion/missing reference groups are unscored and retained; no source rows are deleted. Returns candidate truncation, population counts and v2 evidence.",
)
def analyze_sensitivity_tool(request: SensitivityRequest) -> dict:
    from data_analysis.operators.analytical_tools import analyze_sensitivity

    return analyze_sensitivity(request)


# ---------------- Hex-Style Context Studio, dbt YAML, Trail Playbooks & Health Tools ----------------
from data_analysis.catalog.context_studio import ContextGuide, get_context_studio
from data_analysis.copilot.analysis_trail import AnalysisTrailLedger, get_trail_ledger
from data_analysis.observability.context_health import ContextHealthAuditor


@mcp.tool(
    name="set_workspace_context_rules",
    description="Configure Hex Context Studio Layer 1 workspace rules: global/session system instructions, naming conventions, and endorsed_only_default guardrail.",
)
def set_workspace_context_rules(
    session_id: str = "_global",
    system_rules: str = "",
    endorsed_only_default: bool = False,
    naming_conventions: dict[str, str] | None = None,
) -> str:
    studio = get_context_studio(session_id)
    rule = studio.set_workspace_rules(
        system_rules=system_rules,
        endorsed_only_default=endorsed_only_default,
        naming_conventions=naming_conventions,
    )
    return json.dumps({"status": "success", "rule": rule.model_dump()}, ensure_ascii=False)


@mcp.tool(
    name="register_context_guide",
    description="Register a Hex Context Studio Layer 2 Markdown business guide/SOP bound to workspace, table, metric, or model.",
)
def register_context_guide(
    name: str,
    title: str,
    content: str,
    session_id: str = "_global",
    scope: str = "workspace",
    target_names: list[str] | None = None,
    tags: list[str] | None = None,
    endorsement_status: str = "endorsed",
) -> str:
    studio = get_context_studio(session_id)
    guide = ContextGuide(
        name=name,
        title=title,
        content=content,
        scope=scope,  # type: ignore[arg-type]
        target_names=target_names or [],
        tags=tags or [],
        endorsement_status=endorsement_status,  # type: ignore[arg-type]
    )
    saved = studio.register_guide(guide)
    return json.dumps({"status": "success", "guide": saved.model_dump()}, ensure_ascii=False)


@mcp.tool(
    name="endorse_context_asset",
    description="Set Hex Context Studio Layer 4 trust tier ('endorsed', 'draft', 'deprecated', 'warning') on a table, metric, model, or guide.",
)
def endorse_context_asset(
    asset_type: str,
    name: str,
    status: str = "endorsed",
    endorsement_note: str = "",
    endorsed_by: str | None = None,
    session_id: str = "_global",
) -> str:
    studio = get_context_studio(session_id)
    try:
        res = studio.endorse_asset(
            asset_type=asset_type,  # type: ignore[arg-type]
            name=name,
            status=status,  # type: ignore[arg-type]
            endorsement_note=endorsement_note,
            endorsed_by=endorsed_by,
        )
    except ValueError as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps({"status": "success", **res}, ensure_ascii=False)


@mcp.tool(
    name="resolve_session_context",
    description="Traverse the 4-layer Context Studio hierarchy (1. Workspace Context -> 2. Business Guides -> 3. Semantic Models/Metrics -> 4. Endorsements & proactive warnings) for a session.",
)
def resolve_session_context(
    session_id: str = "_global",
    dataset_name: str | None = None,
    metric_names: list[str] | None = None,
    endorsed_only: bool | None = None,
) -> str:
    studio = get_context_studio(session_id)
    res = studio.resolve_hierarchy(
        dataset_name=dataset_name,
        metric_names=metric_names,
        endorsed_only=endorsed_only,
    )
    return json.dumps({"status": "success", **res}, ensure_ascii=False)


@mcp.tool(
    name="import_dbt_semantic_yaml",
    description="Import dbt Semantic Layer (MetricFlow) / OSI YAML definitions (semantic_models, measures, simple/ratio/derived/cumulative metrics) into the session SemanticMetricStore.",
)
def import_dbt_semantic_yaml(
    yaml_content: str,
    session_id: str = "_global",
    default_endorsement_status: str = "endorsed",
) -> str:
    store = get_semantic_store(session_id)
    try:
        res = store.import_dbt_semantic_yaml(
            yaml_content=yaml_content,
            default_endorsement_status=default_endorsement_status,
        )
    except ValueError as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps({"status": "success", **res}, ensure_ascii=False)


@mcp.tool(
    name="export_dbt_semantic_yaml",
    description="Export registered SemanticModels and MetricDefinitions from SemanticMetricStore as dbt MetricFlow YAML.",
)
def export_dbt_semantic_yaml(session_id: str = "_global") -> str:
    store = get_semantic_store(session_id)
    yaml_str = store.export_dbt_semantic_yaml()
    return json.dumps(
        {"status": "success", "session_id": session_id, "yaml_content": yaml_str},
        ensure_ascii=False,
    )


@mcp.tool(
    name="list_analysis_trail",
    description="List the ordered AnalysisStep ledger recorded in a session (Hex Threads-style inspectable trail).",
)
def list_analysis_trail(session_id: str, limit: int = 100) -> str:
    ledger = get_trail_ledger(session_id)
    steps = [s.model_dump() for s in ledger.list_steps(limit=limit)]
    return json.dumps(
        {"status": "success", "session_id": session_id, "step_count": len(steps), "steps": steps},
        ensure_ascii=False,
    )


@mcp.tool(
    name="export_analysis_playbook",
    description="Promote a session's recorded analysis trail (or selected step_ids) into a reusable, parameterizable AnalysisPlaybook.",
)
def export_analysis_playbook(
    session_id: str,
    title: str,
    description: str = "",
    step_ids: list[str] | None = None,
    parameters: dict[str, Any] | None = None,
    playbook_id: str | None = None,
    endorsement_status: str = "endorsed",
) -> str:
    ledger = get_trail_ledger(session_id)
    try:
        pb = ledger.export_playbook(
            title=title,
            description=description,
            step_ids=step_ids,
            parameters=parameters,
            playbook_id=playbook_id,
            endorsement_status=endorsement_status,
        )
    except ValueError as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps({"status": "success", "playbook": pb.model_dump()}, ensure_ascii=False)


@mcp.tool(
    name="replay_analysis_playbook",
    description="Replay a saved AnalysisPlaybook deterministically with optional parameter_overrides (e.g. new base/current dates, dataset_name, or filters).",
)
def replay_analysis_playbook(
    playbook_id: str,
    target_session_id: str | None = None,
    parameter_overrides: dict[str, Any] | None = None,
) -> str:
    try:
        res = AnalysisTrailLedger.replay_playbook(
            playbook_id=playbook_id,
            target_session_id=target_session_id,
            parameter_overrides=parameter_overrides,
        )
    except ValueError as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps(res, ensure_ascii=False, default=str)


@mcp.tool(
    name="audit_agent_context_health",
    description="Run Hex Context Studio-style proactive observability audit over a session: computes context_health_score, ungoverned SQL ratio, unendorsed table queries, frequent caveats, and governance recommendations.",
)
def audit_agent_context_health(session_id: str = "_global") -> str:
    res = ContextHealthAuditor.audit_session_health(session_id)
    return json.dumps({"status": "success", **res}, ensure_ascii=False)


# ===== Additional A MCP tools required by ported tests =====


@mcp.tool(
    name="list_session_datasets",
    description="List datasets registered in the session, with row counts and redacted source info.",
)
def list_session_datasets(session_id: str) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    rows = []
    for name, meta in sess.datasets.items():
        source = dict(meta.source_info or {})
        if "conn_str" in source:
            source["conn_str"] = "***"
        rows.append(
            {
                "name": name,
                "row_count": meta.row_count,
                "column_count": meta.column_count,
                "columns": meta.column_names,
                "memory_bytes": meta.memory_bytes,
                "source": source,
            }
        )
    return json.dumps({"status": "success", "datasets": rows}, ensure_ascii=False)


@mcp.tool(
    name="create_wide_table",
    description="Join a fact table to dimension tables into one wide table. Returns wide_table_name, row_count, and columns.",
)
def create_wide_table(
    session_id: str,
    target_name: str,
    fact_table: str,
    dimension_joins: list[dict[str, Any]],
) -> str:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        return json.dumps({"status": "error", "message": f"Session '{session_id}' not found"})
    try:
        res = Materializer.create_wide_table(
            sess.get_duckdb_conn(), target_name, fact_table, dimension_joins
        )
    except (ValueError, FileNotFoundError) as exc:
        return json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False)
    return json.dumps({"status": "success", "wide_table": res}, ensure_ascii=False)


@mcp.tool(
    name="list_semantic_metrics", description="List metric definitions registered in this session."
)
def list_semantic_metrics(session_id: str) -> str:
    metrics = [m.model_dump() for m in get_semantic_store(session_id).list_metrics()]
    return json.dumps({"status": "success", "metrics": metrics}, ensure_ascii=False)


@mcp.tool(
    name="ontology_entity_graph",
    description="Return the ontology entity graph: nodes, edges, and broken_edges whose endpoints are not registered.",
)
def ontology_entity_graph() -> str:
    graph = get_ontology_engine().entity_graph()
    return json.dumps({"status": "success", "entity_graph": graph}, ensure_ascii=False)


@mcp.tool(
    name="register_semantic_metric",
    description="Register a metric formula on a session table. On the single-table compile path, a non-empty dimension list is a whitelist; an empty list does not restrict the caller. A registered semantic model uses the governed join path.",
)
def register_semantic_metric(
    session_id: str,
    name: str,
    table_name: str,
    formula: str,
    aggregation_type: str = "SUM",
    dimensions: list[str] | None = None,
    display_name: str | None = None,
    description: str = "",
    numerator_metric: str | None = None,
    denominator_metric: str | None = None,
    endorsement_status: str = "draft",
    endorsement_note: str = "",
) -> str:
    metric = MetricDefinition(
        name=name,
        display_name=display_name,
        description=description,
        table_name=table_name,
        formula=formula,
        aggregation_type=aggregation_type,
        dimensions=dimensions or [],
        numerator_metric=numerator_metric,
        denominator_metric=denominator_metric,
        endorsement_status=endorsement_status,
        endorsement_note=endorsement_note,
    )
    get_semantic_store(session_id).register_metric(metric)
    return json.dumps({"status": "success", "metric": metric.model_dump()}, ensure_ascii=False)


@mcp.tool(
    name="register_semantic_model",
    description="Register a semantic model: grain, columns, and many-to-one entities. Joins follow a foreign key toward a primary key, at most two hops.",
)
def register_semantic_model(
    session_id: str,
    name: str,
    table_name: str,
    grain: list[str],
    columns: list[str] | None = None,
    entities: list[dict[str, str]] | None = None,
    agg_time_dimension: str | None = None,
) -> str:
    model = SemanticModel(
        name=name,
        table_name=table_name,
        grain=grain,
        columns=columns or [],
        entities=[EntityRef(**entity) for entity in (entities or [])],
        agg_time_dimension=agg_time_dimension,
    )
    get_semantic_store(session_id).register_model(model)
    return json.dumps({"status": "success", "model": model.model_dump()}, ensure_ascii=False)


def run_server() -> None:
    """Start the MCP server on the configured transport.

    stdio (default) serves one local client over the process pipes. `sse` and
    `http` (streamable HTTP) listen on MCP_HOST:MCP_SSE_PORT for remote agents.
    The MCP endpoint has no API-key check: expose it only to a trusted network.
    """
    transport = settings.MCP_TRANSPORT.strip().lower()
    if transport == "stdio":
        mcp.run()
    elif transport in ("sse", "http", "streamable-http"):
        mcp.run(transport=transport, host=settings.MCP_HOST, port=settings.MCP_SSE_PORT)
    else:
        raise ValueError(
            f"Unsupported DATA_ANALYSIS_MCP_TRANSPORT '{settings.MCP_TRANSPORT}': use stdio, sse or http"
        )


if __name__ == "__main__":
    run_server()
