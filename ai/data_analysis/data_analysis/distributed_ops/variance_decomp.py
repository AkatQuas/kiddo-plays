"""Law-of-total-variance split for a metric across categorical dimensions.

One grouped scan keeps (count, sum, sum of squares) per cell of the full
cross-classification. Coarser dimensions are rolled up from those cells, so
between-group and within-group sums of squares are an identity:

    ss_between + ss_within = ss_total
    population_variance_between + population_variance_within = population_variance

Sequential Type I increments follow one dimension order. Sun-Shapley averages
those increments over permutations. A pure SUM attribution does not need that
average; these variance shares do, because the incremental sum of squares
depends on which dimensions were already in the model.
"""

from collections.abc import Sequence
from itertools import permutations
from math import factorial
from typing import Any

from scipy import stats

from data_analysis.config import settings
from data_analysis.distributed_ops.ray_exec import partition_count, partitioned_group_moments
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_ident, safe_predicate, safe_table_ref

_MAX_DIMENSIONS = 4
_MAX_CELLS = 200_000
_CLOSE = 1e-6

Cell = dict[str, Any]


def _ss_total(n: float, sum_y: float, sum_yy: float) -> float:
    if n <= 0:
        return 0.0
    return sum_yy - (sum_y * sum_y) / n


def _ss_between(groups: Sequence[Sequence[float]], n: float, sum_y: float) -> float:
    if n <= 0:
        return 0.0
    explained = 0.0
    for group_n, group_sum in groups:
        if group_n:
            explained += (group_sum * group_sum) / group_n
    return explained - (sum_y * sum_y) / n


def _round(value: float | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _f_test(ss_between: float, ss_within: float, df_between: int, df_within: int):
    if df_between <= 0 or df_within <= 0:
        return None, None, None, None
    ms_between = ss_between / df_between
    ms_within = ss_within / df_within
    if ms_within <= 0:
        if ss_between > _CLOSE:
            return _round(ms_between), 0.0, None, 0.0
        return _round(ms_between), 0.0, None, None
    f_stat = ms_between / ms_within
    p_value = float(stats.f.sf(f_stat, df_between, df_within))
    return _round(ms_between), _round(ms_within), _round(f_stat), _round(p_value)


def _rollup(cells: Sequence[Cell], indexes: Sequence[int]) -> list[tuple[float, float]]:
    grouped: dict[tuple[str, ...], list[float]] = {}
    for cell in cells:
        key = tuple(cell["key"][i] for i in indexes)
        current = grouped.get(key)
        if current is None:
            grouped[key] = [float(cell["n"]), float(cell["s"])]
        else:
            current[0] += float(cell["n"])
            current[1] += float(cell["s"])
    return [(item[0], item[1]) for item in grouped.values()]


def summarize_cells(cells: Sequence[Cell], dimensions: Sequence[str]) -> dict[str, Any]:
    """Close a variance split from cell moments. No database access."""
    names = list(dimensions)
    if not names:
        raise ValueError("variance decomposition requires at least one dimension")
    if len(set(names)) != len(names):
        raise ValueError("variance decomposition dimensions must be unique")
    if len(cells) > _MAX_CELLS:
        raise ValueError("请先聚合再做方差分解：交叉分组超过 200000。先降维或预聚合。")

    n = float(sum(float(cell["n"]) for cell in cells))
    sum_y = float(sum(float(cell["s"]) for cell in cells))
    sum_yy = float(sum(float(cell["ss"]) for cell in cells))
    if n < 2:
        raise ValueError("variance decomposition needs at least 2 non-null rows")

    ss_total = _ss_total(n, sum_y, sum_yy)
    population = ss_total / n
    sample = ss_total / (n - 1)
    index = {name: pos for pos, name in enumerate(names)}
    ss_cache: dict[tuple[str, ...], float] = {}

    def ss_of(subset: tuple[str, ...]) -> float:
        cached = ss_cache.get(subset)
        if cached is not None:
            return cached
        groups = _rollup(cells, [index[name] for name in subset])
        value = _ss_between(groups, n, sum_y)
        ss_cache[subset] = value
        return value

    notes: list[str] = [
        "population_variance_between + population_variance_within = population_variance (divide by n).",
        "ANOVA mean squares use residual degrees of freedom and are not that split.",
        "This is an accounting split of sum of squares, not a causal effect.",
    ]
    factors = []
    zero_within = False
    for name in names:
        ss_between = ss_of((name,))
        ss_within = ss_total - ss_between
        groups = _rollup(cells, [index[name]])
        n_groups = len(groups)
        df_between = n_groups - 1
        df_within = int(n) - n_groups
        ms_between, ms_within, f_stat, p_value = _f_test(
            ss_between, ss_within, df_between, df_within
        )
        if ss_within <= _CLOSE and ss_between > _CLOSE:
            zero_within = True
        eta = (ss_between / ss_total) if ss_total > _CLOSE else 0.0
        factors.append(
            {
                "dimension": name,
                "n_groups": n_groups,
                "df_between": df_between,
                "df_within": df_within,
                "ss_between": _round(ss_between),
                "ss_within": _round(ss_within),
                "ss_total": _round(ss_total),
                "population_variance_between": _round(ss_between / n),
                "population_variance_within": _round(ss_within / n),
                "eta_squared": _round(eta),
                "ms_between": ms_between,
                "ms_within": ms_within,
                "f_statistic": f_stat,
                "p_value": p_value,
                "closes": abs((ss_between + ss_within) - ss_total) <= _CLOSE,
            }
        )
    if zero_within:
        notes.append(
            "A factor with no within-group sum of squares has an undefined F. p_value is 0 when the between sum of squares is positive."
        )

    shapley_names = names[:_MAX_DIMENSIONS]
    skipped = names[_MAX_DIMENSIONS:]
    if skipped:
        notes.append(
            "Sun-Shapley and the sequential path use the first 4 dimensions (24 orderings). Further dimensions stay in factors only."
        )

    prefix_ss = 0.0
    prefix: tuple[str, ...] = ()
    steps = []
    for name in shapley_names:
        prefix = (*prefix, name)
        current = ss_of(prefix)
        incremental = current - prefix_ss
        steps.append(
            {
                "dimension": name,
                "ss_incremental": _round(incremental),
                "ss_cumulative": _round(current),
                "share_of_total": _round((incremental / ss_total) if ss_total > _CLOSE else 0.0),
            }
        )
        prefix_ss = current
    sequential_residual = ss_total - prefix_ss
    sequential = {
        "order": list(shapley_names),
        "steps": steps,
        "ss_explained": _round(prefix_ss),
        "ss_residual": _round(sequential_residual),
        "closes": abs((prefix_ss + sequential_residual) - ss_total) <= _CLOSE,
    }

    buckets: dict[str, list[float]] = {name: [] for name in shapley_names}
    used = factorial(len(shapley_names)) if shapley_names else 0
    for perm in permutations(shapley_names):
        running = 0.0
        prefix = ()
        for name in perm:
            prefix = (*prefix, name)
            current = ss_of(prefix)
            buckets[name].append(current - running)
            running = current
    order_invariant = all(
        (max(values) - min(values)) <= 1e-6 for values in buckets.values() if values
    )
    shapley_dimensions = []
    explained = 0.0
    for name in shapley_names:
        values = buckets[name]
        share_ss = sum(values) / len(values) if values else 0.0
        explained += share_ss
        shapley_dimensions.append(
            {
                "dimension": name,
                "ss": _round(share_ss),
                "population_variance": _round(share_ss / n),
                "share_of_total": _round((share_ss / ss_total) if ss_total > _CLOSE else 0.0),
            }
        )
    shapley_residual = ss_total - explained
    notes.append(
        "sun_shapley averages sequential between-group sums of squares over dimension permutations. "
        f"orderings_used is {used}."
    )
    sun_shapley = {
        "method": "sun_shapley",
        "orderings_used": used,
        "order_invariant": order_invariant,
        "dimensions": shapley_dimensions,
        "ss_explained": _round(explained),
        "ss_residual": _round(shapley_residual),
        "closes": abs((explained + shapley_residual) - ss_total) <= _CLOSE,
    }

    interaction = None
    if len(names) == 2:
        ss_a = ss_of((names[0],))
        ss_b = ss_of((names[1],))
        ss_cells = ss_of((names[0], names[1]))
        ss_within_cells = ss_total - ss_cells
        level_sizes = [len({cell["key"][pos] for cell in cells}) for pos in range(2)]
        full_grid = 1
        for size in level_sizes:
            full_grid *= size
        counts = {float(cell["n"]) for cell in cells}
        balanced = len(cells) == full_grid and len(counts) == 1
        if balanced:
            ss_ab = ss_cells - ss_a - ss_b
            interaction = {
                "dimensions": list(names),
                "balanced": True,
                "ss_a": _round(ss_a),
                "ss_b": _round(ss_b),
                "ss_interaction": _round(ss_ab),
                "ss_within": _round(ss_within_cells),
                "ss_total": _round(ss_total),
                "closes": abs((ss_a + ss_b + ss_ab + ss_within_cells) - ss_total) <= _CLOSE,
            }
        else:
            interaction = {
                "dimensions": list(names),
                "balanced": False,
                "ss_a": _round(ss_a),
                "ss_b": _round(ss_b),
                "ss_interaction": None,
                "ss_within": _round(ss_within_cells),
                "ss_total": _round(ss_total),
                "closes": False,
            }
            notes.append(
                "Two-factor interaction sum of squares is reported only for a balanced grid. "
                "An unbalanced interaction stays on two_way_anova Type II."
            )
    elif len(names) > 2:
        notes.append(
            "The balanced two-factor interaction identity is reported only when exactly two dimensions are passed."
        )

    return {
        "method": "law_of_total_variance",
        "dimensions": names,
        "skipped_dimensions": skipped,
        "n": int(n),
        "n_cells": len(cells),
        "mean": _round(sum_y / n),
        "ss_total": _round(ss_total),
        "population_variance": _round(population),
        "sample_variance": _round(sample),
        "factors": factors,
        "sequential": sequential,
        "interaction": interaction,
        "sun_shapley": sun_shapley,
        "notes": notes,
    }


class VarianceDecomposition:
    """Session-table variance split. Large scans can merge hash partitions."""

    @classmethod
    def decompose(
        cls,
        con,
        table_name: str,
        metric: str,
        dimensions: list[str],
        filters: str | None = None,
    ) -> dict[str, Any]:
        clock = Stopwatch()
        if not dimensions:
            raise ValueError("variance decomposition requires at least one dimension")
        if metric in dimensions:
            raise ValueError("variance decomposition metric cannot also be a dimension")

        table_ref = safe_table_ref(table_name)
        metric_sql = safe_ident(metric)
        dim_sql = [safe_ident(name) for name in dimensions]
        predicate = safe_predicate(filters) if filters else None
        null_checks = " AND ".join(
            [f"{metric_sql} IS NOT NULL"] + [f"{column} IS NOT NULL" for column in dim_sql]
        )
        where = null_checks if predicate is None else f"{null_checks} AND ({predicate})"
        filter_where = f" WHERE {predicate}" if predicate else ""
        count_sql = f"SELECT COUNT(*) FROM {table_ref}{filter_where}"
        rows_scanned = int(con.execute(count_sql).fetchone()[0] or 0)

        projection = ", ".join([*dim_sql, f"{metric_sql} AS __y"])
        select_sql = f"SELECT {projection} FROM {table_ref} WHERE {where}"
        group_by = ", ".join(str(i + 1) for i in range(len(dimensions)))
        group_sql = (
            f"SELECT {', '.join(dim_sql)}, COUNT({metric_sql}), SUM({metric_sql}), "
            f"SUM({metric_sql} * {metric_sql}) FROM {table_ref} WHERE {where} GROUP BY {group_by}"
        )

        partition_note = None
        if settings.RAY_ENABLED and rows_scanned >= int(settings.RAY_MIN_ROWS) and rows_scanned > 0:
            cells, partition_note = partitioned_group_moments(
                con, select_sql, dimensions, partition_count()
            )
            sqls = [count_sql, select_sql]
        else:
            rel = con.execute(group_sql)
            cells = []
            width = len(dimensions)
            for row in rel.fetchall():
                n_value = row[width]
                if n_value is None or float(n_value) == 0.0:
                    continue
                cells.append(
                    {
                        "key": tuple(str(row[i]) for i in range(width)),
                        "n": float(n_value),
                        "s": float(row[width + 1] or 0.0),
                        "ss": float(row[width + 2] or 0.0),
                    }
                )
            sqls = [count_sql, group_sql]

        summary = summarize_cells(cells, dimensions)
        notes = list(summary.pop("notes"))
        if partition_note:
            notes.append(partition_note)
        rows_used = int(summary["n"])
        summary["metric"] = metric
        summary["evidence"] = evidence(
            operator="variance_decomposition",
            method="law_of_total_variance",
            sql=sqls,
            rows_scanned=rows_scanned,
            rows_used=rows_used,
            nulls_dropped=rows_scanned - rows_used,
            duration_ms=clock.ms(),
            caveats=notes,
        )
        return summary
