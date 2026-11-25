import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from data_analysis import examples as builtin_examples
from data_analysis.catalog.lineage_tracker import get_lineage_tracker
from data_analysis.catalog.meta_registry import ColumnMeta, TableAsset, get_meta_registry
from data_analysis.catalog.semantic_store import MetricDefinition, get_semantic_store
from data_analysis.cluster.request_scope import SessionBusyError, owner_digest, request_scope
from data_analysis.cluster.session_manager import (
    DatasetTooLargeError,
    SessionCapacityError,
    SessionConflictError,
    SessionManager,
    SessionNotFoundError,
)
from data_analysis.config import settings
from data_analysis.connectors.factory import ConnectorFactory
from data_analysis.connectors.trace_importer import TraceImporter
from data_analysis.copilot.insight_engine import discover_insights
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.engine.reach_guard import resolve_inside, safe_upload_name
from data_analysis.logging_setup import configure_logging, get_request_id, set_request_id
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.observability.schema_drift import SchemaDrifter
from data_analysis.ontology.action_type import ActionType
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType
from data_analysis.ontology.ontology_engine import get_ontology_engine
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
    list_recent_sessions,
)
from data_analysis.retl.audience_exporter import AudienceExporter
from data_analysis.retl.destination_sync import DestinationSync
from data_analysis.retl.webhook_pusher import WebhookPusher
from data_analysis.schemas.charts import ChartSpecBuilder
from data_analysis.schemas.requests import (
    ClusteringRequest,
    ConnectDBRequest,
    CorrelationRequest,
    DominanceRequest,
    DriverAnalysisRequest,
    EDARequest,
    HypothesisTestRequest,
    OLAPRequest,
    OutliersRequest,
    PivotRequest,
    RegressionRequest,
    SQLSandboxRequest,
    TimeSeriesRequest,
    TrendsRequest,
    VarianceDecompositionRequest,
    WideTableRequest,
)
from data_analysis.schemas.responses import AnalysisResponse
from data_analysis.security import require_api_key, validate_auth_config
from data_analysis.transform.data_cleaner import DataCleaner
from data_analysis.transform.materializer import Materializer
from data_analysis.transform.pipeline_dag import DAGModel, get_pipeline_engine

configure_logging()
logger = logging.getLogger("data_analysis.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Validated at startup rather than import so the failure surfaces as a
    # refused boot with a readable error. Raises when auth is required but no
    # keys are configured. see data_analysis/security.py.
    validate_auth_config()
    logger.info(
        "%s v%s starting (auth_required=%s, keys_configured=%d)",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.REQUIRE_AUTH,
        len(settings.api_key_list),
    )
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="In-memory (DuckDB + Arrow) data analysis and automated insight engine for AI Agents. Sessions are held in process memory: treat them as a cache and reload on 404.",
    # One registration covers every /api/v1 route, including routers included
    # later. require_api_key exempts non-/api/v1 paths itself.
    dependencies=[Depends(require_api_key)],
)

# Explicit origins only: allow_credentials with allow_origins=["*"] is rejected
# by browsers, so the old config was both over-permissive and non-functional.
_cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Safe only because the origin list is explicit and never "*".
    allow_credentials=True,
    # dashboard.js uses GET and POST; OPTIONS is the preflight itself.
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    # Content-Type: dashboard.js + tracker.js JSON posts. X-API-Key: auth.
    # X-Request-ID: lets a caller supply its own correlation id.
    allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

# Static assets for the pipeline dashboard. Telemetry collection is NOT part of
# this service; it lives in examples/telemetry-collector-demo and feeds data in
# via the trace import endpoint below.
# Resolved from this file, not the working directory: the app must start from any cwd
# and importing it must not create directories in the caller's cwd.
_WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
app.mount("/static", StaticFiles(directory=os.path.join(_WEB_DIR, "static")), name="static")


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Assign a request id, log the outcome, and echo the id back.

    Logs method/path/status/duration only. Never the body, query secrets, or the
    X-API-Key value.
    """
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    set_request_id(request_id)
    started = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started) * 1000
        # exc_info=True gives the traceback in the log, never in the response.
        logger.error(
            "%s %s failed after %.2fms",
            request.method,
            request.url.path,
            duration_ms,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": "Internal server error",
                "request_id": request_id,
            },
            headers={"X-Request-ID": request_id},
        )

    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s -> %d in %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response


class RequestScopeMiddleware:
    """Publish caller identity and release session locks after the response."""

    def __init__(self, asgi_app):
        self.app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        api_key = None
        for name, value in scope.get("headers") or []:
            if name == b"x-api-key":
                api_key = value.decode("latin-1")
                break
        owner = owner_digest(api_key) if settings.api_key_list else None
        with request_scope(owner):
            await self.app(scope, receive, send)


def _error_response(
    status_code: int, detail: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    request_id = get_request_id()
    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "detail": detail, "request_id": request_id},
        headers={"X-Request-ID": request_id, **(headers or {})},
    )


@app.exception_handler(SessionNotFoundError)
async def session_not_found_handler(_request: Request, exc: SessionNotFoundError):
    # Expired, evicted, never existed, or not yours: the caller reloads its data.
    return _error_response(404, str(exc))


@app.exception_handler(SessionConflictError)
async def session_conflict_handler(_request: Request, exc: SessionConflictError):
    return _error_response(409, str(exc))


@app.exception_handler(DatasetTooLargeError)
async def dataset_too_large_handler(_request: Request, exc: DatasetTooLargeError):
    return _error_response(413, str(exc))


@app.exception_handler(PermissionError)
async def permission_error_handler(_request: Request, exc: PermissionError):
    # Raised by the SQL sandbox and the path / URL guards; the message is written for the caller.
    return _error_response(403, str(exc))


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError):
    # ValueError is what the guards and operators raise for a bad request (unknown
    # column, invalid identifier, malformed SQL, unsupported file). It used to fall
    # through to the generic 500, which told the caller nothing and looked like an outage.
    return _error_response(400, str(exc))


@app.exception_handler(SessionBusyError)
async def session_busy_handler(_request: Request, exc: SessionBusyError):
    return _error_response(503, str(exc), {"Retry-After": "2"})


@app.exception_handler(SessionCapacityError)
async def session_capacity_handler(_request: Request, exc: SessionCapacityError):
    return _error_response(503, str(exc), {"Retry-After": "30"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Generic 500 carrying only the request id, never the stack trace."""
    request_id = get_request_id()
    logger.error("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "Internal server error",
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


# Added last so it wraps everything above, including CORS and the request logger.
app.add_middleware(RequestScopeMiddleware)


@app.exception_handler(TimeoutError)
async def analysis_timeout_handler(_request: Request, _exc: TimeoutError):
    return _error_response(504, "Analysis query time budget exceeded")


@app.get("/api/v1/sessions")
def api_list_sessions():
    """Sessions created with the caller's API key."""
    return {"sessions": SessionManager().list_sessions()}


@app.delete("/api/v1/sessions/{session_id}")
def api_drop_session(session_id: str):
    """Free a session's memory now instead of waiting for the idle TTL."""
    if not SessionManager().drop_session(session_id):
        raise SessionNotFoundError(session_id)
    return {"status": "success", "session_id": session_id}


@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/dashboard", response_class=HTMLResponse)
def get_dashboard():
    with open(os.path.join(_WEB_DIR, "templates", "dashboard.html"), encoding="utf-8") as f:
        return f.read()


# ----------------- Core IQuery Analysis Endpoints -----------------


@app.post("/api/v1/connect", response_model=AnalysisResponse)
def connect_db(req: ConnectDBRequest):
    mgr = SessionManager()
    sess = mgr.get_or_create_session(req.session_id)
    connector = ConnectorFactory.get_connector(req.conn_str)
    arrow_table = connector.fetch_to_arrow(
        query_or_table=req.query_or_table,
        filter_sql=req.filter_sql,
        select_cols=req.select_cols,
        partition_col=req.partition_col,
        num_partitions=req.num_partitions,
        limit=req.limit,
        mode=req.mode,
    )
    meta = sess.register_dataset(
        req.dataset_name, arrow_table, {"conn_str": req.conn_str, "source": req.query_or_table}
    )

    # Auto-register into Data Catalog
    cat = get_meta_registry(sess.session_id)
    cols = [ColumnMeta(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        TableAsset(
            dataset_name=req.dataset_name,
            display_name=req.dataset_name,
            description=f"Loaded from {req.conn_str}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["raw", "imported"],
        )
    )

    return AnalysisResponse(
        status="success",
        session_id=sess.session_id,
        summary_text=f"Successfully loaded dataset '{req.dataset_name}' with {meta.row_count:,} rows into session '{sess.session_id}'.",
        metadata={
            "row_count": meta.row_count,
            "columns": meta.column_names,
            "memory_bytes": meta.memory_bytes,
        },
    )


def _client_error(exc: Exception) -> HTTPException:
    """Map ValueError/FileNotFoundError from operators into 400 responses."""
    return HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/tools/eda", response_model=AnalysisResponse)
def api_eda(req: EDARequest):
    res = run_eda_profile(req.session_id, req.dataset_name)
    summary = NarrativeBuilder.generate_eda_narrative(res)
    return AnalysisResponse(
        status="success", session_id=req.session_id, summary_text=summary, statistics=res
    )


@app.post("/api/v1/tools/driver_analysis", response_model=AnalysisResponse)
def api_driver_analysis(req: DriverAnalysisRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    res = DistributedDriverAnalysis.analyze_driver(
        con=con,
        table_name=req.dataset_name,
        target_metric=req.target_metric,
        dimension_path=req.dimension_path,
        base_filter=req.base_filter,
        current_filter=req.current_filter,
        agg_func=req.agg_func,
        top_k=req.top_k,
        rate_col=req.rate_col,
        volume_col=req.volume_col,
    )
    summary = NarrativeBuilder.generate_driver_narrative(res)
    chart_data = []
    if res.get("hierarchy"):
        first_layer = res["hierarchy"][0].get("branches", [])
        chart_data = [
            {"category": b["dimension_value"], "diff": b["diff_value"]} for b in first_layer
        ]
    chart_spec = ChartSpecBuilder.build_waterfall_chart(chart_data, "category", "diff")
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=summary,
        statistics=res,
        chart_spec=chart_spec,
    )


@app.post("/api/v1/tools/variance_decomposition", response_model=AnalysisResponse)
def api_variance_decomposition(req: VarianceDecompositionRequest):
    res = run_variance_decomposition(
        req.session_id,
        req.dataset_name,
        req.metric,
        req.dimensions,
        req.filters,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"{res['method']} of {req.metric}: n={res['n']}, ss_total={res['ss_total']}.",
        statistics=res,
    )


@app.post("/api/v1/tools/spss_test", response_model=AnalysisResponse)
def api_spss_test(req: HypothesisTestRequest):
    res = run_spss_hypothesis_test(
        session_id=req.session_id,
        dataset_name=req.dataset_name,
        test_type=req.test_type,
        dependent_var=req.dependent_var,
        group_var=req.group_var,
        alpha=req.alpha,
    )
    summary = NarrativeBuilder.generate_spss_narrative(res)
    return AnalysisResponse(
        status="success", session_id=req.session_id, summary_text=summary, statistics=res
    )


@app.post("/api/v1/tools/spss_regression", response_model=AnalysisResponse)
def api_spss_regression(req: RegressionRequest):
    res = run_spss_regression(
        session_id=req.session_id,
        dataset_name=req.dataset_name,
        dependent_var=req.dependent_var,
        independent_vars=req.independent_vars,
        model_type=req.model_type,
    )
    summary = NarrativeBuilder.generate_regression_narrative(res)
    return AnalysisResponse(
        status="success", session_id=req.session_id, summary_text=summary, statistics=res
    )


@app.post("/api/v1/tools/olap", response_model=AnalysisResponse)
def api_olap(req: OLAPRequest):
    res = run_olap_query(
        session_id=req.session_id,
        dataset_name=req.dataset_name,
        dimensions=req.dimensions,
        metrics=req.metrics,
        agg_funcs=req.agg_funcs,
        filters=req.filters,
        rollup=req.rollup,
        cube=req.cube,
        order_by=req.order_by,
        limit=req.limit,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"Aggregated {res['total_records']} multi-dimensional rows.",
        data_preview=res["records"],
        metadata={"columns": res["schema"]},
    )


@app.post("/api/v1/tools/sql", response_model=AnalysisResponse)
def api_sql(req: SQLSandboxRequest):
    res = run_duckdb_sql(req.session_id, req.sql_query, req.limit)
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"SQL executed successfully returning {res['row_count']} rows.",
        data_preview=res["data"],
        metadata={"columns": res["columns"]},
    )


# ----------------- Analysis operators (correlation / pivot / mining) -----------------


@app.post("/api/v1/tools/correlation", response_model=AnalysisResponse)
def api_correlation(req: CorrelationRequest):
    res = run_correlation_analysis(req.session_id, req.dataset_name, req.columns, req.method)
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"{req.method} correlation over {len(res['columns'])} columns; {len(res['high_correlation_pairs'])} strong pairs.",
        statistics=res,
    )


@app.post("/api/v1/tools/pivot", response_model=AnalysisResponse)
def api_pivot(req: PivotRequest):
    res = run_pivot_table(
        req.session_id,
        req.dataset_name,
        req.rows,
        req.columns,
        req.values,
        req.agg_func,
        req.filters,
        req.limit,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text="Pivot table computed.",
        data_preview=res.get("records"),
        statistics=res,
    )


@app.post("/api/v1/tools/clustering", response_model=AnalysisResponse)
def api_clustering(req: ClusteringRequest):
    res = run_kmeans_clustering(
        req.session_id, req.dataset_name, req.feature_cols, req.n_clusters, req.auto_k_range
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"KMeans clustering into {res.get('optimal_k', res.get('n_clusters', '?'))} clusters.",
        statistics=res,
    )


class RFMRequest(BaseModel):
    session_id: str
    dataset_name: str
    user_col: str
    date_col: str
    amount_col: str


@app.post("/api/v1/tools/rfm", response_model=AnalysisResponse)
def api_rfm(req: RFMRequest):
    res = run_rfm_segmentation(
        req.session_id, req.dataset_name, req.user_col, req.date_col, req.amount_col
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text="RFM segmentation computed.",
        statistics=res,
    )


@app.post("/api/v1/tools/timeseries", response_model=AnalysisResponse)
def api_timeseries(req: TimeSeriesRequest):
    res = run_timeseries_forecast(
        req.session_id, req.dataset_name, req.time_col, req.value_col, req.horizon, req.model_type
    )
    chart_spec = ChartSpecBuilder.build_time_series_forecast_chart(
        res.get("historical_preview") or [],
        res.get("forecasts") or [],
        req.time_col,
        req.value_col,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"{req.model_type} forecast for {req.horizon} periods.",
        statistics=res,
        chart_spec=chart_spec,
    )


# ----------------- Insight Copilot: automated insight discovery -----------------


class InsightDiscoverRequest(BaseModel):
    session_id: str
    dataset_name: str
    intent: str | None = None
    target_metric: str | None = None
    category_col: str | None = None
    time_col: str | None = None
    max_insights: int = 8


@app.post("/api/v1/insights/discover")
def api_discover_insights(req: InsightDiscoverRequest):
    """Orchestrate Analysis Actions into structured insights + an Insight Graph + a data story."""
    return discover_insights(
        req.session_id,
        req.dataset_name,
        intent=req.intent,
        target_metric=req.target_metric,
        category_col=req.category_col,
        time_col=req.time_col,
        max_insights=req.max_insights,
    )


# ----------------- Built-in runnable examples (industry demos) -----------------


@app.get("/api/v1/examples")
def api_list_examples():
    """List built-in end-to-end analysis examples runnable from the dashboard."""
    return {"examples": builtin_examples.list_examples()}


class RunExampleRequest(BaseModel):
    session_id: str | None = None


@app.post("/api/v1/examples/{example_id}/run")
def api_run_example(example_id: str, req: RunExampleRequest = RunExampleRequest()):
    """Generate the example dataset into a session, run the full pipeline, and
    return a structured result (incl. a Markdown report). The data lands in the
    given session so the user can keep exploring it in the other stages."""
    try:
        return builtin_examples.run_example(example_id, session_id=req.session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ----------------- Trace / Web Analytics (on a session-resident table) -----------------
# These run on an imported trace dataset inside an analytical session, the same
# engine the DB-connector path uses. The DB path and the trace path thus share
# one analysis core rather than each maintaining a separate silo.


class FunnelRequest(BaseModel):
    session_id: str
    dataset_name: str
    steps: list[str]
    date_from: str | None = None
    date_to: str | None = None


@app.post("/api/v1/analytics/funnel")
def api_funnel(req: FunnelRequest):
    return calculate_funnel(req.session_id, req.dataset_name, req.steps, req.date_from, req.date_to)


@app.get("/api/v1/analytics/flow")
def api_flow(session_id: str, dataset_name: str, limit: int = 15):
    return calculate_user_flow(session_id, dataset_name, limit_paths=limit)


@app.get("/api/v1/analytics/retention")
def api_retention(session_id: str, dataset_name: str, days: int = 7):
    return calculate_retention(session_id, dataset_name, days=days)


@app.get("/api/v1/analytics/pages")
def api_pages(session_id: str, dataset_name: str, limit: int = 20):
    return calculate_page_metrics(session_id, dataset_name, limit=limit)


@app.get("/api/v1/analytics/trace/{trace_id}")
def api_trace_waterfall(trace_id: str, session_id: str, dataset_name: str):
    return get_trace_waterfall(session_id, dataset_name, trace_id)


@app.get("/api/v1/analytics/replay/{telemetry_session_id}")
def api_session_replay(telemetry_session_id: str, session_id: str, dataset_name: str):
    return get_session_action_replay(session_id, dataset_name, telemetry_session_id)


@app.get("/api/v1/analytics/sessions")
def api_list_analytics_sessions(session_id: str, dataset_name: str, limit: int = 20):
    return {"sessions": list_recent_sessions(session_id, dataset_name, limit=limit)}


# ----------------- Modern Data Stack: Catalog & Lineage -----------------


@app.get("/api/v1/catalog/tables")
def api_list_catalog_tables(
    tag: str | None = None, keyword: str | None = None, session_id: str = "_global"
):
    cat = get_meta_registry(session_id)
    return {"tables": cat.list_tables(tag=tag, keyword=keyword)}


@app.post("/api/v1/catalog/tables")
def api_register_catalog_table(asset: TableAsset, session_id: str = "_global"):
    cat = get_meta_registry(session_id)
    return cat.register_table(asset)


@app.get("/api/v1/catalog/lineage")
def api_get_lineage(session_id: str = "_global"):
    lineage = get_lineage_tracker(session_id)
    return lineage.get_lineage_graph()


@app.get("/api/v1/catalog/metrics")
def api_list_semantic_metrics(session_id: str = "_global"):
    store = get_semantic_store(session_id)
    return {"metrics": store.list_metrics()}


@app.post("/api/v1/catalog/metrics")
def api_register_semantic_metric(metric: MetricDefinition, session_id: str = "_global"):
    store = get_semantic_store(session_id)
    return store.register_metric(metric)


class SemanticQueryRequest(BaseModel):
    session_id: str
    metric_names: list[str]
    dimensions: list[str] | None = None
    filters: str | None = None
    order_by: str | None = None
    limit: int = 100
    endorsed_only: bool | None = None


@app.post("/api/v1/catalog/metrics/query")
def api_query_semantic_metrics(req: SemanticQueryRequest):
    store = get_semantic_store(req.session_id)
    enforce_endorsed = bool(getattr(req, "endorsed_only", None))
    try:
        if hasattr(store, "compile_governed"):
            sql = store.compile_governed(
                req.metric_names, req.dimensions, req.filters, req.order_by, req.limit
            )
        else:
            sql = store.compile_query(
                req.metric_names, req.dimensions, req.filters, req.order_by, req.limit
            )
        res = run_duckdb_sql(
            req.session_id,
            sql,
            limit=req.limit,
            governed=True,
            endorsed_only=enforce_endorsed or None,
        )
    except (ValueError, PermissionError) as exc:
        raise _client_error(exc) from exc
    out = {
        "compiled_sql": sql,
        "data": res["data"],
        "columns": res["columns"],
        "governed": True,
    }
    if res.get("endorsement_warnings"):
        out["endorsement_warnings"] = res["endorsement_warnings"]
    return out


# ----------------- Modern Data Stack: Transform & ELT DAG -----------------


class CleanTableRequest(BaseModel):
    session_id: str
    source_table: str
    target_table: str
    dedup_keys: list[str] | None = None
    fillna_rules: dict[str, Any] | None = None
    outlier_clip_cols: dict[str, dict[str, float]] | None = None


@app.post("/api/v1/transform/clean")
def api_clean_table(req: CleanTableRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    res = DataCleaner.clean_table(
        con,
        req.source_table,
        req.target_table,
        req.dedup_keys,
        req.fillna_rules,
        req.outlier_clip_cols,
    )
    return res


@app.post("/api/v1/transform/dag/models")
def api_register_dag_model(model: DAGModel, session_id: str = "_global"):
    pipe = get_pipeline_engine(session_id)
    return pipe.register_model(model)


@app.get("/api/v1/transform/dag/models")
def api_list_dag_models(session_id: str = "_global"):
    pipe = get_pipeline_engine(session_id)
    return {
        "models": pipe.list_models(),
        "execution_order": pipe.get_execution_order() if pipe.list_models() else [],
    }


@app.post("/api/v1/transform/dag/run")
def api_run_dag_pipeline(session_id: str):
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    pipe = get_pipeline_engine(session_id)
    return pipe.run_pipeline(con)


# ----------------- Modern Data Stack: Reverse ETL & Activation -----------------


class ReverseSyncRequest(BaseModel):
    session_id: str
    source_table: str
    dest_conn_str: str
    dest_table_name: str
    mode: str = "replace"


@app.post("/api/v1/retl/sync")
def api_reverse_sync(req: ReverseSyncRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    return DestinationSync.sync_table_to_destination(
        con, req.source_table, req.dest_conn_str, req.dest_table_name, req.mode
    )


class AudienceExportRequest(BaseModel):
    session_id: str
    source_table: str
    filter_sql: str | None = None
    export_columns: list[str] | None = None
    format_type: str = "json"
    limit: int = 1000


@app.post("/api/v1/retl/audience")
def api_export_audience(req: AudienceExportRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    return AudienceExporter.export_cohort(
        con, req.source_table, req.filter_sql, req.export_columns, req.format_type, req.limit
    )


class WebhookAlertRequest(BaseModel):
    webhook_url: str
    title: str
    message: str
    platform: str = "generic"
    extra_metrics: dict[str, Any] | None = None


@app.post("/api/v1/retl/alert")
def api_send_webhook_alert(req: WebhookAlertRequest):
    result = WebhookPusher.send_alert(
        req.webhook_url, req.title, req.message, req.platform, req.extra_metrics
    )
    # An undelivered alert must not look like a delivered one to a caller that only
    # checks the HTTP status: refused target -> 403, delivery failure -> 502.
    if result.get("rejected"):
        raise HTTPException(status_code=403, detail=result.get("error"))
    if result.get("status") != "SUCCESS":
        return JSONResponse(status_code=502, content=result)
    return result


# ----------------- Modern Data Stack: Observability & Quality -----------------


class QualitySuiteRequest(BaseModel):
    session_id: str
    table: str
    rules: list[dict[str, Any]]


@app.post("/api/v1/observability/assert")
def api_run_quality_assertions(req: QualitySuiteRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    return DataQualityAssertions.run_suite(con, req.table, req.rules)


class SchemaDriftRequest(BaseModel):
    session_id: str
    table: str
    baseline_schema: dict[str, str]


@app.post("/api/v1/observability/drift")
def api_detect_schema_drift(req: SchemaDriftRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    return SchemaDrifter.detect_drift(con, req.table, req.baseline_schema)


# ----------------- Palantir-Style Agentic Ontology Endpoints -----------------


@app.get("/api/v1/ontology/schema")
def api_get_ontology_schema():
    engine = get_ontology_engine()
    return engine.get_ontology_schema_summary()


@app.get("/api/v1/ontology/objects")
def api_list_ontology_objects():
    engine = get_ontology_engine()
    return {"object_types": engine.list_object_types()}


@app.post("/api/v1/ontology/objects")
def api_register_ontology_object(obj: ObjectType):
    engine = get_ontology_engine()
    return engine.register_object_type(obj)


@app.get("/api/v1/ontology/links")
def api_list_ontology_links():
    engine = get_ontology_engine()
    return {"link_types": engine.list_link_types()}


@app.post("/api/v1/ontology/links")
def api_register_ontology_link(link: LinkType):
    engine = get_ontology_engine()
    return engine.register_link_type(link)


@app.get("/api/v1/ontology/actions")
def api_list_ontology_actions(target_object_type: str | None = None):
    engine = get_ontology_engine()
    return {"action_types": engine.list_action_types(target_object_type=target_object_type)}


@app.post("/api/v1/ontology/actions")
def api_register_ontology_action(action: ActionType):
    engine = get_ontology_engine()
    return engine.register_action_type(action)


class OntologyQueryRequest(BaseModel):
    session_id: str
    object_type: str
    filters: str | None = None
    properties: list[str] | None = None
    limit: int = 50


@app.post("/api/v1/ontology/instances/query")
def api_query_ontology_instances(req: OntologyQueryRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    return engine.query_object_instances(
        con, req.object_type, req.filters, req.properties, req.limit
    )


class OntologyTraverseRequest(BaseModel):
    session_id: str
    source_object_type: str
    source_instance_id: Any
    link_name: str
    limit: int = 50


@app.post("/api/v1/ontology/instances/traverse")
def api_traverse_ontology_links(req: OntologyTraverseRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    return engine.traverse_links(
        con, req.source_object_type, req.source_instance_id, req.link_name, req.limit
    )


class OntologyActionExecRequest(BaseModel):
    session_id: str
    action_name: str
    instance_id: Any
    parameters: dict[str, Any]
    dry_run: bool = False


@app.post("/api/v1/ontology/actions/execute")
def api_execute_ontology_action(req: OntologyActionExecRequest):
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    con = sess.get_duckdb_conn()
    engine = get_ontology_engine()
    return engine.execute_action(con, req.action_name, req.instance_id, req.parameters, req.dry_run)


@app.get("/api/v1/ontology/audit")
def api_list_ontology_audits(limit: int = 50):
    engine = get_ontology_engine()
    return {"audits": engine.list_action_audits(limit=limit)}


# ----------------- Excel & CSV High-Performance Ingestion Endpoints -----------------


@app.post("/api/v1/import/file")
async def api_import_file(
    file: UploadFile | None = File(None),
    file_path: str | None = Form(None),
    dataset_name: str = Form("uploaded_dataset"),
    session_id: str | None = Form(None),
    sheet_name: str | None = Form(None),
    limit: int | None = Form(None),
):
    mgr = SessionManager()
    sess = mgr.get_or_create_session(session_id)

    target_path = None
    display_name = None
    if file:
        # The multipart filename is caller-controlled: never use it as a path.
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        display_name = os.path.basename((file.filename or "upload").replace("\\", "/"))
        target_path = os.path.join(settings.UPLOAD_DIR, safe_upload_name(file.filename or ""))
        with open(target_path, "wb") as f_out:
            while chunk := await file.read(1024 * 1024 * 5):  # 5MB stream chunks
                f_out.write(chunk)
    elif file_path:
        # A server-side path over HTTP is a file-read primitive unless it is confined.
        try:
            target_path = resolve_inside(file_path, settings.import_allowed_dir_list, "file import")
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc))
        display_name = os.path.basename(target_path)

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="Invalid file or file_path provided")

    conn_str = f"file://{target_path}"
    connector = ConnectorFactory.get_connector(conn_str)
    try:
        arrow_table = connector.fetch_to_arrow(query_or_table=sheet_name or "Sheet1", limit=limit)
    except ValueError as exc:
        # Unsupported format (.xls), unknown worksheet, unreadable workbook.
        raise HTTPException(status_code=400, detail=str(exc))
    rejected_rows = int(getattr(connector, "rejected_rows", 0) or 0)

    meta = sess.register_dataset(dataset_name, arrow_table, {"source_file": display_name})

    # Register into Catalog
    cat = get_meta_registry(sess.session_id)
    cols = [ColumnMeta(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        TableAsset(
            dataset_name=dataset_name,
            display_name=dataset_name,
            description=f"Imported from {display_name}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["file_import", "raw"],
        )
    )

    return {
        "status": "success",
        "session_id": sess.session_id,
        "dataset_name": dataset_name,
        "row_count": meta.row_count,
        "column_count": meta.column_count,
        "columns": meta.column_names,
        "column_types": {f.name: str(f.type) for f in meta.table.schema},
        "memory_bytes": meta.memory_bytes,
        # Malformed CSV lines that were skipped. Non-zero means row_count is short of the file.
        "rejected_rows": rejected_rows,
        "summary": f"Successfully loaded {display_name} ({meta.row_count:,} rows, {meta.column_count} cols) into dataset '{dataset_name}'."
        + (f" WARNING: {rejected_rows:,} malformed row(s) were skipped." if rejected_rows else ""),
    }


# ----------------- Trace Ingestion (Path B): import traces as a data source -----------------


class TraceImportRequest(BaseModel):
    source: str | None = None
    records: list[dict[str, Any]] | None = None
    dataset_name: str = "traces"
    session_id: str | None = None
    format: str | None = None


@app.post("/api/v1/import/traces")
def api_import_traces(req: TraceImportRequest):
    """Ingest OTLP/JSON/NDJSON/CSV/Parquet trace data into an analytical session.

    Traces become an ordinary session table, so the whole MDS pipeline
    (clean/model/EDA/OLAP/SPSS/funnel/waterfall/quality/reverse-ETL) applies —
    the same engine used by the DB-connector path.
    """
    mgr = SessionManager()
    sess = mgr.get_or_create_session(req.session_id)
    try:
        arrow_table = TraceImporter.load_source(
            source=req.source, records=req.records, fmt=req.format
        )
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    meta = sess.register_dataset(
        req.dataset_name, arrow_table, {"source": req.source or "inline", "kind": "trace"}
    )

    cat = get_meta_registry(sess.session_id)
    cols = [ColumnMeta(name=c, data_type="UNKNOWN") for c in meta.column_names]
    cat.register_table(
        TableAsset(
            dataset_name=req.dataset_name,
            display_name=req.dataset_name,
            description=f"Trace data imported from {req.source or 'inline records'}",
            row_count=meta.row_count,
            column_count=meta.column_count,
            columns=cols,
            tags=["trace", "imported"],
        )
    )

    return {
        "status": "success",
        "session_id": sess.session_id,
        "dataset_name": req.dataset_name,
        "row_count": meta.row_count,
        "column_count": meta.column_count,
        "columns": meta.column_names,
        "summary": f"Imported {meta.row_count:,} trace spans/events into session '{sess.session_id}' (table '{req.dataset_name}'). Ready for the full MDS pipeline.",
    }


# ===== Ported from data-agent (A): reports, analytical tools, Hex context =====

from data_analysis.operators.business_report import discover_report, generate_business_report
from data_analysis.schemas.requests import BusinessReportRequest, ReportDiscoverRequest
from data_analysis.schemas.responses import BusinessReportResponse


@app.post("/api/v1/reports/discover")
def api_report_discover(req: ReportDiscoverRequest):
    try:
        return discover_report(req.session_id, req.dataset_name, req.grain)
    except ValueError as exc:
        raise _client_error(exc) from exc


@app.post("/api/v1/reports/generate", response_model=BusinessReportResponse)
def api_report_generate(req: BusinessReportRequest):
    try:
        return generate_business_report(req)
    except ValueError as exc:
        raise _client_error(exc) from exc


@app.get("/api/v1/reports/datasets")
def api_report_datasets(session_id: str):
    from data_analysis.operators.sandbox import run_duckdb_sql

    try:
        rows = run_duckdb_sql(
            session_id,
            "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name",
            500,
        )["data"]
        return {"datasets": [r["table_name"] for r in rows]}
    except ValueError as exc:
        raise _client_error(exc) from exc


# Independent tools for external Agent composition; no orchestration loop here.
from data_analysis.operators.analytical_tools import (
    analyze_sensitivity,
    compare_metric,
    decompose_change,
)
from data_analysis.schemas.requests import (
    DecompositionRequest,
    MetricCompareRequest,
    SensitivityRequest,
)
from data_analysis.schemas.responses import AnalyticalToolResponse


@app.post("/api/v1/tools/compare_metric", response_model=AnalyticalToolResponse)
def api_compare_metric(req: MetricCompareRequest):
    try:
        return compare_metric(req)
    except ValueError as exc:
        raise _client_error(exc) from exc


@app.post("/api/v1/tools/decompose_change", response_model=AnalyticalToolResponse)
def api_decompose_change(req: DecompositionRequest):
    try:
        return decompose_change(req)
    except ValueError as exc:
        raise _client_error(exc) from exc


@app.post("/api/v1/tools/analyze_sensitivity", response_model=AnalyticalToolResponse)
def api_analyze_sensitivity(req: SensitivityRequest):
    try:
        return analyze_sensitivity(req)
    except ValueError as exc:
        raise _client_error(exc) from exc


# ----------------- Hex-Style Context Studio, dbt YAML, Trail Playbooks & Health -----------------
from data_analysis.catalog.context_studio import ContextGuide, get_context_studio
from data_analysis.copilot.analysis_trail import AnalysisTrailLedger, get_trail_ledger
from data_analysis.observability.context_health import ContextHealthAuditor
from data_analysis.schemas.requests import (
    ContextGuideRequest,
    ContextResolveRequest,
    DbtSemanticYamlImportRequest,
    EndorseAssetRequest,
    ExportPlaybookRequest,
    ReplayPlaybookRequest,
    WorkspaceRuleRequest,
)
from data_analysis.schemas.responses import (
    ContextHealthResponse,
    ContextHierarchyResponse,
    PlaybookReplayResponse,
)


@app.post("/api/v1/context/rules")
def api_set_workspace_rules(req: WorkspaceRuleRequest):
    studio = get_context_studio(req.session_id)
    rule = studio.set_workspace_rules(
        system_rules=req.system_rules,
        endorsed_only_default=req.endorsed_only_default,
        naming_conventions=req.naming_conventions,
    )
    return {"status": "success", "rule": rule.model_dump()}


@app.get("/api/v1/context/rules")
def api_get_workspace_rules(session_id: str = "_global"):
    studio = get_context_studio(session_id)
    return {"status": "success", "rule": studio.get_workspace_rules().model_dump()}


@app.post("/api/v1/context/guides")
def api_register_context_guide(req: ContextGuideRequest):
    studio = get_context_studio(req.session_id)
    guide = ContextGuide(
        name=req.name,
        title=req.title,
        content=req.content,
        scope=req.scope,
        target_names=req.target_names,
        tags=req.tags,
        endorsement_status=req.endorsement_status,
    )
    saved = studio.register_guide(guide)
    return {"status": "success", "guide": saved.model_dump()}


@app.get("/api/v1/context/guides")
def api_list_context_guides(
    session_id: str = "_global",
    scope: str | None = None,
    target_name: str | None = None,
    endorsed_only: bool = False,
):
    studio = get_context_studio(session_id)
    guides = [
        g.model_dump()
        for g in studio.list_guides(
            scope=scope, target_name=target_name, endorsed_only=endorsed_only
        )
    ]
    return {"status": "success", "guides": guides}


@app.post("/api/v1/context/endorse")
def api_endorse_asset(req: EndorseAssetRequest):
    studio = get_context_studio(req.session_id)
    try:
        res = studio.endorse_asset(
            asset_type=req.asset_type,
            name=req.name,
            status=req.status,
            endorsement_note=req.endorsement_note,
            endorsed_by=req.endorsed_by,
        )
    except ValueError as exc:
        raise _client_error(exc) from exc
    return {"status": "success", **res}


@app.post("/api/v1/context/resolve", response_model=ContextHierarchyResponse)
def api_resolve_context(req: ContextResolveRequest):
    studio = get_context_studio(req.session_id)
    res = studio.resolve_hierarchy(
        dataset_name=req.dataset_name,
        metric_names=req.metric_names,
        endorsed_only=req.endorsed_only,
    )
    return ContextHierarchyResponse(**res)


@app.post("/api/v1/catalog/semantic/import_yaml")
def api_import_dbt_semantic_yaml(req: DbtSemanticYamlImportRequest):
    store = get_semantic_store(req.session_id)
    try:
        res = store.import_dbt_semantic_yaml(
            yaml_content=req.yaml_content,
            default_endorsement_status=req.default_endorsement_status,
        )
    except ValueError as exc:
        raise _client_error(exc) from exc
    return {"status": "success", **res}


@app.get("/api/v1/catalog/semantic/export_yaml")
def api_export_dbt_semantic_yaml(session_id: str = "_global"):
    store = get_semantic_store(session_id)
    yaml_str = store.export_dbt_semantic_yaml()
    return {"status": "success", "session_id": session_id, "yaml_content": yaml_str}


@app.get("/api/v1/trail/steps")
def api_list_trail_steps(session_id: str, limit: int = 100):
    ledger = get_trail_ledger(session_id)
    steps = [s.model_dump() for s in ledger.list_steps(limit=limit)]
    return {"status": "success", "session_id": session_id, "step_count": len(steps), "steps": steps}


@app.post("/api/v1/trail/playbooks/export")
def api_export_playbook(req: ExportPlaybookRequest):
    ledger = get_trail_ledger(req.session_id)
    try:
        pb = ledger.export_playbook(
            title=req.title,
            description=req.description,
            step_ids=req.step_ids,
            parameters=req.parameters,
            playbook_id=req.playbook_id,
            endorsement_status=req.endorsement_status,
        )
    except ValueError as exc:
        raise _client_error(exc) from exc
    return {"status": "success", "playbook": pb.model_dump()}


@app.get("/api/v1/trail/playbooks")
def api_list_playbooks(session_id: str | None = None):
    pbs = [p.model_dump() for p in AnalysisTrailLedger.list_playbooks(session_id=session_id)]
    return {"status": "success", "playbooks": pbs}


@app.post("/api/v1/trail/playbooks/replay", response_model=PlaybookReplayResponse)
def api_replay_playbook(req: ReplayPlaybookRequest):
    try:
        res = AnalysisTrailLedger.replay_playbook(
            playbook_id=req.playbook_id,
            target_session_id=req.target_session_id,
            parameter_overrides=req.parameter_overrides,
        )
    except ValueError as exc:
        raise _client_error(exc) from exc
    return PlaybookReplayResponse(**res)


@app.get("/api/v1/observability/context_health", response_model=ContextHealthResponse)
def api_audit_context_health(session_id: str = "_global"):
    res = ContextHealthAuditor.audit_session_health(session_id)
    return ContextHealthResponse(**res)


# ---- Ported insight atom routes (A) ----
@app.post("/api/v1/insights/outliers", response_model=AnalysisResponse)
def api_outliers(req: OutliersRequest):
    res = detect_outliers(
        req.session_id,
        req.dataset_name,
        req.metric,
        dimension_cols=req.dimension_cols,
        method=req.method,
        threshold=req.threshold,
        top_k=req.top_k,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"Outlier detection on {req.metric} via {res.get('method', req.method)}.",
        statistics=res,
        data_preview=res.get("outliers") or res.get("outliers_preview") or res.get("preview"),
    )


@app.post("/api/v1/insights/trends", response_model=AnalysisResponse)
def api_trends(req: TrendsRequest):
    res = detect_trends(
        req.session_id,
        req.dataset_name,
        req.time_col,
        req.metric,
        group_col=req.group_col,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"{res.get('trend_direction', 'trend')} on {req.metric}.",
        statistics=res,
        data_preview=res.get("series_preview"),
    )


@app.post("/api/v1/insights/dominance", response_model=AnalysisResponse)
def api_dominance(req: DominanceRequest):
    res = detect_dominance(
        req.session_id,
        req.dataset_name,
        req.category_col,
        req.metric,
        top_k=req.top_k,
    )
    return AnalysisResponse(
        status="success",
        session_id=req.session_id,
        summary_text=f"Gini {res.get('gini_coefficient')} across {res.get('total_categories')} categories of {req.metric}.",
        statistics=res,
        data_preview=res.get("top_contributors"),
    )


@app.post("/api/v1/transform/wide")
def api_create_wide_table(req: WideTableRequest):
    # WideTableRequest may be inline or schema-imported; define fallback import.
    mgr = SessionManager()
    sess = mgr.get_session(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        return Materializer.create_wide_table(
            sess.get_duckdb_conn(),
            req.target_name,
            req.fact_table,
            req.dimension_joins,
        )
    except (ValueError, FileNotFoundError) as exc:
        raise _client_error(exc) from exc
