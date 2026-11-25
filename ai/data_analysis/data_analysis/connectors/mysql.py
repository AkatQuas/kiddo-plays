import connectorx as cx
import pyarrow as pa

from data_analysis.connectors.base import (
    BaseConnector,
    ColumnInfo,
    TableSchema,
    is_select,
    safe_select,
)
from data_analysis.connectors.duckdb_scanner import fetch_via_scanner
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_predicate, safe_table_ref


class MySQLConnector(BaseConnector):
    """MySQL high-performance connector using ConnectorX (Rust binary protocol)."""

    def test_connection(self) -> bool:
        try:
            df = cx.read_sql(self.conn_str, "SELECT 1 AS ping", return_type="arrow")
            return len(df) > 0
        except Exception:
            return False

    def list_tables(self) -> list[str]:
        query = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_name;
        """
        table = cx.read_sql(self.conn_str, query, return_type="arrow")
        return [str(val) for val in table["table_name"].to_pylist()]

    def introspect_schema(self, table_name: str) -> TableSchema:
        query = f"""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = '{table_name}'
        ORDER BY ordinal_position;
        """
        arrow_res = cx.read_sql(self.conn_str, query, return_type="arrow")
        cols = []
        for row in arrow_res.to_pylist():
            cname = row["column_name"]
            dtype = str(row["data_type"]).lower()
            nullable = row["is_nullable"] == "YES"
            cols.append(ColumnInfo(name=cname, physical_type=dtype, is_nullable=nullable))

        return TableSchema(table_name=table_name, columns=cols)

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
        cols_clause = safe_columns(select_cols) if select_cols else "*"
        if is_select(query_or_table):
            base_sql = safe_select(query_or_table)
        else:
            base_sql = f"SELECT {cols_clause} FROM {safe_table_ref(query_or_table)}"

        if filter_sql:
            base_sql = f"SELECT * FROM ({base_sql}) AS _sub WHERE {safe_predicate(filter_sql)}"

        if limit:
            base_sql += f" LIMIT {int(limit)}"

        # scanner mode: DuckDB ATTACHes the MySQL DB and reads with pushdown.
        if mode == "scanner":
            return fetch_via_scanner("mysql", self.conn_str, base_sql)

        if partition_col and num_partitions > 1:
            return cx.read_sql(
                self.conn_str,
                base_sql,
                partition_on=safe_ident(partition_col),
                partition_num=num_partitions,
                return_type="arrow",
            )
        return cx.read_sql(self.conn_str, base_sql, return_type="arrow")
