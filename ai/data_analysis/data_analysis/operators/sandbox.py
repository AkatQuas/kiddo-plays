import re
from typing import Any

import duckdb
import pyarrow as pa

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.engine.arrow_utils import ArrowUtils
from data_analysis.engine.sql_guard import (
    assert_no_external_access,
    has_top_level_limit,
    normalize_date_substrings,
)

# DuckDB StatementType names that only read. WITH/DESCRIBE/SHOW/PRAGMA-introspection all
# parse as SELECT. PIVOT/UNPIVOT parse as CREATE, so they stay out; use run_pivot_table.
_READ_ONLY_STATEMENTS = {"SELECT", "EXPLAIN"}


def _assert_read_only(clean_sql: str) -> str:
    """Require exactly one statement, and that it is a read.

    Returns the DuckDB statement type name. Raises PermissionError for anything else.
    """
    extract = getattr(duckdb, "extract_statements", None)
    if extract is None:
        raise PermissionError(
            "DuckDB statement extraction unavailable; cannot verify read-only SQL"
        )
    try:
        statements = extract(clean_sql)
    except Exception as exc:
        raise ValueError(f"Invalid SQL: {exc}") from exc

    if len(statements) != 1:
        raise PermissionError(
            f"Only a single statement is allowed in the read-only sandbox, got {len(statements)}"
        )

    stmt_type = getattr(statements[0].type, "name", str(statements[0].type))
    if stmt_type not in _READ_ONLY_STATEMENTS:
        raise PermissionError(
            f"Statement type '{stmt_type}' is forbidden in analytical read-only sandbox"
        )
    return stmt_type


def _extract_referenced_tables(clean_sql: str, known_tables: list[str]) -> list:
    found = []
    for t in known_tables:
        pat = re.compile(r'(?:"' + re.escape(t) + r'"|\b' + re.escape(t) + r"\b)", re.IGNORECASE)
        if pat.search(clean_sql):
            found.append(t)
    return found


def run_duckdb_sql(
    session_id: str,
    sql_query: str,
    limit: int = 100,
    *,
    bridge_date_substrings: bool = False,
    governed: bool = False,
    endorsed_only: bool | None = None,
    record_trail: bool = True,
) -> dict[str, Any]:
    """Execute ad-hoc DuckDB SQL within session memory sandbox safely.

    B security: assert_no_external_access + single read-only statement + row cap.
    A features: governed/endorsed_only guardrails, trail recording, ungoverned_sql flag.
    """
    mgr = SessionManager()
    sess = mgr.require_session(session_id)

    clean_sql = sql_query.strip().rstrip(";")
    stmt_type = _assert_read_only(clean_sql)

    con = sess.get_duckdb_conn()
    known_tables = {
        row[0] for row in con.execute("SELECT table_name FROM information_schema.tables").fetchall()
    }
    known_tables.update(sess.datasets.keys())
    tree = assert_no_external_access(clean_sql, known_tables)
    normalized_sql = None
    if bridge_date_substrings and stmt_type == "SELECT":
        meta = sess.get_dataset_meta("source")
        if meta is None:
            raise ValueError("Bridge source schema is missing")
        schema = meta.table.schema
        # Case-fold collisions are ambiguous in SQL; leave DuckDB to reject them.
        if len({n.lower() for n in schema.names}) == len(schema.names):
            dates = {f.name for f in schema if pa.types.is_date(f.type)}
            normalized_sql = normalize_date_substrings(tree, "source", dates, con)
        if normalized_sql:
            clean_sql = normalized_sql
            _assert_read_only(clean_sql)
            tree = assert_no_external_access(clean_sql, known_tables)

    # Context Studio endorsement guardrails on referenced session tables
    from data_analysis.catalog.context_studio import get_context_studio
    from data_analysis.catalog.meta_registry import get_meta_registry

    studio = get_context_studio(session_id)
    cat = get_meta_registry(session_id)
    enforce_endorsed = (
        studio.get_workspace_rules().endorsed_only_default
        if endorsed_only is None
        else bool(endorsed_only)
    )
    ref_tables = _extract_referenced_tables(clean_sql, list(sess.datasets.keys()))
    endorsement_warnings = []
    for tbl_name in ref_tables:
        asset = cat.get_table(tbl_name)
        status = (asset.endorsement_status if asset else "draft").lower()
        note = (asset.endorsement_note if asset else "") or ""
        if status == "deprecated":
            msg = f"Table '{tbl_name}' is DEPRECATED" + (f": {note}" if note else "")
            if enforce_endorsed:
                raise PermissionError(
                    f"Endorsed mode blocked query on deprecated table '{tbl_name}'"
                )
            endorsement_warnings.append(msg)
        elif status != "endorsed":
            msg = f"Table '{tbl_name}' has status '{status}' (not endorsed)" + (
                f": {note}" if note else ""
            )
            if enforce_endorsed:
                raise PermissionError(
                    f"Endorsed mode requires 'endorsed' tables; table '{tbl_name}' has status '{status}'"
                )
            endorsement_warnings.append(msg)

    # The caller's limit is a request, MAX_RESULT_ROWS is the ceiling.
    row_cap = settings.MAX_RESULT_ROWS
    limit = min(int(limit), row_cap) if limit and int(limit) > 0 else row_cap

    # DESCRIBE/SHOW/SUMMARIZE report as SELECT but reject a trailing LIMIT.
    limitable = clean_sql.lstrip("( \t\n").upper().startswith(("SELECT", "WITH", "FROM", "TABLE"))
    if stmt_type == "SELECT" and limitable:
        if has_top_level_limit(tree):
            # Keep the caller's own LIMIT / ORDER BY intact and cap what comes out.
            clean_sql = f"SELECT * FROM ({clean_sql}) AS _limited LIMIT {limit}"
        else:
            clean_sql += f" LIMIT {limit}"

    # ponytail: must run on the session connection itself -- con.register() is
    # connection-local, so a child cursor cannot see the registered Arrow views.
    # DuckDB has no per-cursor read-only mode either (access_mode is fixed at open
    # time; enable_external_access is global and would break RETL COPY exports), so
    # the statement-type check plus assert_no_external_access() on the parse tree
    # are the enforcement point.
    try:
        arrow_res = con.execute(clean_sql).arrow()
    except duckdb.Error as exc:
        # The caller wrote this SQL, so DuckDB's message is about their own query and is
        # exactly what they (usually an LLM) need to fix it.
        raise ValueError(f"SQL error: {exc}") from exc

    if isinstance(arrow_res, pa.RecordBatchReader):
        arrow_res = arrow_res.read_all()
    out: dict[str, Any] = {
        "columns": arrow_res.column_names,
        "row_count": len(arrow_res),
        "data": ArrowUtils.table_to_compact_preview(arrow_res, limit=limit),
        "ungoverned_sql": not governed,
        **({"normalizedSql": normalized_sql} if normalized_sql else {}),
    }
    if endorsement_warnings:
        out["endorsement_warnings"] = endorsement_warnings
    if record_trail:
        try:
            from data_analysis.copilot.analysis_trail import get_trail_ledger

            get_trail_ledger(session_id).record_step(
                operator="query_semantic_metric" if governed else "duckdb_sql_sandbox",
                dataset_name=ref_tables[0] if ref_tables else None,
                parameters={"sql_query": clean_sql, "limit": limit, "governed": governed},
                summary=f"Executed {'governed' if governed else 'ad-hoc'} SQL ({len(arrow_res)} rows)",
                sql=[clean_sql],
                warnings=endorsement_warnings,
                ungoverned_sql=not governed,
            )
        except Exception:
            pass
    return out
