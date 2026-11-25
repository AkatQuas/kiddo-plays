import math
from typing import Any

import numpy as np
import statsmodels.api as sm
from scipy import stats
from statsmodels.formula.api import ols
from statsmodels.stats.multicomp import pairwise_tukeyhsd

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.distributed_ops.variance_decomp import summarize_cells
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref

# Practical significance. A small p-value alone does not mark a result significant.
_COHENS_D_MIN = 0.2
_ETA_MIN = 0.01
_CRAMERS_V_MIN = 0.1
_MAX_CELLS = 5_000_000


def _pack(payload, *, method, sql, scanned, used, clock, caveats=None):
    payload["evidence"] = evidence(
        operator="hypothesis_test",
        method=method,
        sql=[sql] if isinstance(sql, str) else list(sql),
        rows_scanned=scanned,
        rows_used=used,
        nulls_dropped=(None if scanned is None or used is None else int(scanned) - int(used)),
        duration_ms=clock.ms(),
        caveats=caveats or [],
    )
    return payload


def run_spss_hypothesis_test(
    session_id: str,
    dataset_name: str,
    test_type: str,
    dependent_var: str,
    group_var: str,
    alpha: float = 0.05,
    factor_b: str | None = None,
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()

    clock = Stopwatch()
    test_t = test_type.lower()
    table_ref = safe_table_ref(dataset_name)
    ncols = 3 if test_t == "two_way_anova" else 2
    scanned_guard = int(con.execute(f"SELECT COUNT(*) FROM {table_ref}").fetchone()[0] or 0)
    if scanned_guard * ncols > _MAX_CELLS:
        raise ValueError(
            "请先聚合再检验：扫描单元格超过 5,000,000。先按分组聚合，再把汇总表送进检验。"
        )

    sql = f"SELECT {safe_ident(dependent_var)}, {safe_ident(group_var)} FROM {table_ref}"
    raw = con.execute(sql).df()
    rows_scanned = len(raw)
    df = raw.dropna()
    rows_used = len(df)

    if test_t == "independent_t_test":
        unique_groups = df[group_var].unique()
        if len(unique_groups) != 2:
            raise ValueError(
                f"Independent t-test requires exactly 2 distinct groups, got: {unique_groups}"
            )

        g1_data = df[df[group_var] == unique_groups[0]][dependent_var].values
        g2_data = df[df[group_var] == unique_groups[1]][dependent_var].values

        n1, n2 = len(g1_data), len(g2_data)
        m1, m2 = float(np.mean(g1_data)), float(np.mean(g2_data))
        s1, s2 = float(np.std(g1_data, ddof=1)), float(np.std(g2_data, ddof=1))

        levene_stat, levene_p = stats.levene(g1_data, g2_data)
        equal_var = bool(levene_p > 0.05)

        t_stat, p_val = stats.ttest_ind(g1_data, g2_data, equal_var=equal_var)

        pooled_std = (
            math.sqrt(((n1 - 1) * s1**2 + (n2 - 1) * s2**2) / (n1 + n2 - 2))
            if equal_var
            else math.sqrt((s1**2 + s2**2) / 2)
        )
        cohens_d = (m1 - m2) / pooled_std if pooled_std > 0 else 0.0

        df_val = (
            (n1 + n2 - 2)
            if equal_var
            else (
                (s1**2 / n1 + s2**2 / n2) ** 2
                / ((s1**2 / n1) ** 2 / (n1 - 1) + (s2**2 / n2) ** 2 / (n2 - 1))
            )
        )

        effect_ok = abs(cohens_d) >= _COHENS_D_MIN or pooled_std == 0
        sig = bool(p_val < alpha and effect_ok)
        conclusion = (
            f"Independent Samples T-Test: Group '{unique_groups[0]}' (Mean={m1:.2f}, SD={s1:.2f}) vs "
            f"Group '{unique_groups[1]}' (Mean={m2:.2f}, SD={s2:.2f}). "
            f"Levene's Test (F={levene_stat:.3f}, p={levene_p:.4f}) indicates variances are {'equal' if equal_var else 'unequal'}. "
            f"t({df_val:.1f}) = {t_stat:.3f}, p = {p_val:.4f}, Cohen's d = {cohens_d:.3f}. "
            f"The difference between groups is {'statistically significant (Reject H0)' if sig else 'not statistically significant (Fail to reject H0)'} at alpha={alpha}."
        )

        return _pack(
            {
                "test_name": "Independent Samples T-Test",
                "levene_test": {
                    "statistic": round(float(levene_stat), 4),
                    "p_value": round(float(levene_p), 6),
                    "equal_variance": equal_var,
                },
                "t_statistic": round(float(t_stat), 4),
                "degrees_of_freedom": round(float(df_val), 2),
                "p_value": round(float(p_val), 6),
                "significant": sig,
                "effect_size_cohens_d": round(float(cohens_d), 4),
                "group_descriptives": {
                    str(unique_groups[0]): {"count": n1, "mean": round(m1, 4), "std": round(s1, 4)},
                    str(unique_groups[1]): {"count": n2, "mean": round(m2, 4), "std": round(s2, 4)},
                },
                "formal_conclusion": conclusion,
            },
            method=test_t,
            sql=sql,
            scanned=rows_scanned,
            used=rows_used,
            clock=clock,
            caveats=[]
            if effect_ok
            else ["p is below alpha, but |Cohen's d| is under 0.2, so significant is false."],
        )

    elif test_t == "one_way_anova":
        groups = [group[dependent_var].values for _, group in df.groupby(group_var)]

        if len(groups) < 2:
            raise ValueError("One-way ANOVA requires at least 2 groups")

        f_stat, p_val = stats.f_oneway(*groups)

        all_vals = np.concatenate(groups)
        grand_mean = np.mean(all_vals)
        ss_total = np.sum((all_vals - grand_mean) ** 2)
        ss_between = np.sum([len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups])
        eta_squared = (ss_between / ss_total) if ss_total > 0 else 0.0
        vd_cells = []
        for label, grp in df.groupby(group_var, sort=False):
            arr = np.asarray(grp[dependent_var].to_numpy(), dtype=float)
            vd_cells.append(
                {
                    "key": (str(label),),
                    "n": float(arr.size),
                    "s": float(arr.sum()),
                    "ss": float(np.dot(arr, arr)),
                }
            )
        variance_decomposition = summarize_cells(vd_cells, [group_var])
        vd_notes = variance_decomposition.pop("notes")

        tukey_results = []
        if p_val < alpha and len(groups) > 2:
            tukey = pairwise_tukeyhsd(endog=df[dependent_var], groups=df[group_var], alpha=alpha)
            for row in tukey.summary().data[1:]:
                tukey_results.append(
                    {
                        "group1": str(row[0]),
                        "group2": str(row[1]),
                        "meandiff": round(float(row[2]), 4),
                        "p_adj": round(float(row[3]), 4),
                        "reject_h0": bool(row[5]),
                    }
                )

        effect_ok = eta_squared >= _ETA_MIN
        sig = bool(p_val < alpha and effect_ok)
        conclusion = (
            f"One-Way ANOVA across {len(groups)} levels of '{group_var}': "
            f"F({len(groups) - 1}, {len(all_vals) - len(groups)}) = {f_stat:.3f}, p = {p_val:.6f}, eta_squared = {eta_squared:.3f}. "
            f"The effect of '{group_var}' on '{dependent_var}' is {'statistically significant' if sig else 'not significant'}."
        )

        return _pack(
            {
                "test_name": "One-Way ANOVA",
                "f_statistic": round(float(f_stat), 4),
                "df_between": len(groups) - 1,
                "df_within": len(all_vals) - len(groups),
                "p_value": round(float(p_val), 6),
                "significant": sig,
                "effect_size_eta_squared": round(float(eta_squared), 4),
                "variance_decomposition": variance_decomposition,
                "post_hoc_tukey_hsd": tukey_results,
                "formal_conclusion": conclusion,
            },
            method=test_t,
            sql=sql,
            scanned=rows_scanned,
            used=rows_used,
            clock=clock,
            caveats=(
                []
                if effect_ok
                else ["p is below alpha, but eta squared is under 0.01, so significant is false."]
            )
            + vd_notes,
        )

    elif test_t == "chi_square":
        contingency_table = df.groupby([dependent_var, group_var]).size().unstack(fill_value=0)
        chi2_stat, p_val, dof, _expected = stats.chi2_contingency(contingency_table)

        n = contingency_table.values.sum()
        min_dim = min(contingency_table.shape) - 1
        cramers_v = math.sqrt(chi2_stat / (n * max(1, min_dim))) if n > 0 else 0.0

        effect_ok = cramers_v >= _CRAMERS_V_MIN
        sig = bool(p_val < alpha and effect_ok)
        conclusion = (
            f"Pearson's Chi-Square Test of Independence: chi2({dof}) = {chi2_stat:.3f}, p = {p_val:.6f}, "
            f"Cramér's V = {cramers_v:.3f}. There is {'a significant' if sig else 'no significant'} association "
            f"between '{dependent_var}' and '{group_var}'."
        )

        return _pack(
            {
                "test_name": "Chi-Square Test of Independence",
                "chi2_statistic": round(float(chi2_stat), 4),
                "degrees_of_freedom": int(dof),
                "p_value": round(float(p_val), 6),
                "significant": sig,
                "effect_size_cramers_v": round(float(cramers_v), 4),
                "formal_conclusion": conclusion,
            },
            method=test_t,
            sql=sql,
            scanned=rows_scanned,
            used=rows_used,
            clock=clock,
            caveats=[]
            if effect_ok
            else ["p is below alpha, but Cramér's V is under 0.1, so significant is false."],
        )

    elif test_t == "paired_t_test":
        # dependent_var and group_var are the two paired numeric columns.
        pair_sql = (
            f"SELECT {safe_ident(dependent_var)}, {safe_ident(group_var)} "
            f"FROM {safe_table_ref(dataset_name)}"
        )
        pair_raw = con.execute(pair_sql).df()
        pair = pair_raw.dropna()
        if len(pair) < 2:
            raise ValueError("Paired t-test requires at least 2 complete pairs")
        before = pair[dependent_var].values
        after = pair[group_var].values
        t_stat, p_val = stats.ttest_rel(before, after)
        diff = after - before
        diff_sd = float(np.std(diff, ddof=1))
        d = float(np.mean(diff) / diff_sd) if diff_sd else 0.0
        # A constant non-zero difference has undefined Cohen's d and no residual noise.
        effect_ok = abs(d) >= _COHENS_D_MIN or (diff_sd == 0 and abs(float(np.mean(diff))) > 0)
        sig = bool(p_val < alpha and effect_ok)
        caveats = []
        if diff_sd == 0:
            caveats.append(
                "Paired differences have zero variance, so Cohen's d is undefined. A non-zero constant difference counts as an effect."
            )
        elif not effect_ok:
            caveats.append(
                "p is below alpha, but |Cohen's d| is under 0.2, so significant is false."
            )
        return _pack(
            {
                "test_name": "Paired Samples T-Test",
                "t_statistic": round(float(t_stat), 4),
                "degrees_of_freedom": int(len(pair) - 1),
                "p_value": round(float(p_val), 6),
                "significant": sig,
                "effect_size_cohens_d": round(d, 4),
                "n_pairs": len(pair),
                "formal_conclusion": (
                    f"Paired t-test on '{dependent_var}' vs '{group_var}': "
                    f"t({len(pair) - 1}) = {t_stat:.3f}, p = {p_val:.6f}, Cohen's d = {d:.3f}. "
                    f"The mean difference is {'statistically significant' if sig else 'not statistically significant'}."
                ),
            },
            method=test_t,
            sql=pair_sql,
            scanned=len(pair_raw),
            used=len(pair),
            clock=clock,
            caveats=caveats,
        )

    elif test_t == "two_way_anova":
        if not factor_b:
            raise ValueError("two_way_anova requires factor_b, the second factor column")

        tw_sql = (
            f"SELECT {safe_ident(dependent_var)}, {safe_ident(group_var)}, {safe_ident(factor_b)} "
            f"FROM {safe_table_ref(dataset_name)}"
        )
        tw_raw = con.execute(tw_sql).df()
        work = tw_raw.dropna().rename(columns={dependent_var: "y", group_var: "a", factor_b: "b"})
        if work["a"].nunique() < 2 or work["b"].nunique() < 2:
            raise ValueError("two_way_anova requires at least 2 levels in each factor")
        fitted = ols("y ~ C(a) + C(b) + C(a):C(b)", data=work).fit()
        table = sm.stats.anova_lm(fitted, typ=2)
        ss_resid = float(table.loc["Residual", "sum_sq"]) if "Residual" in table.index else 0.0
        effects = []
        for name, row in table.iterrows():
            if name == "Residual":
                continue
            p = float(row["PR(>F)"])
            ss = float(row["sum_sq"])
            eta = ss / (ss + ss_resid) if (ss + ss_resid) else 0.0
            effects.append(
                {
                    "term": str(name),
                    "f_statistic": round(float(row["F"]), 4) if row["F"] == row["F"] else None,
                    "p_value": round(p, 6),
                    "eta_squared": round(eta, 4),
                    "significant": bool(p < alpha and eta >= _ETA_MIN),
                }
            )
        sig = any(e["significant"] for e in effects)
        tw_cells = []
        for (level_a, level_b), grp in work.groupby(["a", "b"], sort=False):
            arr = grp["y"].to_numpy(dtype=float)
            tw_cells.append(
                {
                    "key": (str(level_a), str(level_b)),
                    "n": float(arr.size),
                    "s": float(arr.sum()),
                    "ss": float(np.dot(arr, arr)),
                }
            )
        variance_decomposition = summarize_cells(tw_cells, [group_var, factor_b])
        vd_notes = variance_decomposition.pop("notes")
        return _pack(
            {
                "test_name": "Two-Way ANOVA",
                "p_value": min(e["p_value"] for e in effects) if effects else 1.0,
                "significant": sig,
                "effects": effects,
                "variance_decomposition": variance_decomposition,
                "n": len(work),
                "formal_conclusion": (
                    f"Two-way ANOVA of '{dependent_var}' on '{group_var}' and '{factor_b}'. "
                    + " ".join(f"{e['term']} p={e['p_value']}" for e in effects)
                ),
            },
            method=test_t,
            sql=tw_sql,
            scanned=len(tw_raw),
            used=len(work),
            clock=clock,
            caveats=[
                "Each term is significant only when p < alpha and partial eta squared is at least 0.01.",
                *vd_notes,
            ],
        )

    elif test_t == "mann_whitney":
        unique_groups = df[group_var].unique()
        if len(unique_groups) != 2:
            raise ValueError(
                f"Mann-Whitney requires exactly 2 distinct groups, got: {list(unique_groups)}"
            )
        g1 = df[df[group_var] == unique_groups[0]][dependent_var].values
        g2 = df[df[group_var] == unique_groups[1]][dependent_var].values
        stat_val, p_val = stats.mannwhitneyu(g1, g2, alternative="two-sided")
        n1, n2 = len(g1), len(g2)
        # Rank-biserial correlation. |r| >= 0.1 is the same practical floor used for Pearson r.
        r_rb = 1 - (2 * float(stat_val)) / (n1 * n2) if n1 and n2 else 0.0
        effect_ok = abs(r_rb) >= 0.1
        sig = bool(p_val < alpha and effect_ok)

        return _pack(
            {
                "test_name": "Mann-Whitney U Test (Non-parametric)",
                "u_statistic": round(float(stat_val), 4),
                "p_value": round(float(p_val), 6),
                "significant": sig,
                "effect_size_rank_biserial": round(float(r_rb), 4),
                "formal_conclusion": f"Mann-Whitney U = {stat_val:.2f}, p = {p_val:.6f}. Differences are {'significant' if sig else 'not significant'}.",
            },
            method=test_t,
            sql=sql,
            scanned=rows_scanned,
            used=rows_used,
            clock=clock,
            caveats=[]
            if effect_ok
            else ["p is below alpha, but |rank-biserial r| is under 0.1, so significant is false."],
        )

    raise ValueError(f"Unsupported test_type: '{test_type}'")
