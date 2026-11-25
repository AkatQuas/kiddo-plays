import os
import sqlite3
import tempfile
import time
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

import duckdb

from data_analysis.config import settings
from data_analysis.engine.reach_guard import resolve_inside
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref

# Small, boring DuckDB -> destination type mapping. Anything unmatched falls back to TEXT.
_PG_TYPES = {
    "BOOLEAN": "BOOLEAN",
    "TINYINT": "SMALLINT",
    "SMALLINT": "SMALLINT",
    "INTEGER": "INTEGER",
    "BIGINT": "BIGINT",
    "HUGEINT": "NUMERIC",
    "UTINYINT": "SMALLINT",
    "USMALLINT": "INTEGER",
    "UINTEGER": "BIGINT",
    "UBIGINT": "NUMERIC",
    "FLOAT": "REAL",
    "DOUBLE": "DOUBLE PRECISION",
    "DATE": "DATE",
    "TIME": "TIME",
    "TIMESTAMP": "TIMESTAMP",
    "TIMESTAMP WITH TIME ZONE": "TIMESTAMPTZ",
    "UUID": "UUID",
    "VARCHAR": "TEXT",
    "BLOB": "BYTEA",
}
_MYSQL_TYPES = {
    "BOOLEAN": "TINYINT(1)",
    "TINYINT": "TINYINT",
    "SMALLINT": "SMALLINT",
    "INTEGER": "INT",
    "BIGINT": "BIGINT",
    "HUGEINT": "DECIMAL(38,0)",
    "UTINYINT": "SMALLINT",
    "USMALLINT": "INT",
    "UINTEGER": "BIGINT",
    "UBIGINT": "DECIMAL(20,0)",
    "FLOAT": "FLOAT",
    "DOUBLE": "DOUBLE",
    "DATE": "DATE",
    "TIME": "TIME",
    "TIMESTAMP": "DATETIME",
    "TIMESTAMP WITH TIME ZONE": "DATETIME",
    "UUID": "CHAR(36)",
    "VARCHAR": "TEXT",
    "BLOB": "BLOB",
}


def _source_schema(con: duckdb.DuckDBPyConnection, quoted_source: str) -> list[tuple[str, str]]:
    """Return [(column_name, duckdb_type)] for the source table."""
    rows = con.execute(f"DESCRIBE SELECT * FROM {quoted_source}").fetchall()
    return [(r[0], str(r[1]).upper()) for r in rows]


def _map_type(duck_type: str, type_map: dict[str, str]) -> str:
    base = duck_type.split("(", maxsplit=1)[0].strip()
    if base.startswith("DECIMAL"):
        return duck_type
    return type_map.get(duck_type) or type_map.get(base) or "TEXT"


class DestinationSync:
    @staticmethod
    def _export_path(requested: str) -> str:
        """File destinations live under EXPORT_DIR, whatever path the caller asked for.

        A bare or relative name is placed inside EXPORT_DIR; anything that still
        resolves outside it (absolute paths, ..) is refused. Otherwise this endpoint
        is an arbitrary-file-write primitive (overwrite app code, the catalog db, ...).
        """
        export_dir = settings.EXPORT_DIR
        os.makedirs(export_dir, exist_ok=True)
        if os.path.isabs(requested):
            candidate = requested
        else:
            # "data/exports/x.csv" relative to the working directory is accepted as given.
            root = os.path.realpath(export_dir)
            already_inside = os.path.realpath(requested).startswith(root + os.sep)
            candidate = requested if already_inside else os.path.join(export_dir, requested)
        resolved = resolve_inside(candidate, [export_dir], "reverse-ETL file export")
        os.makedirs(os.path.dirname(resolved), exist_ok=True)
        return resolved

    @staticmethod
    def sync_table_to_destination(
        con: duckdb.DuckDBPyConnection,
        source_table: str,
        dest_conn_str: str,
        dest_table_name: str,
        mode: str = "replace",  # replace, append
        chunk_size: int = 50000,
    ) -> dict[str, Any]:
        """
        Production Streaming Reverse ETL:
        Syncs data in constant-memory batches using Arrow RecordBatches / PyArrow chunks.
        """
        start_t = time.time()

        if not isinstance(chunk_size, int) or isinstance(chunk_size, bool) or chunk_size <= 0:
            raise ValueError("chunk_size must be a positive integer")
        if mode not in ("replace", "append"):
            raise ValueError(f"Unsupported sync mode '{mode}': use 'replace' or 'append'")

        quoted_source = safe_table_ref(source_table)
        safe_ident(dest_table_name)

        total_rows = con.execute(f"SELECT count(*) FROM {quoted_source}").fetchone()[0]
        synced_rows = 0

        parsed = urlparse(dest_conn_str)
        scheme = parsed.scheme.lower()

        if scheme in ("postgres", "postgresql", "mysql"):
            synced_rows = DestinationSync._sync_to_rdbms(
                con,
                quoted_source,
                dest_table_name,
                dest_conn_str,
                scheme,
                mode,
                chunk_size,
                total_rows,
            )

        elif scheme in ("file", "") and (
            dest_conn_str.endswith(".parquet") or dest_conn_str.endswith(".csv")
        ):
            if mode == "append":
                raise ValueError("append mode is not supported for file destinations; use replace")
            file_path = DestinationSync._export_path(dest_conn_str.replace("file://", ""))
            # COPY ... TO takes no bound parameter for the target: the path is confined
            # to EXPORT_DIR above and its quotes are doubled here.
            quoted_path = file_path.replace("'", "''")
            if file_path.endswith(".parquet"):
                # DuckDB zero-copy direct Parquet export
                con.execute(
                    f"COPY {quoted_source} TO '{quoted_path}' (FORMAT PARQUET, COMPRESSION ZSTD)"
                )
            else:
                con.execute(f"COPY {quoted_source} TO '{quoted_path}' (FORMAT CSV, HEADER)")
            synced_rows = total_rows

        elif scheme in ("sqlite", "sqlite3", ""):
            db_path = parsed.path or dest_conn_str.replace("sqlite:///", "").replace(
                "sqlite://", ""
            )
            if not db_path:
                db_path = "destination_sync.db"
            if not os.path.isabs(db_path):
                db_path = DestinationSync._export_path(db_path)
            else:
                tmp_root = os.path.realpath(tempfile.gettempdir())
                real_db = os.path.realpath(db_path)
                if not (real_db == tmp_root or real_db.startswith(tmp_root + os.sep)):
                    db_path = DestinationSync._export_path(db_path)
                else:
                    parent = os.path.dirname(real_db)
                    if parent:
                        os.makedirs(parent, exist_ok=True)
                    db_path = real_db

            with sqlite3.connect(db_path, timeout=30.0) as s_con:
                s_con.execute("PRAGMA journal_mode=WAL")
                table_exists = bool(
                    s_con.execute(
                        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                        (dest_table_name,),
                    ).fetchone()
                )
                if mode == "replace":
                    s_con.execute(f"DROP TABLE IF EXISTS {safe_ident(dest_table_name)}")
                    table_exists = False

                offset = 0
                first_chunk = not table_exists
                schema = _source_schema(con, quoted_source)
                col_names = [n for n, _ in schema]
                dest_q = safe_ident(dest_table_name)

                def _sqlite_ddl_cols() -> list[str]:
                    ddl_cols = []
                    for name, duck_type in schema:
                        ut = duck_type.upper()
                        if "DECIMAL" in ut:
                            sqlite_type = "TEXT"
                        elif any(t in ut for t in ("INT", "HUGEINT")):
                            sqlite_type = "INTEGER"
                        elif any(t in ut for t in ("DOUBLE", "FLOAT", "REAL")):
                            sqlite_type = "REAL"
                        else:
                            sqlite_type = "TEXT"
                        ddl_cols.append(f"{safe_ident(name)} {sqlite_type}")
                    return ddl_cols

                if total_rows == 0 and first_chunk:
                    s_con.execute(f"CREATE TABLE {dest_q} ({', '.join(_sqlite_ddl_cols())})")
                    first_chunk = False

                while offset < total_rows:
                    chunk_rows = con.execute(
                        f"SELECT * FROM {quoted_source} LIMIT {chunk_size} OFFSET {offset}"
                    ).fetchall()
                    if not chunk_rows:
                        break
                    if first_chunk:
                        s_con.execute(f"CREATE TABLE {dest_q} ({', '.join(_sqlite_ddl_cols())})")
                        first_chunk = False
                    ins = (
                        f"INSERT INTO {dest_q} ({', '.join(safe_ident(n) for n in col_names)}) "
                        f"VALUES ({', '.join(['?'] * len(col_names))})"
                    )
                    bound = [
                        [str(v) if isinstance(v, Decimal) else v for v in row] for row in chunk_rows
                    ]
                    s_con.executemany(ins, bound)
                    synced_rows += len(chunk_rows)
                    offset += chunk_size

        else:
            raise NotImplementedError(
                f"Unsupported reverse-ETL destination scheme '{scheme or dest_conn_str}'"
            )

        duration_ms = round((time.time() - start_t) * 1000, 2)

        return {
            "source_table": source_table,
            "dest_conn_str": dest_conn_str,
            "dest_table_name": dest_table_name,
            "synced_rows": synced_rows,
            "mode": mode,
            "duration_ms": duration_ms,
            "status": "SUCCESS",
        }

    @staticmethod
    def _sync_to_rdbms(
        con: duckdb.DuckDBPyConnection,
        quoted_source: str,
        dest_table_name: str,
        dest_conn_str: str,
        scheme: str,
        mode: str,
        chunk_size: int,
        total_rows: int,
    ) -> int:
        """Chunked, transactional write to PostgreSQL or MySQL. Returns rows written."""
        is_pg = scheme in ("postgres", "postgresql")

        if is_pg:
            import psycopg

            dest_con = psycopg.connect(dest_conn_str, autocommit=False)
            quote = '"'
            type_map = _PG_TYPES
        else:
            import pymysql

            parsed = urlparse(dest_conn_str)
            dest_con = pymysql.connect(
                host=parsed.hostname or "localhost",
                port=parsed.port or 3306,
                user=parsed.username or "",
                password=parsed.password or "",
                database=(parsed.path or "").lstrip("/") or None,
                autocommit=False,
            )
            quote = "`"
            type_map = _MYSQL_TYPES

        schema = _source_schema(con, quoted_source)
        for name, _ in schema:
            safe_ident(name)

        dest_ref = f"{quote}{dest_table_name}{quote}"
        col_list = ", ".join(f"{quote}{n}{quote}" for n, _ in schema)
        placeholders = ", ".join(["%s"] * len(schema))
        insert_sql = f"INSERT INTO {dest_ref} ({col_list}) VALUES ({placeholders})"
        ddl_cols = ", ".join(f"{quote}{n}{quote} {_map_type(t, type_map)}" for n, t in schema)

        written = 0
        try:
            with dest_con.cursor() as cur:
                if mode == "replace":
                    cur.execute(f"DROP TABLE IF EXISTS {dest_ref}")
                    cur.execute(f"CREATE TABLE {dest_ref} ({ddl_cols})")
                else:
                    cur.execute(f"CREATE TABLE IF NOT EXISTS {dest_ref} ({ddl_cols})")

                offset = 0
                while offset < total_rows:
                    rows = con.execute(
                        f"SELECT * FROM {quoted_source} LIMIT {chunk_size} OFFSET {offset}"
                    ).fetchall()
                    if not rows:
                        break
                    cur.executemany(insert_sql, rows)
                    written += len(rows)
                    offset += chunk_size
            dest_con.commit()
        except Exception:
            dest_con.rollback()
            raise
        finally:
            dest_con.close()

        return written
