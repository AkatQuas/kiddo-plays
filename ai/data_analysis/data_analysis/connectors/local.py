import os
from typing import Any
from urllib.parse import unquote, urlparse

import duckdb
import pyarrow as pa
import pyarrow.csv as pcsv
import pyarrow.parquet as pq

from data_analysis.connectors.base import (
    BaseConnector,
    ColumnInfo,
    TableSchema,
    is_select,
    safe_select,
)
from data_analysis.connectors.excel_reader import FastExcelReader
from data_analysis.engine.arrow_utils import ArrowUtils
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_predicate, safe_table_ref

_SQLITE_MAGIC = b"SQLite format 3\x00"


def resolve_local_path(conn_str: str) -> str:
    """Resolve a file path, ``file://`` URI, ``sqlite://`` URI, or ``duckdb://`` URI to a filesystem path."""
    if not isinstance(conn_str, str) or not conn_str.strip():
        raise ValueError("Local connection string is empty")
    text = conn_str.strip()
    if "://" not in text:
        return text
    scheme, rest = text.split("://", 1)
    scheme = scheme.lower()
    if scheme not in ("file", "sqlite", "duckdb"):
        raise ValueError(f"LocalFileConnector cannot open scheme {scheme!r}")
    # file:///abs and sqlite:///abs are real URIs. file://relative/path is the
    # prefix this service concatenates onto a filesystem path (often relative).
    if rest.startswith("/"):
        path = unquote(urlparse(text).path or "")
    else:
        path = unquote(rest)
    if not path:
        raise ValueError(f"Local connection string {conn_str!r} has no path")
    return path


def _sql_path_literal(path: str) -> str:
    if "\x00" in path:
        raise ValueError("Local path cannot contain a NUL byte")
    return "'" + path.replace("'", "''") + "'"


def _require_file(path: str) -> str:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Local data file not found: {path}")
    return path


def _extension(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _is_sqlite_file(path: str) -> bool:
    try:
        with open(path, "rb") as handle:
            return handle.read(16) == _SQLITE_MAGIC
    except OSError:
        return False


def _csv_reject_error(con: duckdb.DuckDBPyConnection, path: str) -> int:
    """Count malformed CSV rows DuckDB skipped; keep B behavior (do not abort import)."""
    try:
        exists = con.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'reject_errors'"
        ).fetchone()[0]
    except Exception:
        return 0
    if not exists:
        return 0
    count = con.execute("SELECT count(DISTINCT line) FROM reject_errors").fetchone()[0]
    return int(count or 0)


class LocalFileConnector(BaseConnector):
    """Local Parquet / CSV / Excel (.xlsx) / SQLite / Arrow file connector.

    Legacy ``.xls`` is rejected with a clear error. ``.db`` files are treated as
    SQLite only when the file header says so; otherwise they are opened as DuckDB.
    """

    def _path(self) -> str:
        return resolve_local_path(self.conn_str)

    def test_connection(self) -> bool:
        try:
            path = self._path()
        except ValueError:
            return False
        return os.path.isfile(path)

    def list_tables(self) -> list[str]:
        path = _require_file(self._path())
        ext = _extension(path)
        if ext in (".xlsx", ".xls"):
            return FastExcelReader.list_sheets(path)
        if ext in (".sqlite", ".db", ".duckdb"):
            return self._list_db_tables(path)
        return [os.path.basename(path)]

    def _list_db_tables(self, path: str) -> list[str]:
        if _is_sqlite_file(path):
            con = duckdb.connect(":memory:")
            try:
                con.execute(f"ATTACH {_sql_path_literal(path)} AS src (TYPE SQLITE)")
                rows = con.execute("SHOW TABLES FROM src").fetchall()
                return [r[0] for r in rows]
            finally:
                con.close()
        con = duckdb.connect(path, read_only=True)
        try:
            rows = con.execute("SHOW TABLES").fetchall()
            return [r[0] for r in rows]
        finally:
            con.close()

    def introspect_schema(self, table_name: str) -> TableSchema:
        path = _require_file(self._path())
        ext = _extension(path)
        cols: list[ColumnInfo] = []
        if ext in (".xlsx", ".xls"):
            arrow_tbl = FastExcelReader.read_xlsx_to_arrow(
                path, sheet_name=table_name, limit_rows=10
            )
            for field in arrow_tbl.schema:
                cols.append(
                    ColumnInfo(
                        name=field.name, physical_type=str(field.type), is_nullable=field.nullable
                    )
                )
        elif ext == ".parquet":
            schema = pq.read_schema(path)
            for field in schema:
                cols.append(
                    ColumnInfo(
                        name=field.name, physical_type=str(field.type), is_nullable=field.nullable
                    )
                )
        elif ext == ".csv":
            reader = pcsv.open_csv(path)
            try:
                for field in reader.schema:
                    cols.append(
                        ColumnInfo(
                            name=field.name,
                            physical_type=str(field.type),
                            is_nullable=field.nullable,
                        )
                    )
            finally:
                close = getattr(reader, "close", None)
                if close:
                    close()
        elif ext in (".sqlite", ".db", ".duckdb"):
            cols = self._describe_db_table(path, table_name)
        elif ext in (".json", ".ndjson", ".jsonl"):
            con = duckdb.connect(":memory:")
            try:
                desc = con.execute(
                    f"DESCRIBE SELECT * FROM read_json_auto({_sql_path_literal(path)})"
                ).fetchall()
            finally:
                con.close()
            cols = [
                ColumnInfo(name=r[0], physical_type=str(r[1]).lower(), is_nullable=(r[2] == "YES"))
                for r in desc
            ]
        else:
            con = duckdb.connect(":memory:")
            try:
                desc = con.execute(f"DESCRIBE SELECT * FROM {_sql_path_literal(path)}").fetchall()
            finally:
                con.close()
            cols = [
                ColumnInfo(name=r[0], physical_type=str(r[1]).lower(), is_nullable=(r[2] == "YES"))
                for r in desc
            ]
        return TableSchema(table_name=table_name, columns=cols)

    def _describe_db_table(self, path: str, table_name: str) -> list[ColumnInfo]:
        if _is_sqlite_file(path):
            con = duckdb.connect(":memory:")
            try:
                con.execute(f"ATTACH {_sql_path_literal(path)} AS src (TYPE SQLITE)")
                desc = con.execute(f"DESCRIBE src.{safe_ident(table_name)}").fetchall()
            finally:
                con.close()
        else:
            con = duckdb.connect(path, read_only=True)
            try:
                desc = con.execute(f"DESCRIBE {safe_table_ref(table_name)}").fetchall()
            finally:
                con.close()
        return [
            ColumnInfo(name=r[0], physical_type=str(r[1]).lower(), is_nullable=(r[2] == "YES"))
            for r in desc
        ]

    def fetch_to_arrow(
        self,
        query_or_table: str,
        filter_sql: str | None = None,
        select_cols: list[str] | None = None,
        partition_col: str | None = None,
        num_partitions: int = 1,
        limit: int | None = None,
        mode: str = "materialize",  # local files are read via DuckDB already; mode is a no-op
    ) -> pa.Table:
        del partition_col, num_partitions, mode  # partitioning is applied by PartitionedLoader
        path = _require_file(self._path())
        ext = _extension(path)
        if limit is not None and int(limit) < 0:
            raise ValueError("limit must be >= 0")

        if ext in (".xlsx", ".xls"):
            return self._fetch_excel(path, query_or_table, filter_sql, select_cols, limit)

        con = duckdb.connect(":memory:")
        try:
            from_clause, params = self._from_clause(con, path, ext, query_or_table)
            cols_clause = safe_columns(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_clause} FROM {from_clause}"
            if filter_sql:
                sql += f" WHERE {safe_predicate(filter_sql)}"
            if limit is not None:
                sql += " LIMIT ?"
                params.append(int(limit))
            try:
                arrow_table = ArrowUtils.fetch_table(con.execute(sql, params))
            except duckdb.Error as exc:
                raise ValueError(f"Failed to read local file {path}: {exc}") from exc
            if ext == ".csv":
                self.rejected_rows = _csv_reject_error(con, path)
            return arrow_table
        finally:
            con.close()

    def _fetch_excel(
        self,
        path: str,
        query_or_table: str,
        filter_sql: str | None,
        select_cols: list[str] | None,
        limit: int | None,
    ) -> pa.Table:
        sheet = None
        if query_or_table and not str(query_or_table).strip().lower().startswith("select"):
            sheet = query_or_table
        # A filter has to see the whole sheet; limiting first would drop matching rows.
        arrow_table = FastExcelReader.read_xlsx_to_arrow(
            path,
            sheet_name=sheet,
            limit_rows=None if filter_sql else limit,
        )
        if not select_cols and not filter_sql:
            return arrow_table
        con = duckdb.connect(":memory:")
        try:
            con.register("excel_tmp", arrow_table)
            cols_clause = safe_columns(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_clause} FROM excel_tmp"
            params: list[Any] = []
            if filter_sql:
                sql += f" WHERE {safe_predicate(filter_sql)}"
            if limit is not None:
                sql += " LIMIT ?"
                params.append(int(limit))
            try:
                filtered = ArrowUtils.fetch_table(con.execute(sql, params))
            except duckdb.Error as exc:
                raise ValueError(f"Failed to filter Excel sheet {sheet or path}: {exc}") from exc
            return filtered
        finally:
            con.close()

    def _from_clause(
        self,
        con: duckdb.DuckDBPyConnection,
        path: str,
        ext: str,
        query_or_table: str,
    ) -> tuple:
        if ext == ".parquet":
            return "read_parquet(?)", [path]
        if ext == ".csv":
            return "read_csv_auto(?, sample_size=100000, ignore_errors=true, store_rejects=true)", [
                path
            ]
        if ext in (".json", ".ndjson", ".jsonl"):
            return "read_json_auto(?)", [path]
        if ext in (".sqlite", ".db") and _is_sqlite_file(path):
            con.execute(f"ATTACH {_sql_path_literal(path)} AS sqlite_db (TYPE SQLITE)")
            if is_select(query_or_table):
                con.execute("USE sqlite_db")
                return f"({safe_select(query_or_table)}) AS _q", []
            return f"sqlite_db.{safe_ident(query_or_table)}", []
        if ext in (".sqlite", ".db", ".duckdb"):
            con.execute(f"ATTACH {_sql_path_literal(path)} AS local_db (READ_ONLY)")
            if is_select(query_or_table):
                con.execute("USE local_db")
                return f"({safe_select(query_or_table)}) AS _q", []
            return f"local_db.{safe_table_ref(query_or_table)}", []
        return _sql_path_literal(path), []
