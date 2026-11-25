from typing import Any

import numpy as np
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.stattools import durbin_watson, jarque_bera

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_columns, safe_table_ref

_MAX_REGRESSORS = 40
_MAX_CELLS = 5_000_000


def run_spss_regression(
    session_id: str,
    dataset_name: str,
    dependent_var: str,
    independent_vars: list[str],
    model_type: str = "ols",
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()
    clock = Stopwatch()
    if len(independent_vars) > _MAX_REGRESSORS:
        raise ValueError("请先聚合再回归：自变量超过 40 列。先按业务粒度聚合，再把汇总表送进回归。")

    all_vars = [dependent_var, *independent_vars]
    cols_sql = safe_columns(all_vars)
    sql = f"SELECT {cols_sql} FROM {safe_table_ref(dataset_name)}"
    raw = con.execute(sql).df()
    rows_scanned = len(raw)
    if rows_scanned * (len(independent_vars) + 1) > _MAX_CELLS:
        raise ValueError("请先聚合再回归：扫描单元格超过 5,000,000。先聚合再回归。")
    df = raw.dropna()
    nulls_dropped = rows_scanned - len(df)

    Y = df[dependent_var]
    X_raw = df[independent_vars]
    X = sm.add_constant(X_raw)

    if model_type.lower() == "ols":
        model = sm.OLS(Y, X).fit()

        coefficients = []
        for var_name in model.params.index:
            coef = float(model.params[var_name])
            se = float(model.bse[var_name])
            t_val = float(model.tvalues[var_name])
            p_val = float(model.pvalues[var_name])
            ci_low, ci_high = model.conf_int().loc[var_name]

            if var_name != "const" and np.std(X_raw[var_name]) > 0:
                beta = float(coef * (np.std(X_raw[var_name]) / np.std(Y)))
            else:
                beta = None

            coefficients.append(
                {
                    "variable": var_name,
                    "unstandardized_B": round(coef, 4),
                    "std_error": round(se, 4),
                    "standardized_beta": round(beta, 4) if beta is not None else None,
                    "t_statistic": round(t_val, 4),
                    "p_value": round(p_val, 6),
                    "ci_95_lower": round(float(ci_low), 4),
                    "ci_95_upper": round(float(ci_high), 4),
                    "significant": bool(p_val < 0.05),
                }
            )

        vif_report = []
        if len(independent_vars) > 1:
            for idx, col in enumerate(X_raw.columns):
                try:
                    vif_score = variance_inflation_factor(X_raw.values, idx)
                    vif_report.append(
                        {
                            "variable": col,
                            "vif": round(float(vif_score), 3),
                            "multicollinearity_warning": bool(vif_score > 10.0),
                        }
                    )
                except Exception:
                    pass

        residuals = model.resid
        dw_stat = float(durbin_watson(residuals))
        jb_stat, jb_p, _skew, _kurtosis = jarque_bera(residuals)

        r2 = float(model.rsquared)
        adj_r2 = float(model.rsquared_adj)
        f_stat = float(model.fvalue)
        f_p = float(model.f_pvalue)

        conclusion = (
            f"OLS Regression Model: R² = {r2:.4f}, Adjusted R² = {adj_r2:.4f}, "
            f"F({int(model.df_model)}, {int(model.df_resid)}) = {f_stat:.3f}, p = {f_p:.6f}. "
            f"The overall model is {'statistically significant (p<0.05)' if f_p < 0.05 else 'not statistically significant'}. "
            f"Durbin-Watson residual autocorrelation = {dw_stat:.3f} (~2 indicates no autocorrelation)."
        )

        return {
            "model_type": "OLS Multilinear Regression",
            "r_squared": round(r2, 4),
            "adjusted_r_squared": round(adj_r2, 4),
            "f_statistic": round(f_stat, 4),
            "f_p_value": round(f_p, 6),
            "sample_size": int(model.nobs),
            "degrees_of_freedom_model": int(model.df_model),
            "degrees_of_freedom_resid": int(model.df_resid),
            "coefficients": coefficients,
            "multicollinearity_vif": vif_report,
            "residual_diagnostics": {
                "durbin_watson": round(dw_stat, 4),
                "jarque_bera_stat": round(float(jb_stat), 4),
                "jarque_bera_p": round(float(jb_p), 6),
                "residual_normality": bool(jb_p > 0.05),
            },
            "formal_conclusion": conclusion,
            "rows_used": len(df),
            "nulls_dropped": int(nulls_dropped),
            "evidence": evidence(
                operator="regression",
                method="ols",
                sql=[sql],
                rows_scanned=rows_scanned,
                rows_used=len(df),
                nulls_dropped=int(nulls_dropped),
                duration_ms=clock.ms(),
                caveats=["Coefficients come from statsmodels on the rows that survived dropna."],
            ),
        }

    elif model_type.lower() == "logistic":
        logit_model = sm.Logit(Y, X).fit(disp=False)
        params = logit_model.params
        odds_ratios = np.exp(params)

        coef_list = []
        for var_name in params.index:
            coef_list.append(
                {
                    "variable": var_name,
                    "coef": round(float(params[var_name]), 4),
                    "odds_ratio": round(float(odds_ratios[var_name]), 4),
                    "p_value": round(float(logit_model.pvalues[var_name]), 6),
                    "significant": bool(logit_model.pvalues[var_name] < 0.05),
                }
            )

        return {
            "model_type": "Binary Logistic Regression",
            "pseudo_r_squared": round(float(logit_model.prsquared), 4),
            "llr_p_value": round(float(logit_model.llr_pvalue), 6),
            "coefficients": coef_list,
            "formal_conclusion": f"Binary Logistic Regression: Pseudo R² = {logit_model.prsquared:.4f}, LLR p = {logit_model.llr_pvalue:.6f}.",
            "rows_used": len(df),
            "nulls_dropped": int(nulls_dropped),
            "evidence": evidence(
                operator="regression",
                method="logistic",
                sql=[sql],
                rows_scanned=rows_scanned,
                rows_used=len(df),
                nulls_dropped=int(nulls_dropped),
                duration_ms=clock.ms(),
            ),
        }

    raise ValueError(f"Unsupported model_type: '{model_type}'")
