from __future__ import annotations

from dataclasses import dataclass

import lightgbm as lgb
import numpy as np
import pandas as pd

from pipeline.features import add_supervised_features, build_future_feature_row
from pipeline.io import V7Config


EPS = 1e-9


@dataclass
class ModelBundle:
    selected_model: str
    lightgbm_model: lgb.LGBMRegressor | None
    feature_cols: list[str]
    residual_q10: float
    residual_q90: float
    leaderboard: pd.DataFrame


def metrics_frame(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["abs_error"] = (df["actual"] - df["prediction"]).abs()
    df["error"] = df["prediction"] - df["actual"]
    return df


def aggregate_metrics(eval_rows: pd.DataFrame, model_col: str = "model") -> pd.DataFrame:
    if eval_rows.empty:
        return pd.DataFrame(columns=[model_col, "rows", "materials", "WAPE", "MAE", "RMSE", "Bias", "under_forecast_rate"])
    out = []
    for model, g in eval_rows.groupby(model_col):
        actual_sum = max(float(g["actual"].abs().sum()), EPS)
        err = g["prediction"] - g["actual"]
        out.append(
            {
                model_col: model,
                "rows": int(len(g)),
                "materials": int(g["material_id"].nunique()),
                "WAPE": float((g["actual"] - g["prediction"]).abs().sum() / actual_sum),
                "MAE": float((g["actual"] - g["prediction"]).abs().mean()),
                "RMSE": float(np.sqrt(np.mean(np.square(err)))),
                "Bias": float(err.sum() / actual_sum),
                "under_forecast_rate": float((g["prediction"] < g["actual"]).mean()),
            }
        )
    return pd.DataFrame(out).sort_values("WAPE")


def _croston_sba(history: list[float], alpha: float = 0.1) -> float:
    values = [float(x) for x in history]
    nonzero = [(i, v) for i, v in enumerate(values) if v > 0]
    if not nonzero:
        return 0.0
    demand = nonzero[0][1]
    interval = max(nonzero[0][0] + 1, 1)
    last_idx = nonzero[0][0]
    for idx, val in nonzero[1:]:
        demand = alpha * val + (1 - alpha) * demand
        interval = alpha * (idx - last_idx) + (1 - alpha) * interval
        last_idx = idx
    return max(0.0, (1 - alpha / 2) * demand / max(interval, EPS))


def _baseline_prediction(history: list[float], model: str) -> float:
    if not history:
        return 0.0
    if model == "seasonal_naive":
        return float(history[-12]) if len(history) >= 12 else float(history[-1])
    if model == "moving_avg_3":
        return float(np.mean(history[-3:]))
    if model == "moving_avg_6":
        return float(np.mean(history[-6:]))
    if model == "croston_sba":
        return _croston_sba(history)
    raise ValueError(f"unknown baseline model: {model}")


def evaluate_baselines(panel: pd.DataFrame, cfg: V7Config) -> tuple[pd.DataFrame, pd.DataFrame]:
    rows: list[dict] = []
    if panel.empty:
        return pd.DataFrame(), pd.DataFrame()
    panel = panel.copy()
    panel["month"] = pd.to_datetime(panel["month"]).dt.to_period("M").dt.to_timestamp()
    cutoff_months = sorted(panel["month"].unique())[-cfg.backtest_months:]
    models = ["seasonal_naive", "moving_avg_3", "moving_avg_6", "croston_sba"]
    for material_id, g in panel.groupby("material_id"):
        g = g.sort_values("month")
        meta = g.iloc[-1][["material_code", "description", "material_type"]].to_dict()
        for month in cutoff_months:
            hist = g[g["month"] < month]["demand_units"].astype(float).tolist()
            actual_rows = g[g["month"] == month]
            if len(hist) < cfg.history_min_months or actual_rows.empty:
                continue
            actual = float(actual_rows["demand_units"].iloc[0])
            for model in models:
                rows.append(
                    {
                        "model": model,
                        "material_id": material_id,
                        **meta,
                        "month": month,
                        "actual": actual,
                        "prediction": _baseline_prediction(hist, model),
                    }
                )
    eval_rows = metrics_frame(rows)
    return eval_rows, aggregate_metrics(eval_rows)


def evaluate_lightgbm(panel: pd.DataFrame, cfg: V7Config) -> tuple[pd.DataFrame, pd.DataFrame, lgb.LGBMRegressor | None, list[str]]:
    supervised, feature_cols = add_supervised_features(panel)
    if supervised.empty:
        return pd.DataFrame(), pd.DataFrame(), None, feature_cols
    supervised["target_month"] = supervised.groupby("material_id")["month"].shift(-1)
    cutoff_months = sorted(panel["month"].unique())[-cfg.backtest_months:]
    test_start = pd.to_datetime(cutoff_months[0])
    train = supervised[supervised["month"] < test_start].copy()
    test = supervised[supervised["month"] >= test_start - pd.offsets.MonthBegin(1)].copy()
    test = test[test["target"].notna()]
    if train.empty or test.empty:
        return pd.DataFrame(), pd.DataFrame(), None, feature_cols
    model = lgb.LGBMRegressor(
        objective="regression",
        metric="rmse",
        learning_rate=0.04,
        n_estimators=250,
        num_leaves=31,
        max_depth=8,
        min_child_samples=10,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.1,
        reg_lambda=0.2,
        random_state=42,
        n_jobs=2,
        verbose=-1,
    )
    model.fit(train[feature_cols], np.log1p(train["target"].astype(float)))
    pred = np.expm1(model.predict(test[feature_cols]))
    pred = np.clip(pred, 0, None)
    rows = test[["material_id", "material_code", "description", "material_type", "month", "target"]].copy()
    rows = rows.rename(columns={"target": "actual"})
    rows["model"] = "lightgbm_global_rm_pm"
    rows["prediction"] = pred
    eval_rows = metrics_frame(rows.to_dict(orient="records"))
    return eval_rows, aggregate_metrics(eval_rows), model, feature_cols


def train_final_lightgbm(panel: pd.DataFrame, feature_cols: list[str]) -> lgb.LGBMRegressor | None:
    supervised, inferred_cols = add_supervised_features(panel)
    cols = feature_cols or inferred_cols
    if supervised.empty or not cols:
        return None
    model = lgb.LGBMRegressor(
        objective="regression",
        metric="rmse",
        learning_rate=0.04,
        n_estimators=300,
        num_leaves=31,
        max_depth=8,
        min_child_samples=10,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.1,
        reg_lambda=0.2,
        random_state=42,
        n_jobs=2,
        verbose=-1,
    )
    model.fit(supervised[cols], np.log1p(supervised["target"].astype(float)))
    return model


def choose_model(
    baseline_eval: pd.DataFrame,
    baseline_leaderboard: pd.DataFrame,
    lgb_eval: pd.DataFrame,
    lgb_leaderboard: pd.DataFrame,
    lgb_model: lgb.LGBMRegressor | None,
    feature_cols: list[str],
) -> ModelBundle:
    combined = pd.concat([baseline_leaderboard, lgb_leaderboard], ignore_index=True)
    if not combined.empty:
        combined = combined.sort_values("WAPE").reset_index(drop=True)
    if combined.empty:
        return ModelBundle("moving_avg_6", None, feature_cols, -0.2, 0.2, combined)
    selected = str(combined.iloc[0]["model"])
    residual_source = lgb_eval if selected == "lightgbm_global_rm_pm" else baseline_eval[baseline_eval["model"].eq(selected)]
    if residual_source.empty:
        q10, q90 = -0.2, 0.2
    else:
        denom = residual_source["actual"].abs().replace(0, np.nan)
        rel_err = ((residual_source["prediction"] - residual_source["actual"]) / denom).replace([np.inf, -np.inf], np.nan).dropna()
        q10 = float(rel_err.quantile(0.10)) if not rel_err.empty else -0.2
        q90 = float(rel_err.quantile(0.90)) if not rel_err.empty else 0.2
        q10 = min(q10, -0.05)
        q90 = max(q90, 0.05)
    return ModelBundle(selected, lgb_model if selected == "lightgbm_global_rm_pm" else None, feature_cols, q10, q90, combined)


def generate_forecast(panel: pd.DataFrame, bundle: ModelBundle, cfg: V7Config) -> pd.DataFrame:
    if panel.empty:
        return pd.DataFrame()
    panel = panel.copy()
    panel["month"] = pd.to_datetime(panel["month"]).dt.to_period("M").dt.to_timestamp()
    _, feature_cols = add_supervised_features(panel)
    code_enc = {v: i for i, v in enumerate(sorted(panel["material_code"].astype(str).unique()))}
    type_enc = {v: i for i, v in enumerate(sorted(panel["material_type"].astype(str).unique()))}
    max_month = panel["month"].max()
    future_months = pd.period_range(max_month + pd.offsets.MonthBegin(1), periods=cfg.forecast_horizon_months, freq="M").to_timestamp()
    rows: list[dict] = []
    for material_id, g in panel.groupby("material_id"):
        g = g.sort_values("month")
        meta = g.iloc[-1][["material_code", "description", "material_type", "warehouse_id", "warehouse_code"]].to_dict()
        history = g["demand_units"].astype(float).tolist()
        for horizon, month in enumerate(future_months, start=1):
            if bundle.selected_model == "lightgbm_global_rm_pm" and bundle.lightgbm_model is not None:
                m_meta = {
                    "material_code_enc": code_enc.get(str(meta["material_code"]), 0),
                    "material_type_enc": type_enc.get(str(meta["material_type"]), 0),
                }
                row = build_future_feature_row(history, m_meta, month)
                x = pd.DataFrame([row])[bundle.feature_cols or feature_cols]
                p50 = float(np.expm1(bundle.lightgbm_model.predict(x)[0]))
            else:
                p50 = _baseline_prediction(history, bundle.selected_model)
            p50 = max(0.0, p50)
            p10 = max(0.0, p50 * (1.0 + bundle.residual_q10))
            p90 = max(p50, p50 * (1.0 + bundle.residual_q90))
            rows.append(
                {
                    "material_id": material_id,
                    **meta,
                    "forecast_period": month.date().isoformat(),
                    "horizon": horizon,
                    "model_name": cfg.model_name,
                    "forecast_p10": round(p10, 2),
                    "forecast_p50": round(p50, 2),
                    "forecast_p90": round(p90, 2),
                    "method": bundle.selected_model,
                }
            )
            history.append(p50)
    return pd.DataFrame(rows)
