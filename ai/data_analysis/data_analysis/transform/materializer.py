from typing import Any

import duckdb

from data_analysis.engine.sql_guard import safe_ident, safe_predicate, safe_table_ref


class Materializer:
    @staticmethod
    def create_wide_table(
        con: duckdb.DuckDBPyConnection,
        target_name: str,
        fact_table: str,
        dimension_joins: list[dict[str, str]],
    ) -> dict[str, Any]:
        """Merge a fact table with dimension tables into one wide analytical table."""
        target_ref = safe_table_ref(target_name)
        fact_ref = safe_table_ref(fact_table)
        fact_cols = [row[0] for row in con.execute(f"DESCRIBE {fact_ref}").fetchall()]

        join_clauses = []
        select_parts = [f"{fact_ref}.{safe_ident(c)}" for c in fact_cols]
        output_cols = list(fact_cols)

        for j in dimension_joins:
            if "dim_table" not in j:
                raise ValueError("Each dimension join requires dim_table")
            if "on" not in j:
                raise ValueError(f"dimension join for dim_table={j.get('dim_table')!r} requires on")
            dim_name = j["dim_table"]
            if dim_name == fact_table:
                raise ValueError("dim_table must differ from fact_table")
            dim_ref = safe_table_ref(dim_name)
            on_clause = safe_predicate(j["on"])
            join_clauses.append(f"LEFT JOIN {dim_ref} ON {on_clause}")
            for c in j.get("select_cols", []):
                bare = c.split(".")[-1] if "." in c else c
                alias = f"{dim_name}_{bare}" if bare in output_cols else bare
                if alias in output_cols:
                    alias = f"{dim_name}_{bare}"
                select_parts.append(f"{safe_table_ref(c)} AS {safe_ident(alias)}")
                if alias not in output_cols:
                    output_cols.append(alias)

        dim_str = ", ".join(select_parts)
        sql = f"""
        CREATE OR REPLACE TABLE {target_ref} AS
        SELECT {dim_str}
        FROM {fact_ref}
        {" ".join(join_clauses)}
        """

        con.execute(sql)
        row_count = con.execute(f"SELECT count(*) FROM {target_ref}").fetchone()[0]

        return {
            "wide_table_name": target_name,
            "row_count": row_count,
            "columns": output_cols,
            "status": "SUCCESS",
        }
