from typing import Any

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.engine.evidence import Stopwatch, evidence
from data_analysis.engine.sql_guard import safe_ident, safe_table_ref


def run_timeseries_forecast(
    session_id: str,
    dataset_name: str,
    time_col: str,
    value_col: str,
    horizon: int = 12,
    model_type: str = "arima",
) -> dict[str, Any]:
    mgr = SessionManager()
    sess = mgr.get_session(session_id)
    if not sess:
        raise ValueError(f"Session '{session_id}' not found")
    con = sess.get_duckdb_conn()

    clock = Stopwatch()
    val_ref = safe_ident(value_col)
    sql = f"""
    SELECT {safe_ident(time_col)}, SUM({val_ref}) AS val
    FROM {safe_table_ref(dataset_name)}
    WHERE {val_ref} IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
    """
    df = con.execute(sql).df()
    vals, calendar = _calendar_spine(df, time_col)
    rows_scanned = int(
        con.execute(f"SELECT COUNT(*) FROM {safe_table_ref(dataset_name)}").fetchone()[0]
    )

    if len(vals) < 10:
        raise ValueError("At least 10 historical time-points required for forecasting")

    forecast_items = []
    if model_type.lower() == "arima":
        model = ARIMA(vals, order=(1, 1, 1)).fit()
        forecast_res = model.get_forecast(steps=horizon)
        predicted_mean = forecast_res.predicted_mean
        conf_int = forecast_res.conf_int(alpha=0.05)

        for h in range(horizon):
            forecast_items.append(
                {
                    "step": h + 1,
                    "predicted_value": round(float(predicted_mean[h]), 2),
                    "ci_95_lower": round(float(conf_int[h, 0]), 2),
                    "ci_95_upper": round(float(conf_int[h, 1]), 2),
                }
            )
    else:
        model = ExponentialSmoothing(vals, trend="add").fit()
        preds = model.forecast(horizon)
        std_err = np.std(model.resid)
        for h in range(horizon):
            forecast_items.append(
                {
                    "step": h + 1,
                    "predicted_value": round(float(preds[h]), 2),
                    "ci_95_lower": round(float(preds[h] - 1.96 * std_err), 2),
                    "ci_95_upper": round(float(preds[h] + 1.96 * std_err), 2),
                }
            )

    holdout = _holdout_comparison(vals, model_type, calendar.get("seasonal_period"))
    caveats = [
        "The published forecast is fit on the series passed to the model. ARIMA order (1,1,1) is one model, compared with a naive baseline on a trailing holdout.",
    ]
    if calendar.get("status") == "ok":
        caveats.append(
            f"Calendar gaps filled with 0 before fitting: {calendar.get('missing_periods')} missing {calendar.get('step')}."
        )
    else:
        caveats.append(
            "Time column is not a regular calendar. Gaps were not counted and no calendar spine was built."
        )
    if holdout.get("beats_naive") is False:
        caveats.append("ARIMA does not beat the last-value naive forecast on this holdout.")
    if holdout.get("beats_seasonal_naive") is False:
        caveats.append("ARIMA does not beat the seasonal naive forecast on this holdout.")
    return {
        "time_col": time_col,
        "value_col": value_col,
        "model": model_type,
        "horizon_steps": horizon,
        "forecasts": forecast_items,
        "holdout": holdout,
        "calendar": calendar,
        "historical_preview": [
            {"time": str(df[time_col].iloc[i]), "value": round(float(df["val"].iloc[i]), 2)}
            for i in range(min(15, len(df)))
        ],
        "evidence": evidence(
            operator="timeseries_forecast",
            method=model_type,
            sql=[sql],
            rows_scanned=rows_scanned,
            rows_used=len(vals),
            duration_ms=clock.ms(),
            caveats=caveats,
        ),
    }


def _calendar_spine(df, time_col: str):
    """Return model values and a calendar report.

    Numeric time keys stay as observed. Date-like keys are laid on a daily or
    monthly spine, and missing periods become 0 so the gap is visible to the model.
    """
    observed = np.asarray(df["val"].values, dtype=float)
    report = {
        "status": "not_a_date",
        "missing_periods": None,
        "seasonal_period": None,
        "step": None,
    }
    series = df[time_col]
    if pd.api.types.is_numeric_dtype(series):
        return observed, report
    parsed = pd.to_datetime(series, errors="coerce")
    if parsed.isna().mean() > 0.2:
        return observed, report
    frame = pd.DataFrame({"t": parsed, "v": observed}).dropna(subset=["t"])
    if len(frame) < 3:
        return observed, report
    deltas = frame["t"].sort_values().diff().dt.total_seconds().dropna()
    if deltas.empty:
        return observed, report
    med = float(deltas.median())
    day = 86400.0
    if 0.8 * day <= med <= 1.5 * day:
        step, period, freq = "day", 7, "D"
    elif 27 * day <= med <= 32 * day:
        step, period, freq = "month", 12, "M"
    else:
        report["status"] = "irregular"
        report["median_step_seconds"] = round(med, 1)
        return observed, report
    if freq == "M":
        frame["key"] = frame["t"].dt.to_period("M")
        full = pd.period_range(frame["key"].min(), frame["key"].max(), freq="M")
    else:
        frame["key"] = frame["t"].dt.normalize()
        full = pd.date_range(frame["key"].min(), frame["key"].max(), freq="D")
    spined = frame.groupby("key")["v"].sum().reindex(full, fill_value=0.0)
    missing = int(len(full) - frame["key"].nunique())
    report = {
        "status": "ok",
        "missing_periods": missing,
        "seasonal_period": period,
        "step": step,
        "spine_points": len(spined),
    }
    return np.asarray(spined.values, dtype=float), report


def _mape(actual, predicted) -> float:
    errs = []
    for a, p in zip(actual, predicted, strict=False):
        if a == 0:
            continue
        errs.append(abs((a - p) / a))
    return float(np.mean(errs)) if errs else 0.0


def _holdout_comparison(vals, model_type: str, seasonal_period: int | None) -> dict[str, Any]:
    """Score the model on a trailing holdout against last-value and seasonal naive forecasts."""
    hold = max(1, len(vals) // 5)
    if len(vals) - hold < 10:
        return {"status": "skipped", "reason": "Not enough history to hold out and refit."}
    train, test = vals[:-hold], vals[-hold:]
    naive = np.repeat(train[-1], hold)
    try:
        if model_type.lower() == "arima":
            fitted = ARIMA(train, order=(1, 1, 1)).fit()
            pred = np.asarray(fitted.forecast(hold), dtype=float)
        else:
            fitted = ExponentialSmoothing(train, trend="add").fit()
            pred = np.asarray(fitted.forecast(hold), dtype=float)
    except Exception as exc:
        return {"status": "failed", "reason": str(exc)}
    model_mape = _mape(test, pred)
    naive_mape = _mape(test, naive)
    seasonal_mape = None
    beats_seasonal = None
    if seasonal_period and 1 < seasonal_period <= len(train):
        seasonal = np.array(
            [train[len(train) - seasonal_period + (i % seasonal_period)] for i in range(hold)],
            dtype=float,
        )
        seasonal_mape = _mape(test, seasonal)
        beats_seasonal = bool(model_mape < seasonal_mape)
    caveat = "The returned forecast is fit on the full series. MAPE is from a trailing holdout."
    if model_mape >= naive_mape:
        caveat += " The model does not beat the last-value naive forecast on this holdout."
    if beats_seasonal is False:
        caveat += " The model does not beat the seasonal naive forecast on this holdout."
    return {
        "status": "ok",
        "holdout_points": int(hold),
        "model_mape": round(model_mape, 4),
        "naive_mape": round(naive_mape, 4),
        "seasonal_naive_mape": None if seasonal_mape is None else round(seasonal_mape, 4),
        "seasonal_period": seasonal_period,
        "beats_naive": bool(model_mape < naive_mape),
        "beats_seasonal_naive": beats_seasonal,
        "caveat": caveat,
    }
