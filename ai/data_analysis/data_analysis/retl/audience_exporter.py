from typing import Any

import duckdb

from data_analysis.engine.arrow_utils import ArrowUtils
from data_analysis.engine.sql_guard import safe_columns, safe_predicate, safe_table_ref


class AudienceExporter:
    @staticmethod
    def export_cohort(
        con: duckdb.DuckDBPyConnection,
        source_table: str,
        filter_sql: str | None = None,
        export_columns: list[str] | None = None,
        format_type: str = "json",
        limit: int = 1000,
    ) -> dict[str, Any]:
        """Extract a cohort segment for activation (CRM, campaigns, etc.)."""
        if not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0:
            raise ValueError("limit must be a positive integer")
        fmt = format_type.lower()
        if fmt not in ("json", "csv"):
            raise ValueError("format_type must be json or csv")

        table_ref = safe_table_ref(source_table)
        where = f" WHERE {safe_predicate(filter_sql)}" if filter_sql else ""
        total_audience_count = int(
            con.execute(f"SELECT COUNT(*) FROM {table_ref}{where}").fetchone()[0]
        )

        cols = safe_columns(export_columns) if export_columns else "*"
        sql = f"SELECT {cols} FROM {table_ref}{where} LIMIT {int(limit)}"

        df = con.execute(sql).df()
        exported_count = len(df)
        truncated = exported_count < total_audience_count

        if fmt == "csv":
            content = df.to_csv(index=False)
        else:
            content = ArrowUtils.df_to_records(df)

        return {
            "source_table": source_table,
            "total_audience_count": total_audience_count,
            "exported_count": exported_count,
            "truncated": truncated,
            "format": fmt,
            "data": content,
        }
