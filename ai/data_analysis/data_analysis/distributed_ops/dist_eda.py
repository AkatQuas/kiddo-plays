import math
from typing import Any

import duckdb

from data_analysis.engine.arrow_utils import ArrowUtils
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.schema_infer import SchemaInferencer, SemanticType
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref

_SAMPLE_ROWS = 5000


def _finite(value: Any, digits: int = 4) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, digits)


class DistributedEDA:
    """Single-pass sufficient statistics for table profiling.

    One aggregate query covers nulls, distinct counts, and numeric moments.
    A second query, only when categorical columns exist, collects top values.
    Type roles still come from a bounded sample and are labeled as such.
    """

    @classmethod
    def profile_table(cls, con: duckdb.DuckDBPyConnection, table_name: str) -> dict[str, Any]:
        clock = Stopwatch()
        report_name = table_name
        table_ref = safe_table_ref(table_name)
        sample_sql = f"SELECT * FROM {table_ref} LIMIT {_SAMPLE_ROWS}"
        sample = ArrowUtils.fetch_table(con.execute(sample_sql))
        schema_map = SchemaInferencer.infer_table_schema(sample)

        count_sql = f"SELECT COUNT(*) FROM {table_ref}"
        total_hint = int(con.execute(count_sql).fetchone()[0] or 0)
        use_approx = total_hint > 100_000
        distinct_method = "approx_count_distinct" if use_approx else "exact"
        select_parts = ["COUNT(*) AS __n"]
        indexed: list[tuple] = []
        for i, (col_name, meta) in enumerate(schema_map.items()):
            quoted = safe_ident(col_name)
            select_parts.append(f'COUNT(*) - COUNT({quoted}) AS "__null_{i}"')
            dist_expr = (
                f"approx_count_distinct({quoted})" if use_approx else f"COUNT(DISTINCT {quoted})"
            )
            select_parts.append(f'{dist_expr} AS "__dist_{i}"')
            if meta["semantic_type"] == SemanticType.MEASURE.value:
                quantile_fn = "approx_quantile" if use_approx else "quantile_cont"
                select_parts.extend(
                    [
                        f'AVG({quoted}) AS "__mean_{i}"',
                        f'STDDEV_SAMP({quoted}) AS "__std_{i}"',
                        f'MIN({quoted}) AS "__min_{i}"',
                        f'MAX({quoted}) AS "__max_{i}"',
                        f'{quantile_fn}({quoted}, 0.50) AS "__p50_{i}"',
                        f'{quantile_fn}({quoted}, 0.25) AS "__p25_{i}"',
                        f'{quantile_fn}({quoted}, 0.75) AS "__p75_{i}"',
                        f'{quantile_fn}({quoted}, 0.95) AS "__p95_{i}"',
                        f'{quantile_fn}({quoted}, 0.99) AS "__p99_{i}"',
                        f'SKEWNESS({quoted}) AS "__skew_{i}"',
                        f'KURTOSIS({quoted}) AS "__kurt_{i}"',
                    ]
                )
            indexed.append((i, col_name, meta))

        profile_sql = f"SELECT {', '.join(select_parts)} FROM {table_ref}"
        rel = con.execute(profile_sql)
        names = [d[0] for d in rel.description]
        stats = dict(zip(names, rel.fetchone(), strict=False))
        total_rows = int(stats["__n"] or 0)

        cat_cols = [
            (i, col_name)
            for i, col_name, meta in indexed
            if meta["semantic_type"] == SemanticType.DIMENSION_CATEGORICAL.value
        ]
        top_by_col: dict[str, list[dict[str, Any]]] = {name: [] for _, name in cat_cols}
        cat_sql = None
        if cat_cols and total_rows:
            unions = []
            for _i, col_name in cat_cols:
                quoted = safe_ident(col_name)
                label = col_name.replace("'", "''")
                unions.append(
                    f"""SELECT '{label}' AS col, CAST({quoted} AS VARCHAR) AS val, COUNT(*) AS cnt
                        FROM {table_ref} WHERE {quoted} IS NOT NULL GROUP BY 2"""
                )
            cat_sql = " UNION ALL ".join(unions)
            for col, val, cnt in con.execute(cat_sql).fetchall():
                top_by_col.setdefault(col, []).append((cnt, val))
            for col, pairs in top_by_col.items():
                pairs.sort(key=lambda p: p[0], reverse=True)
                top_by_col[col] = [
                    {
                        "value": str(val),
                        "count": int(cnt),
                        "percentage": round(cnt * 100.0 / total_rows, 2),
                    }
                    for cnt, val in pairs[:10]
                ]

        column_reports: dict[str, Any] = {}
        quality_penalties = 0
        undefined_moments: list[str] = []
        for i, col_name, meta in indexed:
            null_cnt = int(stats.get(f"__null_{i}") or 0)
            dist_cnt = int(stats.get(f"__dist_{i}") or 0)
            null_rate = (null_cnt / max(1, total_rows)) * 100
            if null_rate > 30:
                quality_penalties += 10
            elif null_rate > 5:
                quality_penalties += 3
            report: dict[str, Any] = {
                "column_name": col_name,
                "physical_type": meta["physical_type"],
                "semantic_type": meta["semantic_type"],
                "total_rows": total_rows,
                "null_count": null_cnt,
                "null_percentage": round(null_rate, 2),
                "distinct_count": dist_cnt,
                "distinct_count_method": distinct_method,
                "quantile_method": ("approx_quantile" if use_approx else "quantile_cont")
                if meta["semantic_type"] == SemanticType.MEASURE.value
                else None,
            }
            if (
                meta["semantic_type"] == SemanticType.MEASURE.value
                and stats.get(f"__mean_{i}") is not None
            ):
                skewness = _finite(stats.get(f"__skew_{i}"))
                kurtosis = _finite(stats.get(f"__kurt_{i}"))
                std = _finite(stats.get(f"__std_{i}"))
                if skewness is None or kurtosis is None or std is None:
                    undefined_moments.append(col_name)
                report.update(
                    {
                        "mean": _finite(stats.get(f"__mean_{i}")),
                        "std": std,
                        "min": _finite(stats.get(f"__min_{i}")),
                        "max": _finite(stats.get(f"__max_{i}")),
                        "quantiles": {
                            "p25": _finite(stats.get(f"__p25_{i}")),
                            "p50": _finite(stats.get(f"__p50_{i}")),
                            "p75": _finite(stats.get(f"__p75_{i}")),
                            "p95": _finite(stats.get(f"__p95_{i}")),
                            "p99": _finite(stats.get(f"__p99_{i}")),
                        },
                        "skewness": skewness,
                        "kurtosis": kurtosis,
                    }
                )
            elif meta["semantic_type"] == SemanticType.DIMENSION_CATEGORICAL.value:
                report["top_categories"] = top_by_col.get(col_name, [])
            column_reports[col_name] = report

        sqls = [sample_sql, count_sql, profile_sql]
        if cat_sql:
            sqls.append(cat_sql)
        return {
            "table_name": report_name,
            "total_rows": total_rows,
            "total_columns": len(schema_map),
            "quality_score": max(20, 100 - quality_penalties),
            "type_inference_sample_rows": min(_SAMPLE_ROWS, total_rows),
            "profile_scans": len(sqls),
            "columns": column_reports,
            "evidence": evidence(
                operator="eda_profile",
                sql=sqls,
                rows_scanned=total_rows,
                rows_used=total_rows,
                duration_ms=clock.ms(),
                method="single_pass_aggregates",
                caveats=[
                    f"Semantic types were inferred from the first {min(_SAMPLE_ROWS, total_rows)} rows.",
                    (
                        "skewness, kurtosis, and sample std stay null when DuckDB leaves them undefined "
                        "(too few rows, or zero variance). They are not filled in as 0. Undefined columns: "
                        + ", ".join(undefined_moments)
                        if undefined_moments
                        else "skewness and kurtosis are null when undefined, and are not filled in as 0."
                    ),
                    (
                        "distinct_count uses DuckDB approx_count_distinct because the table has more than 100,000 rows."
                        if use_approx
                        else "distinct_count is an exact COUNT(DISTINCT). Tables over 100,000 rows switch to approx_count_distinct."
                    ),
                    (
                        "Quantiles use approx_quantile because the table has more than 100,000 rows."
                        if use_approx
                        else "Quantiles use exact quantile_cont. Tables over 100,000 rows switch to approx_quantile."
                    ),
                ],
            ),
        }
