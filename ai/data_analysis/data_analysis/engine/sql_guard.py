"""SQL identifier / predicate validation for LLM-supplied query fragments."""

import copy
import json
import re
import threading
from collections.abc import Iterable
from typing import Any

import duckdb

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

_FORBIDDEN_RE = re.compile(
    r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|ATTACH|COPY|CREATE|GRANT"
    r"|PRAGMA|CALL|EXPORT|INSTALL|LOAD)\b",
    re.IGNORECASE,
)


def safe_ident(name: str) -> str:
    """Validate a bare identifier and return it double-quoted."""
    if not isinstance(name, str) or not _IDENT_RE.match(name):
        raise ValueError(f"Invalid SQL identifier {name!r}: must match ^[A-Za-z_][A-Za-z0-9_]*$")
    return f'"{name}"'


def safe_table_ref(ref: str) -> str:
    """Validate an optionally schema-qualified table reference -> "schema"."table"."""
    if not isinstance(ref, str) or not ref:
        raise ValueError(f"Invalid table reference {ref!r}: must be a non-empty string")
    parts = ref.split(".")
    if len(parts) > 3:
        raise ValueError(
            f"Invalid table reference {ref!r}: at most catalog.schema.table is allowed"
        )
    return ".".join(safe_ident(p) for p in parts)


def safe_predicate(pred: str) -> str:
    """Validate a free-form WHERE fragment, blocking statement injection."""
    if not isinstance(pred, str) or not pred.strip():
        raise ValueError("Invalid SQL predicate: must be a non-empty string")
    if ";" in pred:
        raise ValueError(f"Invalid SQL predicate {pred!r}: statement terminator ';'")
    if "--" in pred or "/*" in pred or "*/" in pred:
        raise ValueError(f"Invalid SQL predicate {pred!r}: SQL comments are not allowed")
    match = _FORBIDDEN_RE.search(pred)
    if match:
        raise ValueError(f"Invalid SQL predicate {pred!r}: forbidden keyword '{match.group(0)}'")
    extract = getattr(duckdb, "extract_statements", None)
    if extract is not None:
        # ponytail: real parser beats the blacklist; regex above stays as the fallback
        try:
            statements = extract(f"SELECT 1 WHERE {pred}")
        except Exception as exc:
            raise ValueError(f"Invalid SQL predicate {pred!r}: {exc}") from exc
        if len(statements) != 1:
            raise ValueError(
                f"Invalid SQL predicate {pred!r}: expands to {len(statements)} statements"
            )
    return pred


def safe_columns(names: list[str]) -> str:
    """Validate each column name and return them comma-joined."""
    if not names:
        raise ValueError("Invalid column list: must contain at least one column")
    return ", ".join(safe_ident(n) for n in names)


# Table functions a read-only analytical query may call. Everything else that can
# appear in FROM -- read_csv*, read_parquet, read_json*, read_text, read_blob, glob,
# sniff_csv, sqlite_scan, postgres_scan, duckdb_secrets, pragma_* ... -- reaches the
# filesystem, the network or the engine's configuration and is refused.
_ALLOWED_TABLE_FUNCTIONS = frozenset(
    {"range", "generate_series", "unnest", "generate_subscripts", "repeat_row"}
)

# Scalar functions that leak the process environment (API keys live there).
_FORBIDDEN_SCALAR_FUNCTIONS = frozenset({"getenv"})

# `FROM 'data.csv'`, `FROM "/etc/passwd"`, `FROM 's3://b/k'`: DuckDB resolves an
# unknown table name that looks like a path through a replacement scan.
_PATHLIKE_RE = re.compile(
    r"[/\\:*?\[\]~]|\.(csv|tsv|txt|json|jsonl|ndjson|parquet|pq|xlsx|xls|db|sqlite|duckdb|gz|zst|log)$",
    re.IGNORECASE,
)

_EXPLAIN_PREFIX_RE = re.compile(r"^\s*EXPLAIN(\s+ANALYZE)?\s+", re.IGNORECASE)

_parser_lock = threading.Lock()
_parser_con: duckdb.DuckDBPyConnection | None = None


def _parse_select(sql: str) -> dict[str, Any]:
    """DuckDB's own parse tree for a SELECT, as JSON. Never executes the query."""
    global _parser_con
    with _parser_lock:
        if _parser_con is None:
            _parser_con = duckdb.connect(":memory:")
        raw = _parser_con.execute("SELECT json_serialize_sql(?)", [sql]).fetchone()[0]
    return json.loads(raw)


def _walk(node: Any) -> Iterable[dict[str, Any]]:
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk(value)


def assert_no_external_access(sql: str, known_tables: set[str] | None = None) -> dict[str, Any]:
    """Refuse a read query that reaches outside the session's own tables.

    "Only SELECT is allowed" is not a sandbox on its own: `SELECT * FROM
    read_csv_auto('/etc/passwd')`, `FROM '/app/.env'`, `SELECT getenv('DATA_ANALYSIS_API_KEYS')`
    are all plain SELECTs. The check runs on DuckDB's parse tree, so comments,
    quoting and nesting (CTEs, subqueries, joins) cannot hide a call.

    ``known_tables``: names that exist in the session. A name in this set is
    allowed even if it looks like a file (a dataset may be called "orders.csv").
    Returns the parse tree so callers can inspect it (e.g. for a top-level LIMIT).
    """
    body = _EXPLAIN_PREFIX_RE.sub("", sql, count=1)
    try:
        tree = _parse_select(body)
    except Exception as exc:
        raise ValueError(f"Invalid SQL: {exc}") from exc
    if tree.get("error"):
        raise PermissionError(
            f"SQL could not be verified as a read-only query: {tree.get('error_message', 'unsupported statement')}"
        )

    known = {t.lower() for t in (known_tables or set())}
    for node in _walk(tree):
        node_type = node.get("type")
        if node_type == "TABLE_FUNCTION":
            fn = node.get("function") or {}
            name = str(fn.get("function_name", "")).lower()
            if name not in _ALLOWED_TABLE_FUNCTIONS:
                raise PermissionError(
                    f"Table function '{name}' is not allowed: queries may only read datasets loaded into the session"
                )
        elif node_type == "BASE_TABLE":
            table = str(node.get("table_name", ""))
            if table.lower() not in known and _PATHLIKE_RE.search(table):
                raise PermissionError(
                    f"'{table}' is not a dataset in this session; reading files or URLs from SQL is not allowed"
                )
        if node.get("class") == "FUNCTION":
            name = str(node.get("function_name", "")).lower()
            if name in _FORBIDDEN_SCALAR_FUNCTIONS:
                raise PermissionError(f"Function '{name}' is not allowed")
    return tree


def has_top_level_limit(tree: dict[str, Any]) -> bool:
    """True when the outermost SELECT of a parse tree carries its own LIMIT."""
    for stmt in tree.get("statements") or []:
        node = stmt.get("node") or {}
        for modifier in node.get("modifiers") or []:
            if str(modifier.get("type", "")).startswith("LIMIT"):
                return True
    return False


def normalize_date_substrings(
    tree: dict[str, Any], table: str, date_columns: set[str], con: duckdb.DuckDBPyConnection
) -> str | None:
    """Cast DATE operands of substr/substring to ISO VARCHAR, on a verified AST.

    Only one SELECT over one known table, with no CTE, nested scope, join or
    column aliases. No names or business filters are guessed. Unknown/complex
    expressions remain untouched so their actual binder errors stay visible.
    The caller must validate the regenerated SQL before executing it.
    """
    nodes = list(_walk(tree))
    selects = [n for n in nodes if n.get("type") == "SELECT_NODE"]
    if len(selects) != 1 or selects[0].get("cte_map", {}).get("map"):
        return None
    base = selects[0].get("from_table") or {}
    if (
        base.get("type") != "BASE_TABLE"
        or base.get("table_name", "").lower() != table.lower()
        or base.get("schema_name")
        or base.get("catalog_name")
        or base.get("column_name_alias")
    ):
        return None
    qualifier = (base.get("alias") or table).lower()
    dates = {name.lower() for name in date_columns}
    changed = False
    for node in nodes:
        if (
            node.get("class") != "FUNCTION"
            or node.get("function_name", "").lower() not in {"substr", "substring"}
            # DuckDB parses SQL-standard SUBSTRING with schema="main".
            or node.get("schema") not in {"", "main"}
            or node.get("catalog")
        ):
            continue
        children = node.get("children") or []
        if not children or children[0].get("class") != "COLUMN_REF":
            continue
        column = children[0]
        names = column.get("column_names") or []
        if (
            len(names) not in {1, 2}
            or names[-1].lower() not in dates
            or (len(names) == 2 and names[0].lower() != qualifier)
        ):
            continue
        # Get the CAST representation from DuckDB itself; no second SQL parser.
        template = _parse_select("SELECT CAST(NULL AS VARCHAR)")["statements"][0]["node"][
            "select_list"
        ][0]
        cast = copy.deepcopy(template)
        cast["child"] = column
        children[0] = cast
        changed = True
    if not changed:
        return None
    return con.execute("SELECT json_deserialize_sql(?)", [json.dumps(tree)]).fetchone()[0]


def normalize_numeric_sums(
    tree: dict[str, Any], table: str, columns: dict[str, int], con: duckdb.DuckDBPyConnection
) -> str | None:
    """Explicit SUM of a raw text field, after a whole-column exactness check.

    Single SELECT over the verified source only. No TRY_CAST/zero fallback,
    rounding, locale guessing, expressions or silently skipped invalid rows.
    Uses DuckDB's AST and CAST template; no second SQL parser or regex SQL edits.
    """
    nodes = list(_walk(tree))
    selects = [n for n in nodes if n.get("type") == "SELECT_NODE"]
    if len(selects) != 1 or selects[0].get("cte_map", {}).get("map"):
        return None
    base = selects[0].get("from_table") or {}
    if (
        base.get("type") != "BASE_TABLE"
        or base.get("table_name", "").lower() != table.lower()
        or base.get("schema_name")
        or base.get("catalog_name")
        or base.get("column_name_alias")
    ):
        return None
    qualifier = (base.get("alias") or table).lower()
    declared = {name.lower(): (name, scale) for name, scale in columns.items()}
    sums = []
    for node in nodes:
        if (
            node.get("class") != "FUNCTION"
            or node.get("function_name", "").lower() != "sum"
            or node.get("schema") not in {"", "main"}
            or node.get("catalog")
        ):
            continue
        children = node.get("children") or []
        if len(children) != 1 or children[0].get("class") != "COLUMN_REF":
            continue
        field = children[0]
        names = field.get("column_names") or []
        if (
            len(names) not in {1, 2}
            or names[-1].lower() not in declared
            or (len(names) == 2 and names[0].lower() != qualifier)
        ):
            continue
        name, scale = declared[names[-1].lower()]
        sums.append((children, field, name, scale))
    if not sums:
        return None
    for name, scale in {(name, scale) for _, _, name, scale in sums}:
        if type(scale) is not int or not 0 <= scale <= 8:
            raise ValueError("Numeric SUM requires a declared exact decimal scale")
        pattern = "[+-]?[0-9]+" + (rf"(\.[0-9]{{1,{scale}}})?" if scale else "")
        if con.execute(
            f"SELECT count(*) FROM {safe_ident(table)} WHERE {safe_ident(name)} IS NOT NULL AND NOT regexp_full_match({safe_ident(name)}, ?)",
            [pattern],
        ).fetchone()[0]:
            raise ValueError(
                f"Numeric SUM source {name} contains invalid or over-scale values; no rows were skipped or rounded"
            )
    for children, field, _, scale in sums:
        template = _parse_select(f"SELECT CAST(NULL AS DECIMAL(38,{scale}))")["statements"][0][
            "node"
        ]["select_list"][0]
        cast = copy.deepcopy(template)
        cast["child"] = field
        children[0] = cast
    return con.execute("SELECT json_deserialize_sql(?)", [json.dumps(tree)]).fetchone()[0]


_MUTATION_STATEMENTS = ("UPDATE", "INSERT", "DELETE")

# json_serialize_sql only understands SELECT, so a mutation's subqueries are
# screened lexically for the same reach: file / network table functions and getenv.
_MUTATION_REACH_RE = re.compile(
    r"\b(read_\w+|glob|sniff_csv|\w+_scan|parquet_\w+|getenv|query_table|query)\s*\(",
    re.IGNORECASE,
)


def assert_mutation_sql(sql: str) -> str:
    """Validate the SQL an ontology SQL_MUTATION action is about to run.

    Actions exist to change rows of session tables, so UPDATE / INSERT / DELETE
    are the point -- but nothing else is: one statement, no DDL, no ATTACH / COPY /
    INSTALL / LOAD / PRAGMA, no reads from files or the environment.
    """
    if not isinstance(sql, str) or not sql.strip():
        raise ValueError("Invalid action SQL: must be a non-empty string")
    try:
        statements = duckdb.extract_statements(sql)
    except Exception as exc:
        raise ValueError(f"Invalid action SQL: {exc}") from exc
    if len(statements) != 1:
        raise ValueError(f"Invalid action SQL: expected 1 statement, got {len(statements)}")
    stmt_type = getattr(statements[0].type, "name", str(statements[0].type))
    if not stmt_type.endswith(_MUTATION_STATEMENTS):
        raise ValueError(
            f"Invalid action SQL: only UPDATE / INSERT / DELETE are allowed, got {stmt_type}"
        )
    hit = _MUTATION_REACH_RE.search(sql)
    if hit:
        raise ValueError(f"Invalid action SQL: '{hit.group(1)}' is not allowed in an action")
    return sql


def safe_model_sql(sql: str) -> str:
    """Validate a DAG model body: exactly one read-only statement.

    Model SQL is arbitrary SELECT by design (dbt-style), so keyword blacklisting
    is not applicable -- but it is wrapped into CREATE TABLE AS, where a chained
    statement would execute with full privileges.
    """
    if not isinstance(sql, str) or not sql.strip():
        raise ValueError("Invalid model SQL: must be a non-empty string")
    extract = getattr(duckdb, "extract_statements", None)
    if extract is None:
        raise ValueError("Cannot validate model SQL: duckdb.extract_statements unavailable")
    try:
        statements = extract(sql)
    except Exception as exc:
        raise ValueError(f"Invalid model SQL: {exc}") from exc
    if len(statements) != 1:
        raise ValueError(f"Invalid model SQL: expected 1 statement, got {len(statements)}")
    stmt_type = str(getattr(statements[0], "type", ""))
    if not stmt_type.endswith(("SELECT", "EXPLAIN")):
        raise ValueError(f"Invalid model SQL: must be a read-only query, got {stmt_type}")
    try:
        # Upstream model names are plain identifiers, so no known-table set is needed.
        assert_no_external_access(sql)
    except PermissionError as exc:
        raise ValueError(f"Invalid model SQL: {exc}") from exc
    return sql


def normalize_bridge_identifier_quotes(sql: str, names: set[str]) -> str | None:
    """Translate only known simple backtick identifiers, preserving literals.

    No dialect guessing, expression rewrite or predicate change. The result must
    still pass the ordinary DuckDB single-read and external-access guards.
    Dollar quoting and nested block comments are deliberately unsupported.
    """
    if "$" in sql:
        return None
    known = {n.casefold() for n in names}
    out, changed, i = [], False, 0
    while i < len(sql):
        start = i
        if sql.startswith("--", i):
            end = sql.find("\n", i)
            i = len(sql) if end < 0 else end
        elif sql.startswith("/*", i):
            end = sql.find("*/", i + 2)
            if end < 0 or "/*" in sql[i + 2 : end]:
                return None
            i = end + 2
        elif sql[i] in "'\"":
            quote = sql[i]
            i += 1
            while i < len(sql):
                if sql[i] == quote:
                    if i + 1 < len(sql) and sql[i + 1] == quote:
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            else:
                return None
        elif sql[i] == "`":
            end = sql.find("`", i + 1)
            if end < 0:
                return None
            name = sql[i + 1 : end]
            if not _IDENT_RE.fullmatch(name) or name.casefold() not in known:
                return None
            out.append(safe_ident(name))
            changed, i = True, end + 1
            continue
        else:
            i += 1
        out.append(sql[start:i])
    return "".join(out) if changed else None
