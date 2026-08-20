from __future__ import annotations

from itertools import product

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import ElasticNet, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


EPS = 1e-9
DIRECT_FEATURES = [
    "month_num", "quarter", "year_index", "month_sin", "month_cos", "material_code_enc",
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "roll_mean_3", "roll_mean_6",
    "roll_mean_12", "roll_std_6", "roll_std_12", "roll_max_6", "ewm_mean_3",
    "nonzero_rate_12", "trend_6",
]
CAUSAL_FEATURES = DIRECT_FEATURES + [
    "planned_bom_requirement", "promotion_flag", "holiday_flag", "active_fg_count",
    "lead_time_days", "moq", "order_multiple", "material_type_enc",
]


def _slope(values: np.ndarray) -> float:
    values = np.asarray(values, dtype=float)
    if len(values) < 2 or np.allclose(values, values[0]):
        return 0.0
    return float(np.polyfit(np.arange(len(values)), values, 1)[0])


def build_features(demand: pd.DataFrame) -> pd.DataFrame:
    df = demand.copy()
    df["month"] = pd.to_datetime(df["month"]).dt.to_period("M").dt.to_timestamp()
    df = df.sort_values(["material_id", "month"]).reset_index(drop=True)
    df["target"] = df["demand_units"].astype(float)
    df["target_month"] = df["month"]
    df["month_num"] = df["month"].dt.month
    df["quarter"] = df["month"].dt.quarter
    df["year_index"] = df["month"].dt.year - df["month"].dt.year.min()
    df["month_sin"] = np.sin(2 * np.pi * df["month_num"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_num"] / 12)
    code_map = {code: idx for idx, code in enumerate(sorted(df["material_code"].unique()))}
    type_map = {name: idx for idx, name in enumerate(sorted(df["material_type"].unique()))}
    df["material_code_enc"] = df["material_code"].map(code_map).astype(int)
    df["material_type_enc"] = df["material_type"].map(type_map).astype(int)
    for col in ["promotion_flag", "holiday_flag"]:
        df[col] = df[col].astype(int)

    grouped = df.groupby("material_id", group_keys=False)["target"]
    for lag in [1, 2, 3, 6, 12]:
        df[f"lag_{lag}"] = grouped.shift(lag)
    shifted = grouped.shift(1)
    shifted_group = shifted.groupby(df["material_id"], group_keys=False)
    for window in [3, 6, 12]:
        df[f"roll_mean_{window}"] = shifted_group.transform(lambda s, w=window: s.rolling(w, min_periods=1).mean())
    df["roll_std_6"] = shifted_group.transform(lambda s: s.rolling(6, min_periods=2).std())
    df["roll_std_12"] = shifted_group.transform(lambda s: s.rolling(12, min_periods=2).std())
    df["roll_max_6"] = shifted_group.transform(lambda s: s.rolling(6, min_periods=1).max())
    df["ewm_mean_3"] = shifted_group.transform(lambda s: s.ewm(span=3, adjust=False).mean())
    df["nonzero_rate_12"] = shifted_group.transform(lambda s: s.gt(0).rolling(12, min_periods=1).mean())
    df["trend_6"] = shifted_group.transform(lambda s: s.rolling(6, min_periods=3).apply(_slope, raw=True))
    df = df.dropna(subset=["lag_12"]).copy()
    all_features = sorted(set(DIRECT_FEATURES + CAUSAL_FEATURES))
    df[all_features] = df[all_features].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df


def _croston_sba(history: np.ndarray, alpha: float = 0.1) -> float:
    nonzero = [(idx, value) for idx, value in enumerate(history) if value > 0]
    if not nonzero:
        return 0.0
    level = float(nonzero[0][1])
    interval = max(nonzero[0][0] + 1, 1)
    previous = nonzero[0][0]
    for idx, value in nonzero[1:]:
        level = alpha * float(value) + (1 - alpha) * level
        interval = alpha * (idx - previous) + (1 - alpha) * interval
        previous = idx
    return max(0.0, (1 - alpha / 2) * level / max(interval, EPS))


def _statistical_predictions(train: pd.DataFrame, test: pd.DataFrame) -> dict[str, np.ndarray]:
    results = {name: [] for name in ["seasonal_naive", "moving_average_6", "croston_sba", "holt_damped"]}
    for row in test.itertuples(index=False):
        history = train[train["material_id"].eq(row.material_id)].sort_values("target_month")["target"].to_numpy()
        results["seasonal_naive"].append(float(history[-12]) if len(history) >= 12 else float(history[-1]))
        results["moving_average_6"].append(float(np.mean(history[-6:])))
        results["croston_sba"].append(_croston_sba(history))
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing

            seasonal = "add" if len(history) >= 24 and np.count_nonzero(history) >= 18 else None
            model = ExponentialSmoothing(
                history,
                trend="add",
                damped_trend=True,
                seasonal=seasonal,
                seasonal_periods=12 if seasonal else None,
                initialization_method="estimated",
            ).fit(optimized=True, remove_bias=False)
            results["holt_damped"].append(max(0.0, float(model.forecast(1)[0])))
        except Exception:
            results["holt_damped"].append(float(np.mean(history[-6:])))
    return {name: np.asarray(values) for name, values in results.items()}


def _lgb_model(params: dict, objective: str = "regression") -> lgb.LGBMRegressor:
    base = dict(
        objective=objective,
        n_estimators=350,
        learning_rate=0.04,
        num_leaves=24,
        max_depth=7,
        min_child_samples=24,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=2,
        verbose=-1,
    )
    base.update(params)
    if objective == "tweedie":
        base["tweedie_variance_power"] = 1.35
    return lgb.LGBMRegressor(**base)


def _predict_lgb(
    train: pd.DataFrame,
    test: pd.DataFrame,
    features: list[str],
    params: dict,
    mode: str,
) -> tuple[np.ndarray, lgb.LGBMRegressor]:
    objective = "tweedie" if mode == "tweedie" else "regression"
    model = _lgb_model(params, objective)
    y = train["target"].to_numpy(dtype=float)
    if mode == "ratio_log":
        scale = train["roll_mean_12"].clip(lower=1.0).to_numpy()
        fit_y = np.log1p(y / scale)
    elif mode == "log":
        fit_y = np.log1p(y)
    else:
        fit_y = y
    model.fit(train[features], fit_y)
    prediction = model.predict(test[features])
    if mode == "ratio_log":
        prediction = np.expm1(prediction) * test["roll_mean_12"].clip(lower=1.0).to_numpy()
    elif mode == "log":
        prediction = np.expm1(prediction)
    return np.clip(prediction, 0.0, None), model


def _predict_linear(train: pd.DataFrame, test: pd.DataFrame, model_name: str) -> np.ndarray:
    numeric = [f for f in CAUSAL_FEATURES if f not in {"material_code_enc", "material_type_enc"}]
    categorical = ["material_code", "material_type"]
    transformer = ColumnTransformer(
        [
            ("num", StandardScaler(), numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
        ]
    )
    estimator = Ridge(alpha=10.0) if model_name == "ridge_causal" else ElasticNet(alpha=0.0008, l1_ratio=0.25, max_iter=5000)
    pipe = Pipeline([("transform", transformer), ("model", estimator)])
    pipe.fit(train[numeric + categorical], np.log1p(train["target"]))
    return np.clip(np.expm1(pipe.predict(test[numeric + categorical])), 0.0, None)


def _predict_forest(train: pd.DataFrame, test: pd.DataFrame, model_name: str) -> tuple[np.ndarray, object]:
    cls = ExtraTreesRegressor if model_name == "extra_trees_causal" else RandomForestRegressor
    model = cls(
        n_estimators=220,
        max_depth=16,
        min_samples_leaf=4,
        max_features=0.75,
        random_state=42,
        n_jobs=2,
    )
    model.fit(train[CAUSAL_FEATURES], np.log1p(train["target"]))
    return np.clip(np.expm1(model.predict(test[CAUSAL_FEATURES])), 0.0, None), model


def tune_lightgbm(supervised: pd.DataFrame, validation_months: list[pd.Timestamp]) -> tuple[pd.DataFrame, dict]:
    trials = []
    grid = product([16, 31], [0.025, 0.05], [12, 30], [0.5, 1.5])
    for trial_id, (leaves, rate, min_child, reg_lambda) in enumerate(grid, 1):
        params = {
            "num_leaves": leaves,
            "learning_rate": rate,
            "min_child_samples": min_child,
            "reg_lambda": reg_lambda,
            "n_estimators": 320,
        }
        actual_parts, pred_parts = [], []
        for month in validation_months:
            train = supervised[supervised["target_month"] < month]
            test = supervised[supervised["target_month"] == month]
            pred, _ = _predict_lgb(train, test, CAUSAL_FEATURES, params, "ratio_log")
            actual_parts.append(test["target"].to_numpy())
            pred_parts.append(pred)
        actual = np.concatenate(actual_parts)
        pred = np.concatenate(pred_parts)
        trials.append(
            {
                "trial_id": trial_id,
                **params,
                "validation_WAPE": float(np.abs(actual - pred).sum() / max(np.abs(actual).sum(), EPS)),
                "validation_RMSE": float(np.sqrt(np.mean((pred - actual) ** 2))),
            }
        )
    frame = pd.DataFrame(trials).sort_values("validation_WAPE").reset_index(drop=True)
    best = frame.iloc[0]
    params = {
        "num_leaves": int(best["num_leaves"]),
        "learning_rate": float(best["learning_rate"]),
        "min_child_samples": int(best["min_child_samples"]),
        "reg_lambda": float(best["reg_lambda"]),
        "n_estimators": int(best["n_estimators"]),
    }
    return frame, params


def _append_rows(rows: list[dict], model: str, month: pd.Timestamp, test: pd.DataFrame, prediction: np.ndarray) -> None:
    for record, pred in zip(test.to_dict(orient="records"), prediction):
        actual = float(record["target"])
        error = float(pred - actual)
        rows.append(
            {
                "model": model,
                "origin_month": pd.Timestamp(month).date().isoformat(),
                "material_id": record["material_id"],
                "material_code": record["material_code"],
                "material_type": record["material_type"],
                "actual": actual,
                "prediction": float(pred),
                "planned_bom_requirement": float(record["planned_bom_requirement"]),
                "shock_flag": bool(record["shock_flag"]),
                "error": error,
                "abs_error": abs(error),
                "squared_error": error * error,
                "under_forecast": bool(pred < actual),
            }
        )


def rolling_backtest(
    supervised: pd.DataFrame,
    test_months: list[pd.Timestamp],
    tuned_params: dict,
) -> tuple[pd.DataFrame, dict[str, object], pd.DataFrame]:
    rows: list[dict] = []
    final_models: dict[str, object] = {}
    final_test = pd.DataFrame()
    for month in test_months:
        train = supervised[supervised["target_month"] < month].copy()
        test = supervised[supervised["target_month"] == month].copy()
        statistical = _statistical_predictions(train, test)
        for name, pred in statistical.items():
            _append_rows(rows, name, month, test, pred)
        _append_rows(rows, "bom_plan", month, test, test["planned_bom_requirement"].to_numpy())
        _append_rows(rows, "ridge_causal", month, test, _predict_linear(train, test, "ridge_causal"))
        _append_rows(rows, "elastic_net_causal", month, test, _predict_linear(train, test, "elastic_net_causal"))
        rf_pred, rf_model = _predict_forest(train, test, "random_forest_causal")
        _append_rows(rows, "random_forest_causal", month, test, rf_pred)
        et_pred, et_model = _predict_forest(train, test, "extra_trees_causal")
        _append_rows(rows, "extra_trees_causal", month, test, et_pred)

        direct, direct_model = _predict_lgb(train, test, DIRECT_FEATURES, tuned_params, "ratio_log")
        causal, causal_model = _predict_lgb(train, test, CAUSAL_FEATURES, tuned_params, "ratio_log")
        tweedie, tweedie_model = _predict_lgb(train, test, CAUSAL_FEATURES, tuned_params, "tweedie")
        _append_rows(rows, "lightgbm_direct_ratio", month, test, direct)
        _append_rows(rows, "lightgbm_causal_ratio", month, test, causal)
        _append_rows(rows, "lightgbm_causal_tweedie", month, test, tweedie)
        if month == test_months[-1]:
            final_models = {
                "lightgbm_direct_ratio": direct_model,
                "lightgbm_causal_ratio": causal_model,
                "lightgbm_causal_tweedie": tweedie_model,
                "random_forest_causal": rf_model,
                "extra_trees_causal": et_model,
            }
            final_test = test.copy()
    return pd.DataFrame(rows), final_models, final_test


def aggregate_metrics(rows: pd.DataFrame) -> pd.DataFrame:
    records = []
    for model, group in rows.groupby("model"):
        actual_sum = max(float(group["actual"].abs().sum()), EPS)
        records.append(
            {
                "model": model,
                "rows": int(len(group)),
                "materials": int(group["material_id"].nunique()),
                "WAPE": float(group["abs_error"].sum() / actual_sum),
                "MAE": float(group["abs_error"].mean()),
                "RMSE": float(np.sqrt(group["squared_error"].mean())),
                "Bias": float(group["error"].sum() / actual_sum),
                "under_forecast_rate": float(group["under_forecast"].mean()),
                "shock_WAPE": float(
                    group.loc[group["shock_flag"], "abs_error"].sum()
                    / max(group.loc[group["shock_flag"], "actual"].abs().sum(), EPS)
                ),
            }
        )
    return pd.DataFrame(records).sort_values("WAPE").reset_index(drop=True)
