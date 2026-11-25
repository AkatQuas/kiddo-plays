from typing import Any

import duckdb

from data_analysis.engine.sql_guard import safe_table_ref


class SchemaDrifter:
    @staticmethod
    def detect_drift(
        con: duckdb.DuckDBPyConnection,
        table: str,
        baseline_schema: dict[
            str, str
        ],  # col_name -> type_name (e.g. {"id": "INTEGER", "sales": "DOUBLE"})
    ) -> dict[str, Any]:
        """
        Detect Schema Drift against a registered baseline schema.
        """
        current_cols = con.execute(f"DESCRIBE {safe_table_ref(table)}").fetchall()
        current_schema = {r[0]: r[1].upper() for r in current_cols}

        added_columns = []
        removed_columns = []
        type_mismatches = []

        # Check added and altered
        for col, c_type in current_schema.items():
            if col not in baseline_schema:
                added_columns.append({"column": col, "type": c_type})
            elif baseline_schema[col].upper() != c_type:
                type_mismatches.append(
                    {"column": col, "expected_type": baseline_schema[col], "actual_type": c_type}
                )

        # Check removed
        for col, b_type in baseline_schema.items():
            if col not in current_schema:
                removed_columns.append({"column": col, "type": b_type})

        has_drift = bool(added_columns or removed_columns or type_mismatches)

        return {
            "table_name": table,
            "has_drift": has_drift,
            "added_columns_count": len(added_columns),
            "removed_columns_count": len(removed_columns),
            "type_mismatches_count": len(type_mismatches),
            "added_columns": added_columns,
            "removed_columns": removed_columns,
            "type_mismatches": type_mismatches,
        }
