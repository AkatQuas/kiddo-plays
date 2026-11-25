import abc

import duckdb
import pyarrow as pa
from pydantic import BaseModel

from data_analysis.engine.sql_guard import safe_table_ref


def is_select(query_or_table: str) -> bool:
    return isinstance(query_or_table, str) and query_or_table.strip().upper().startswith("SELECT")


def safe_select(query: str) -> str:
    """Validate a full SELECT statement, returning it unchanged."""
    if not isinstance(query, str) or not query.strip():
        raise ValueError(f"Invalid query {query!r}: must be a non-empty string")
    text = query.strip().rstrip(";")
    if "--" in text or "/*" in text or "*/" in text:
        raise ValueError(f"Invalid query {text!r}: SQL comments are not allowed")
    statements = duckdb.extract_statements(text)
    if len(statements) != 1:
        raise ValueError(f"Invalid query {text!r}: expands to {len(statements)} statements")
    return text


def safe_query_or_table(query_or_table: str) -> str:
    """Validate either a table reference or a full SELECT; returns a FROM-clause fragment."""
    if is_select(query_or_table):
        return f"({safe_select(query_or_table)}) AS _q"
    return safe_table_ref(query_or_table)


class ColumnInfo(BaseModel):
    name: str
    physical_type: str
    semantic_type: str | None = (
        None  # MEASURE, DIMENSION_CATEGORICAL, DIMENSION_TEMPORAL, IDENTIFIER, TEXT
    )
    is_nullable: bool = True
    comment: str | None = None


class TableSchema(BaseModel):
    table_name: str
    columns: list[ColumnInfo]
    estimated_rows: int | None = None
    primary_keys: list[str] = []


class BaseConnector(abc.ABC):
    """Abstract Base Class for High-Performance DB Connectors."""

    def __init__(self, conn_str: str):
        self.conn_str = conn_str

    @abc.abstractmethod
    def test_connection(self) -> bool:
        """Test if the target database is reachable."""

    @abc.abstractmethod
    def list_tables(self) -> list[str]:
        """List all available tables and views in target DB."""

    @abc.abstractmethod
    def introspect_schema(self, table_name: str) -> TableSchema:
        """Retrieve column metadata and infer preliminary types."""

    @abc.abstractmethod
    def fetch_to_arrow(
        self,
        query_or_table: str,
        filter_sql: str | None = None,
        select_cols: list[str] | None = None,
        partition_col: str | None = None,
        num_partitions: int = 1,
        limit: int | None = None,
        mode: str = "materialize",
    ) -> pa.Table:
        """Fetch records from source DB into a PyArrow Table.

        mode: "materialize" (default) pulls the result via the connector's client
        (e.g. ConnectorX); "scanner" ATTACHes the source in DuckDB and reads it via
        the native scanner with predicate pushdown. Connectors without a scanner
        path treat any mode as materialize.
        """
