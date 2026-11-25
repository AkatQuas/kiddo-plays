import math
from typing import Any

import duckdb

from data_analysis.engine.sql_guard import safe_ident, safe_table_ref


def _finite_bound(val: Any, col: str, side: str) -> float | None:
    """Coerce a clip bound to a finite float so it is safe to inline."""
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        raise ValueError(f"Invalid clip {side} for {col!r}: must be a number")
    f = float(val)
    if not math.isfinite(f):
        raise ValueError(f"Invalid clip {side} for {col!r}: must be finite")
    return f


class DataCleaner:
    @staticmethod
    def clean_table(
        con: duckdb.DuckDBPyConnection,
        source_table: str,
        target_table: str,
        dedup_keys: list[str] | None = None,
        fillna_rules: dict[str, Any] | None = None,  # col -> value or "MEAN", "MEDIAN", "MODE"
        outlier_clip_cols: dict[str, dict[str, float]]
        | None = None,  # col -> {"min": 0, "max": 100}
    ) -> dict[str, Any]:
        """
        Execute automated data cleaning pipeline and materialize into target_table.
        """
        source_ref = safe_table_ref(source_table)
        target_ref = safe_table_ref(target_table)

        # 1. Build SELECT expressions
        cols_info = con.execute(f"DESCRIBE {source_ref}").fetchall()
        col_names = [r[0] for r in cols_info]
        known = set(col_names)

        if dedup_keys:
            for key in dedup_keys:
                if key not in known:
                    raise ValueError(f"Unknown dedup key {key!r}")
        if fillna_rules:
            for key in fillna_rules:
                if key not in known:
                    raise ValueError(f"Unknown fillna column {key!r}")
        if outlier_clip_cols:
            for key in outlier_clip_cols:
                if key not in known:
                    raise ValueError(f"Unknown clip column {key!r}")
                bounds = outlier_clip_cols[key]
                mn = bounds.get("min")
                mx = bounds.get("max")
                if mn is not None and mx is not None and float(mn) > float(mx):
                    raise ValueError(f"Invalid clip min/max for {key!r}: min must be <= max")

        # ponytail: two layers, not one nested expr -- clip repeats its input 3x in
        # CASE WHEN, which would duplicate any '?' a fillna bound underneath it.
        fill_exprs = []
        params: list[Any] = []
        for col in col_names:
            col_ref = safe_ident(col)
            expr = col_ref

            if fillna_rules and col in fillna_rules:
                val = fillna_rules[col]
                if isinstance(val, bool):
                    raise ValueError(
                        f"Invalid fillna value for {col!r}: booleans are not supported"
                    )
                if isinstance(val, (int, float)):
                    expr = f"COALESCE({col_ref}, ?)"
                    params.append(val)
                elif isinstance(val, str):
                    if val.upper() == "MEAN":
                        agg = con.execute(f"SELECT avg({col_ref}) FROM {source_ref}").fetchone()[0]
                        expr = f"COALESCE({col_ref}, ?)"
                        params.append(float(agg) if agg is not None else 0.0)
                    elif val.upper() == "MEDIAN":
                        agg = con.execute(f"SELECT median({col_ref}) FROM {source_ref}").fetchone()[
                            0
                        ]
                        expr = f"COALESCE({col_ref}, ?)"
                        params.append(float(agg) if agg is not None else 0.0)
                    elif val.upper() == "MODE":
                        agg = con.execute(f"SELECT mode({col_ref}) FROM {source_ref}").fetchone()[0]
                        expr = f"COALESCE({col_ref}, ?)"
                        params.append(agg)
                    else:
                        expr = f"COALESCE({col_ref}, ?)"
                        params.append(val)
                else:
                    raise ValueError(
                        f"Invalid fillna value for {col!r}: unsupported type {type(val).__name__}"
                    )

            fill_exprs.append(f"{expr} AS {col_ref}")

        clip_exprs = []
        for col in col_names:
            col_ref = safe_ident(col)
            expr = col_ref
            if outlier_clip_cols and col in outlier_clip_cols:
                min_v = _finite_bound(outlier_clip_cols[col].get("min"), col, "min")
                max_v = _finite_bound(outlier_clip_cols[col].get("max"), col, "max")
                # bounds are validated floats -> inlining cannot inject
                if min_v is not None and max_v is not None:
                    expr = (
                        f"CASE WHEN {col_ref} < {min_v} THEN {min_v} "
                        f"WHEN {col_ref} > {max_v} THEN {max_v} ELSE {col_ref} END"
                    )
                elif min_v is not None:
                    expr = f"CASE WHEN {col_ref} < {min_v} THEN {min_v} ELSE {col_ref} END"
                elif max_v is not None:
                    expr = f"CASE WHEN {col_ref} > {max_v} THEN {max_v} ELSE {col_ref} END"
            clip_exprs.append(f"{expr} AS {col_ref}")

        # 2. Build Query with Deduplication
        inner = (
            f"SELECT {', '.join(clip_exprs)} FROM "
            f"(SELECT {', '.join(fill_exprs)} FROM {source_ref})"
        )
        if dedup_keys:
            keys_str = ", ".join(safe_ident(k) for k in dedup_keys)
            clean_query = f"""
            WITH ranked AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (PARTITION BY {keys_str} ORDER BY (SELECT 1)) as _rn
                FROM ({inner})
            )
            SELECT * EXCLUDE (_rn) FROM ranked WHERE _rn = 1
            """
        else:
            clean_query = inner

        con.execute(f"CREATE OR REPLACE TABLE {target_ref} AS {clean_query}", params)

        orig_count = con.execute(f"SELECT count(*) FROM {source_ref}").fetchone()[0]
        new_count = con.execute(f"SELECT count(*) FROM {target_ref}").fetchone()[0]

        return {
            "source_table": source_table,
            "target_table": target_table,
            "original_rows": orig_count,
            "cleaned_rows": new_count,
            "removed_duplicates": orig_count - new_count,
        }
