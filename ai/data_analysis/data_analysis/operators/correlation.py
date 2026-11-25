import math
from typing import Any

import duckdb
from scipy import stats

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.distributed_ops.ray_exec import partition_count, partitioned_pearson_sums
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_columns, safe_ident, safe_table_ref


def _bh_qvalues(p_values: list[float]) -> list[float]:
    """Benjamini-Hochberg q-values, capped at 1, in the input order."""
    m = len(p_values)
    if m == 0:
        return []
    order = sorted(range(m), key=lambda i: p_values[i])
    q = [1.0] * m
    running = 1.0
    for rank_from_end, idx in enumerate(reversed(order)):
        k = m - rank_from_end
        raw = p_values[idx] * m / k
        running = min(running, raw)
        q[idx] = min(1.0, running)
    return q


def _pearson_from_sums(n: int, sx: float, sy: float, sxx: float, syy: float, sxy: float):
    if n < 3:
        return None, None
    num = n * sxy - sx * sy
    den_sq = (n * sxx - sx * sx) * (n * syy - sy * sy)
    if den_sq <= 0:
        return 0.0, 1.0
    r = max(-1.0, min(1.0, num / math.sqrt(den_sq)))
    if abs(r) >= 0.999999:
        return r, 0.0
    t_stat = r * math.sqrt((n - 2) / (1 - r * r))
    p_val = float(2 * stats.t.sf(abs(t_stat), n - 2))
    return r, p_val


_EFFECT_R = 0.1


def _simpson_notes(
    con: duckdb.DuckDBPyConnection,
    table_ref: str,
    columns: list[str],
    quoted: list[str],
    pair_meta: list[dict[str, Any]],
    group_col: str,
) -> list[str]:
    """Flag pairs whose overall Pearson sign disagrees with a within-group sign."""
    notes = []
    g = safe_ident(group_col)
    overall = {(m["col1"], m["col2"]): m["r"] for m in pair_meta}
    for i, c1 in enumerate(columns):
        for j in range(i + 1, len(columns)):
            c2 = columns[j]
            base = overall.get((c1, c2))
            if base is None or abs(base) < _EFFECT_R:
                continue
            qi, qj = quoted[i], quoted[j]
            sql = f"""
            SELECT {g} AS g, COUNT(*) AS n,
                   SUM({qi}) AS sx, SUM({qj}) AS sy,
                   SUM({qi} * {qi}) AS sxx, SUM({qj} * {qj}) AS syy,
                   SUM({qi} * {qj}) AS sxy
            FROM {table_ref}
            WHERE {qi} IS NOT NULL AND {qj} IS NOT NULL AND {g} IS NOT NULL
            GROUP BY 1
            """
            for grp, n, sx, sy, sxx, syy, sxy in con.execute(sql).fetchall():
                if n is None or int(n) < 3:
                    continue
                r_val, _p = _pearson_from_sums(
                    int(n), float(sx), float(sy), float(sxx), float(syy), float(sxy)
                )
                if r_val is None or abs(r_val) < _EFFECT_R:
                    continue
                if (base > 0) != (r_val > 0):
                    notes.append(
                        f"Simpson: overall {c1} vs {c2} r={base:.3f}, but group {grp} r={r_val:.3f} has the opposite sign."
                    )
    return notes


def run_correlation_analysis(
    session_id: str,
    dataset_name: str,
    columns: list[str] | None = None,
    method: str = "pearson",
    group_col: str | None = None,
) -> dict[str, Any]:
    clock = Stopwatch()
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()
    table_ref = safe_table_ref(dataset_name)

    if not columns:
        desc = con.execute(f"DESCRIBE {table_ref}").fetchall()
        columns = [
            r[0]
            for r in desc
            if any(num_t in str(r[1]).lower() for num_t in ["int", "float", "double", "decimal"])
        ]
    if len(columns) < 2:
        raise ValueError("At least 2 numeric columns required for correlation analysis")

    quoted = [safe_ident(c) for c in columns]
    where = " AND ".join(f"{q} IS NOT NULL" for q in quoted)
    raw_n = int(con.execute(f"SELECT COUNT(*) FROM {table_ref}").fetchone()[0])

    method_l = method.lower()
    if method_l == "spearman":
        rank_cols = ", ".join(
            f"RANK() OVER (ORDER BY {q}) AS {safe_ident('_r' + str(i))}"
            for i, q in enumerate(quoted)
        )
        source = f"(SELECT {rank_cols} FROM {table_ref} WHERE {where})"
        work_cols = [f"_r{i}" for i in range(len(columns))]
        work_quoted = [safe_ident(c) for c in work_cols]
        caveat = "Spearman ranks use DuckDB RANK(); tied values do not get average ranks."
    else:
        method_l = "pearson"
        source = f"(SELECT {safe_columns(columns)} FROM {table_ref} WHERE {where})"
        work_quoted = quoted
        caveat = "Pearson r is a linear association. It is not a causal effect."

    select_parts = ["COUNT(*) AS __n"]
    for i, q in enumerate(work_quoted):
        select_parts.append(f"SUM({q}) AS __s{i}")
        select_parts.append(f"SUM({q} * {q}) AS __ss{i}")
        for j in range(i + 1, len(work_quoted)):
            qj = work_quoted[j]
            select_parts.append(f"SUM({q} * {qj}) AS __sp{i}_{j}")
    select_list = ", ".join(select_parts)
    one_scan = f"SELECT {select_list} FROM {source} s"
    sql = one_scan
    partition_note = None
    stats_row = None
    if (
        settings.RAY_ENABLED
        and method_l == "pearson"
        and raw_n >= int(settings.RAY_MIN_ROWS)
        and raw_n > 0
    ):
        try:
            copy_sql = f"SELECT {safe_columns(columns)} FROM {table_ref} WHERE {where}"
            stats_row, partition_note = partitioned_pearson_sums(
                con, copy_sql, columns, partition_count()
            )
            sql = copy_sql
        except Exception as exc:
            partition_note = f"Partition merge failed ({type(exc).__name__}). Used one DuckDB scan."
            stats_row = None
    if stats_row is None:
        rel = con.execute(one_scan)
        stats_row = dict(zip([d[0] for d in rel.description], rel.fetchone(), strict=False))
        sql = one_scan
    n = int(stats_row["__n"] or 0)

    pair_ps: list[float] = []
    pair_meta: list[dict[str, Any]] = []
    matrix = []
    for i, c1 in enumerate(columns):
        row = []
        for j, c2 in enumerate(columns):
            if i == j:
                r_val, p_val = 1.0, 0.0
            else:
                a, b = (i, j) if i < j else (j, i)
                r_val, p_val = _pearson_from_sums(
                    n,
                    float(stats_row[f"__s{a}"]),
                    float(stats_row[f"__s{b}"]),
                    float(stats_row[f"__ss{a}"]),
                    float(stats_row[f"__ss{b}"]),
                    float(stats_row[f"__sp{a}_{b}"]),
                )
                if r_val is None:
                    r_val, p_val = 0.0, 1.0
            row.append({"r": round(float(r_val), 4), "p_value": round(float(p_val), 6)})
            if i < j:
                pair_ps.append(float(p_val))
                pair_meta.append(
                    {"col1": c1, "col2": c2, "r": float(r_val), "p_value": float(p_val)}
                )
        matrix.append(row)

    q_values = _bh_qvalues(pair_ps)
    high_pairs = []
    for meta, q in zip(pair_meta, q_values, strict=False):
        meta["q_value"] = round(q, 6)
        meta["fdr_significant"] = bool(q < 0.05 and abs(meta["r"]) >= _EFFECT_R)
        if abs(meta["r"]) >= 0.7:
            high_pairs.append(
                {
                    "col1": meta["col1"],
                    "col2": meta["col2"],
                    "r": round(meta["r"], 4),
                    "p_value": round(meta["p_value"], 6),
                    "q_value": round(q, 6),
                    "fdr_significant": meta["fdr_significant"],
                    "strength": "Very Strong" if abs(meta["r"]) >= 0.85 else "Strong",
                }
            )

    caveats = [
        caveat,
        "q_value is a Benjamini-Hochberg adjustment across the column pairs in this call.",
        "fdr_significant requires q < 0.05 and |r| >= 0.1.",
    ]
    if partition_note:
        caveats.append(partition_note)
    if group_col and method_l == "pearson":
        caveats.extend(_simpson_notes(con, table_ref, columns, quoted, pair_meta, group_col))
    elif group_col:
        caveats.append("Simpson check runs only for Pearson, on the raw column values.")
    return {
        "columns": columns,
        "method": method_l,
        "matrix": matrix,
        "high_correlation_pairs": high_pairs,
        "multiple_testing": {
            "method": "benjamini_hochberg",
            "n_tests": len(pair_ps),
            "effect_floor_abs_r": _EFFECT_R,
        },
        "sample_size": n,
        "evidence": evidence(
            operator="correlation_analysis",
            method=method_l,
            sql=[sql],
            rows_scanned=raw_n,
            rows_used=n,
            nulls_dropped=raw_n - n,
            duration_ms=clock.ms(),
            caveats=caveats,
        ),
    }
