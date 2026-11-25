import duckdb
import pyarrow as pa

from data_analysis.engine.sql_guard import safe_ident, safe_predicate, safe_table_ref

_ALLOWED_AGG = {"SUM", "AVG", "COUNT", "MIN", "MAX"}


class DistributedOLAP:
    """High-performance multi-dimensional In-Memory OLAP aggregator."""

    @classmethod
    def aggregate(
        cls,
        con: duckdb.DuckDBPyConnection,
        table_name: str,
        dimensions: list[str],
        metrics: list[str],
        agg_funcs: list[str] | None = None,
        filters: str | None = None,
        rollup: bool = False,
        cube: bool = False,
        order_by: str | None = None,
        limit: int | None = 1000,
    ) -> pa.Table:
        funcs = agg_funcs or ["SUM" for _ in metrics]
        agg_exprs = []
        for m, f in zip(metrics, funcs, strict=False):
            func = f.upper()
            if func not in _ALLOWED_AGG:
                raise ValueError(f"Unsupported aggregation function '{f}'")
            agg_exprs.append(f"{func}({safe_ident(m)}) AS {safe_ident(f'{m}_{f.lower()}')}")

        dim_clause = ", ".join([safe_ident(d) for d in dimensions]) if dimensions else ""
        select_clause = ", ".join(filter(None, [dim_clause, ", ".join(agg_exprs)]))

        sql = f"SELECT {select_clause} FROM {safe_table_ref(table_name)}"
        if filters:
            sql += f" WHERE {safe_predicate(filters)}"

        if dimensions:
            if cube:
                sql += f" GROUP BY CUBE ({dim_clause})"
            elif rollup:
                sql += f" GROUP BY ROLLUP ({dim_clause})"
            else:
                sql += f" GROUP BY {dim_clause}"

        if order_by:
            sql += f" ORDER BY {safe_predicate(order_by)}"
        elif metrics:
            sql += " ORDER BY 2 DESC"

        params = []
        if limit:
            sql += " LIMIT ?"
            params.append(int(limit))

        res = con.execute(sql, params).arrow()
        if isinstance(res, pa.RecordBatchReader):
            res = res.read_all()
        return res

    @classmethod
    def pivot_table(
        cls,
        con: duckdb.DuckDBPyConnection,
        table_name: str,
        rows: list[str],
        columns: str,
        values: str,
        agg_func: str = "SUM",
        filters: str | None = None,
    ) -> pa.Table:
        func = agg_func.upper()
        if func not in _ALLOWED_AGG:
            raise ValueError(f"Unsupported aggregation function '{agg_func}'")
        table_ref = safe_table_ref(table_name)
        col_ref = safe_ident(columns)
        val_ref = safe_ident(values)

        dist_sql = f"SELECT DISTINCT {col_ref} FROM {table_ref} WHERE {col_ref} IS NOT NULL"
        if filters:
            dist_sql += f" AND ({safe_predicate(filters)})"
        distinct_vals = [str(r[0]) for r in con.execute(dist_sql).fetchall()]

        pivot_exprs = []
        params = []
        for val in distinct_vals:
            # alias comes from column data, not a caller identifier: escape quotes, don't reject spaces
            alias = '"{}"'.format(f"{val}_{agg_func.lower()}".replace('"', '""'))
            pivot_exprs.append(
                f"{func}(CASE WHEN {col_ref} = ? THEN {val_ref} ELSE 0 END) AS {alias}"
            )
            params.append(val)

        row_clause = ", ".join([safe_ident(r) for r in rows])
        select_clause = f"{row_clause}, " + ", ".join(pivot_exprs)

        sql = f"SELECT {select_clause} FROM {table_ref}"
        if filters:
            sql += f" WHERE {safe_predicate(filters)}"
        sql += f" GROUP BY {row_clause} ORDER BY 1"

        res = con.execute(sql, params).arrow()
        if isinstance(res, pa.RecordBatchReader):
            res = res.read_all()
        return res
