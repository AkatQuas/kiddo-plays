from typing import Any

import duckdb

from data_analysis.distributed_ops.sun_shapley import average_member_diffs, two_factor_shapley
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_ident, safe_predicate, safe_table_ref

_ALLOWED_AGG = {"SUM", "AVG", "COUNT", "MIN", "MAX"}


class DistributedDriverAnalysis:
    """Hierarchical fluctuation breakdown.

    SUM metrics use an additive contribution that closes: at every level the
    child diffs sum to the parent diff. The hierarchy follows the caller order.
    sun_shapley is a separate average: two factor orders for rate x volume, and
    dimension permutations for an additive SUM. A ratio of rate and volume also
    keeps the Laspeyres split (volume, rate, interaction).
    """

    @classmethod
    def analyze_driver(
        cls,
        con: duckdb.DuckDBPyConnection,
        table_name: str,
        target_metric: str,
        dimension_path: list[str],
        base_filter: str,
        current_filter: str,
        agg_func: str = "SUM",
        top_k: int = 5,
        rate_col: str | None = None,
        volume_col: str | None = None,
    ) -> dict[str, Any]:
        clock = Stopwatch()
        if rate_col and volume_col:
            return cls._laspeyres(
                con,
                table_name,
                target_metric,
                dimension_path,
                base_filter,
                current_filter,
                top_k,
                rate_col,
                volume_col,
                clock,
            )

        func = agg_func.upper()
        if func not in _ALLOWED_AGG:
            raise ValueError(f"Unsupported aggregation function '{agg_func}'")
        table_ref = safe_table_ref(table_name)
        metric_col = safe_ident(target_metric)
        base_filter = safe_predicate(base_filter)
        current_filter = safe_predicate(current_filter)

        base_total_sql = f"SELECT {func}({metric_col}) FROM {table_ref} WHERE {base_filter}"
        curr_total_sql = f"SELECT {func}({metric_col}) FROM {table_ref} WHERE {current_filter}"
        base_total = float(con.execute(base_total_sql).fetchone()[0] or 0.0)
        curr_total = float(con.execute(curr_total_sql).fetchone()[0] or 0.0)
        diff_total = curr_total - base_total
        growth_rate = (diff_total / abs(base_total)) * 100 if base_total != 0 else 0.0

        method = "additive_contribution" if func == "SUM" else "level_comparison"
        caveats: list[str] = [
            "orderings_used is 1. The hierarchy follows the caller dimension order."
        ]
        if func != "SUM":
            caveats.append(
                f"{func} is not an additive partition. contribution_ratio is a level comparison, not a closed breakdown."
            )

        hierarchy = []
        sqls = [base_total_sql, curr_total_sql]
        for depth, dim in enumerate(dimension_path):
            current_dims = dimension_path[: depth + 1]
            dim_cols = ", ".join(safe_ident(d) for d in current_dims)
            join_cond = " AND ".join(
                f"c.{safe_ident(d)} IS NOT DISTINCT FROM b.{safe_ident(d)}" for d in current_dims
            )
            coalesce_cols = ", ".join(
                f"COALESCE(c.{safe_ident(d)}, b.{safe_ident(d)}) AS {safe_ident(d)}"
                for d in current_dims
            )
            sql = f"""
            WITH base_agg AS (
                SELECT {dim_cols}, {func}({metric_col}) AS base_val
                FROM {table_ref}
                WHERE {base_filter}
                GROUP BY {dim_cols}
            ),
            curr_agg AS (
                SELECT {dim_cols}, {func}({metric_col}) AS curr_val
                FROM {table_ref}
                WHERE {current_filter}
                GROUP BY {dim_cols}
            )
            SELECT {coalesce_cols},
                   COALESCE(b.base_val, 0) AS base_v,
                   COALESCE(c.curr_val, 0) AS curr_v,
                   COALESCE(c.curr_val, 0) - COALESCE(b.base_val, 0) AS diff_v
            FROM curr_agg c
            FULL OUTER JOIN base_agg b ON {join_cond}
            ORDER BY ABS(diff_v) DESC
            """
            sqls.append(sql)
            rows = con.execute(sql).fetchall()
            layer_items = []
            for row in rows:
                labels = [str(row[i]) for i in range(len(current_dims))]
                bv, cv, dv = float(row[-3]), float(row[-2]), float(row[-1])
                ratio = (dv / diff_total) if diff_total != 0 else 0.0
                layer_items.append(
                    {
                        "dimension": dim,
                        "dimension_value": labels[-1] if len(labels) == 1 else " / ".join(labels),
                        "dimension_path": dict(zip(current_dims, labels, strict=False)),
                        "base_value": round(bv, 2),
                        "current_value": round(cv, 2),
                        "diff_value": round(dv, 2),
                        "contribution_ratio": round(ratio, 4),
                        "contribution_percentage": round(ratio * 100, 2),
                        "is_positive_driver": dv > 0,
                    }
                )
            diff_sum = round(sum(item["diff_value"] for item in layer_items), 2)
            closes = func == "SUM" and abs(diff_sum - round(diff_total, 2)) < 0.05
            if func == "SUM" and not closes:
                caveats.append(
                    f"Level '{dim}' diff sum {diff_sum} does not match total diff {round(diff_total, 2)}."
                )
            hierarchy.append(
                {
                    "dimension_level": dim,
                    "all_branches_count": len(layer_items),
                    "diff_sum": diff_sum,
                    "closes": closes,
                    "top_positive_drivers": [
                        item for item in layer_items if item["diff_value"] > 0
                    ][:top_k],
                    "top_negative_drivers": [
                        item for item in layer_items if item["diff_value"] < 0
                    ][:top_k],
                    "branches": layer_items[: top_k * 2],
                }
            )

        sun_shapley = None
        if func == "SUM" and dimension_path:
            sun_shapley = cls._sum_sun_shapley(
                con,
                table_ref,
                metric_col,
                dimension_path,
                base_filter,
                current_filter,
                func,
                diff_total,
                sqls,
                caveats,
            )

        return {
            "target_metric": target_metric,
            "method": method,
            "base_total": round(base_total, 2),
            "current_total": round(curr_total, 2),
            "diff_total": round(diff_total, 2),
            "growth_rate_pct": round(growth_rate, 2),
            "orderings_used": 1,
            "sun_shapley": sun_shapley,
            "hierarchy": hierarchy,
            "evidence": evidence(
                operator="driver_attribution_analysis",
                method=method,
                sql=sqls,
                duration_ms=clock.ms(),
                caveats=caveats,
            ),
        }

    @classmethod
    def _sum_sun_shapley(
        cls,
        con,
        table_ref,
        metric_col,
        dimension_path,
        base_filter,
        current_filter,
        func,
        diff_total,
        sqls,
        caveats,
    ) -> dict[str, Any]:
        member_diffs: dict[str, dict[str, float]] = {}
        for dim in dimension_path:
            grouped, grouped_sql = cls._grouped_diffs(
                con, table_ref, metric_col, dim, base_filter, current_filter, func
            )
            member_diffs[dim] = grouped
            sqls.append(grouped_sql)
        averaged, used, skipped = average_member_diffs(member_diffs)
        if skipped:
            caveats.append(
                "Sun-Shapley enumerated the first 4 dimensions (24 orderings). Further dimensions stay in the hierarchy only."
            )
        invariant = True
        dimensions = []
        for dim, values in averaged.items():
            branches = []
            for value, diff in sorted(values.items(), key=lambda item: abs(item[1]), reverse=True):
                raw = member_diffs[dim].get(value, 0.0)
                if abs(diff - raw) > 1e-6:
                    invariant = False
                ratio = (diff / diff_total) if diff_total else 0.0
                branches.append(
                    {
                        "dimension_value": value,
                        "diff_value": round(diff, 2),
                        "contribution_ratio": round(ratio, 4),
                    }
                )
            dimensions.append({"dimension": dim, "branches": branches[:50]})
        caveats.append(
            "sun_shapley averages an additive SUM over dimension permutations. "
            f"orderings_used is {used}. A pure SUM member diff does not depend on order, so the average equals the standalone diff."
            if invariant
            else "sun_shapley averages an additive SUM over dimension permutations. "
            f"orderings_used is {used}."
        )
        return {
            "method": "sun_shapley",
            "orderings_used": used,
            "order_invariant": invariant,
            "dimensions": dimensions,
        }

    @classmethod
    def _grouped_diffs(cls, con, table_ref, metric_col, dim, base_filter, current_filter, func):
        dim_sql = safe_ident(dim)
        sql = f"""
        WITH base_agg AS (
            SELECT {dim_sql} AS dim_val, {func}({metric_col}) AS base_val
            FROM {table_ref} WHERE {base_filter} GROUP BY 1
        ),
        curr_agg AS (
            SELECT {dim_sql} AS dim_val, {func}({metric_col}) AS curr_val
            FROM {table_ref} WHERE {current_filter} GROUP BY 1
        )
        SELECT COALESCE(c.dim_val, b.dim_val),
               COALESCE(c.curr_val, 0) - COALESCE(b.base_val, 0)
        FROM curr_agg c
        FULL OUTER JOIN base_agg b ON c.dim_val IS NOT DISTINCT FROM b.dim_val
        """
        rows = con.execute(sql).fetchall()
        return {str(value): float(diff or 0.0) for value, diff in rows}, sql

    @classmethod
    def _laspeyres(
        cls,
        con,
        table_name,
        target_metric,
        dimension_path,
        base_filter,
        current_filter,
        top_k,
        rate_col,
        volume_col,
        clock,
    ) -> dict[str, Any]:
        """Δ(rate*volume) = p0*Δq + q0*Δp + Δp*Δq, summed over the first dimension."""
        if not dimension_path:
            raise ValueError("Laspeyres decomposition requires a dimension")
        dim = dimension_path[0]
        table_ref = safe_table_ref(table_name)
        rate = safe_ident(rate_col)
        volume = safe_ident(volume_col)
        dim_sql = safe_ident(dim)
        base_filter = safe_predicate(base_filter)
        current_filter = safe_predicate(current_filter)
        sql = f"""
        WITH base_agg AS (
            SELECT {dim_sql} AS dim_val,
                   SUM({rate} * {volume}) / NULLIF(SUM({volume}), 0) AS p0,
                   SUM({volume}) AS q0,
                   SUM({rate} * {volume}) AS v0
            FROM {table_ref} WHERE {base_filter} GROUP BY 1
        ),
        curr_agg AS (
            SELECT {dim_sql} AS dim_val,
                   SUM({rate} * {volume}) / NULLIF(SUM({volume}), 0) AS p1,
                   SUM({volume}) AS q1,
                   SUM({rate} * {volume}) AS v1
            FROM {table_ref} WHERE {current_filter} GROUP BY 1
        )
        SELECT COALESCE(c.dim_val, b.dim_val),
               COALESCE(b.v0, 0), COALESCE(c.v1, 0),
               COALESCE(b.p0, 0), COALESCE(c.p1, 0),
               COALESCE(b.q0, 0), COALESCE(c.q1, 0)
        FROM curr_agg c
        FULL OUTER JOIN base_agg b ON c.dim_val IS NOT DISTINCT FROM b.dim_val
        """
        rows = con.execute(sql).fetchall()
        items = []
        base_total = curr_total = 0.0
        shapley_volume_total = shapley_rate_total = 0.0
        caveats = [
            "Laspeyres split is an accounting identity for rate x volume, not a causal effect.",
            "structure_effect is the price-volume cross term. orderings_used is 1 for that Laspeyres view.",
            "sun_shapley averages the two factor orders and splits the cross term evenly. orderings_used there is 2.",
            "This split uses the first dimension only. Later names are not drilled.",
        ]
        for dim_val, v0, v1, p0, p1, q0, q1 in rows:
            v0, v1, p0, p1, q0, q1 = map(float, (v0, v1, p0, p1, q0, q1))
            volume_effect = p0 * (q1 - q0)
            rate_effect = q0 * (p1 - p0)
            interaction = (p1 - p0) * (q1 - q0)
            shapley_volume, shapley_rate = two_factor_shapley(p0, p1, q0, q1)
            shapley_volume_total += shapley_volume
            shapley_rate_total += shapley_rate
            items.append(
                {
                    "dimension": dim,
                    "dimension_value": str(dim_val),
                    "base_value": round(v0, 2),
                    "current_value": round(v1, 2),
                    "diff_value": round(v1 - v0, 2),
                    "volume_effect": round(volume_effect, 2),
                    "rate_effect": round(rate_effect, 2),
                    "interaction_effect": round(interaction, 2),
                    "structure_effect": round(interaction, 2),
                    "shapley_volume_effect": round(shapley_volume, 2),
                    "shapley_rate_effect": round(shapley_rate, 2),
                    "is_positive_driver": (v1 - v0) > 0,
                }
            )
            base_total += v0
            curr_total += v1
        diff_total = curr_total - base_total
        for item in items:
            ratio = (item["diff_value"] / diff_total) if diff_total else 0.0
            item["contribution_ratio"] = round(ratio, 4)
            item["contribution_percentage"] = round(ratio * 100, 2)
        items.sort(key=lambda it: abs(it["diff_value"]), reverse=True)
        sun_shapley = {
            "method": "sun_shapley",
            "orderings_used": 2,
            "factors": ["volume", "rate"],
            "volume_effect": round(shapley_volume_total, 2),
            "rate_effect": round(shapley_rate_total, 2),
            "closes": abs((shapley_volume_total + shapley_rate_total) - diff_total) < 0.05,
        }
        return {
            "target_metric": target_metric,
            "method": "laspeyres_rate_volume",
            "base_total": round(base_total, 2),
            "current_total": round(curr_total, 2),
            "diff_total": round(diff_total, 2),
            "growth_rate_pct": round((diff_total / abs(base_total)) * 100, 2)
            if base_total
            else 0.0,
            "orderings_used": 1,
            "sun_shapley": sun_shapley,
            "hierarchy": [
                {
                    "dimension_level": dim,
                    "all_branches_count": len(items),
                    "diff_sum": round(sum(it["diff_value"] for it in items), 2),
                    "closes": abs(sum(it["diff_value"] for it in items) - diff_total) < 0.05,
                    "top_positive_drivers": [it for it in items if it["diff_value"] > 0][:top_k],
                    "top_negative_drivers": [it for it in items if it["diff_value"] < 0][:top_k],
                    "branches": items[: top_k * 2],
                }
            ],
            "evidence": evidence(
                operator="driver_attribution_analysis",
                method="laspeyres_rate_volume",
                sql=[sql],
                duration_ms=clock.ms(),
                caveats=caveats,
            ),
        }
