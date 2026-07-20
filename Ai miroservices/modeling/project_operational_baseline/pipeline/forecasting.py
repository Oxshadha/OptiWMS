from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.ensemble import ExtraTreesRegressor


FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "rolling_mean_3", "rolling_mean_6",
    "rolling_std_6", "rolling_mean_12", "trend_3_to_12", "lag_1_to_12",
    "planned_to_lag_12", "month_sin", "month_cos", "planned_bom_requirement",
    "promotion_flag", "shutdown_flag", "active_fg_count",
    "lead_time_days", "material_type_code", "category_code",
]


@dataclass(frozen=True)
class ForecastConfig:
    selection_months: int = 12
    test_months: int = 12
    minimum_history: int = 24
    trees: int = 120
    seed: int = 20260715


def _features(demand: pd.DataFrame) -> pd.DataFrame:
    panel = demand.copy()
    panel["month"] = pd.to_datetime(panel["month"])
    panel = panel.sort_values(["material_id", "month"]).reset_index(drop=True)
    grouped = panel.groupby("material_id", sort=False).demand_units
    for lag in [1, 2, 3, 6, 12]:
        panel[f"lag_{lag}"] = grouped.shift(lag)
    panel["rolling_mean_3"] = grouped.transform(lambda series: series.shift(1).rolling(3, min_periods=3).mean())
    panel["rolling_mean_6"] = grouped.transform(lambda series: series.shift(1).rolling(6, min_periods=6).mean())
    panel["rolling_std_6"] = grouped.transform(lambda series: series.shift(1).rolling(6, min_periods=6).std()).fillna(0)
    panel["rolling_mean_12"] = grouped.transform(lambda series: series.shift(1).rolling(12, min_periods=12).mean())
    panel["trend_3_to_12"] = (panel.rolling_mean_3 / panel.rolling_mean_12.clip(lower=1e-6)).clip(0.1, 10.0)
    panel["lag_1_to_12"] = (panel.lag_1 / panel.lag_12.clip(lower=1e-6)).clip(0.1, 10.0)
    panel["planned_to_lag_12"] = (panel.planned_bom_requirement / panel.lag_12.clip(lower=1e-6)).clip(0.1, 10.0)
    panel["month_sin"] = np.sin(2 * np.pi * panel.month.dt.month / 12)
    panel["month_cos"] = np.cos(2 * np.pi * panel.month.dt.month / 12)
    panel["material_type_code"] = panel.material_type.astype("category").cat.codes
    panel["category_code"] = panel.category.astype("category").cat.codes
    for flag in ["promotion_flag", "shutdown_flag", "supplier_disruption_flag"]:
        panel[flag] = panel[flag].astype(int)
    return panel.dropna(subset=["lag_12", "rolling_mean_6"])


def _croston_sba(values: np.ndarray, alpha: float = 0.15) -> float:
    positive = np.flatnonzero(values > 0)
    if len(positive) == 0:
        return 0.0
    demand = values[positive]
    intervals = np.diff(np.r_[-1, positive])
    size = float(demand[0])
    interval = float(max(1, intervals[0]))
    for amount, gap in zip(demand[1:], intervals[1:]):
        size += alpha * (float(amount) - size)
        interval += alpha * (float(gap) - interval)
    return max(0.0, (1 - alpha / 2) * size / max(interval, 1e-9))


def _ets_ana(values: np.ndarray, months: np.ndarray, target_month: int) -> float:
    if len(values) < 24:
        return float(np.mean(values[-6:])) if len(values) else 0.0
    frame = pd.DataFrame({"y": values, "m": months})
    seasonal = frame.groupby("m").y.mean()
    overall = max(float(frame.y.mean()), 1e-9)
    factors = (seasonal / overall).clip(0.25, 4.0)
    deseasonal = frame.y.to_numpy() / frame.m.map(factors).to_numpy()
    best_alpha, best_error = 0.3, math.inf
    validation = min(12, len(values) // 3)
    for alpha in [0.1, 0.2, 0.35, 0.5, 0.7]:
        level = float(deseasonal[0])
        errors = []
        for i, value in enumerate(deseasonal[1:], start=1):
            if i >= len(deseasonal) - validation:
                errors.append(abs(value - level))
            level = alpha * float(value) + (1 - alpha) * level
        error = float(np.mean(errors)) if errors else math.inf
        if error < best_error:
            best_alpha, best_error = alpha, error
    level = float(deseasonal[0])
    for value in deseasonal[1:]:
        level = best_alpha * float(value) + (1 - best_alpha) * level
    return max(0.0, level * float(factors.get(target_month, 1.0)))


def _global_models(seed: int, trees: int) -> dict:
    models: dict[str, object] = {
        "EXTRA_TREES": ExtraTreesRegressor(
            n_estimators=trees, min_samples_leaf=2, max_features=0.8,
            random_state=seed, n_jobs=-1,
        ),
        "EXTRA_TREES_RESPONSIVE": ExtraTreesRegressor(
            n_estimators=trees * 2, min_samples_leaf=1, max_features=1.0,
            random_state=seed + 1000, n_jobs=-1,
        ),
        "EXTRA_TREES_DAMPED_TREND": ExtraTreesRegressor(
            n_estimators=trees, min_samples_leaf=2, max_features=0.8,
            random_state=seed, n_jobs=-1,
        ),
    }
    try:
        from lightgbm import LGBMRegressor

        models["LIGHTGBM"] = LGBMRegressor(
            objective="tweedie", n_estimators=250, learning_rate=0.045,
            num_leaves=31, min_child_samples=30, subsample=0.9,
            colsample_bytree=0.85, reg_lambda=1.0, random_state=seed, verbosity=-1,
        )
    except ImportError:
        pass
    return models


def _metrics(rows: pd.DataFrame) -> dict[str, float]:
    error = rows.y_true - rows.prediction
    denominator = max(float(rows.y_true.abs().sum()), 1e-9)
    return {
        "rows": int(len(rows)), "materials": int(rows.material_id.nunique()),
        "WAPE": float(error.abs().sum() / denominator), "MAE": float(error.abs().mean()),
        "RMSE": float(np.sqrt(np.mean(error**2))), "Bias": float(error.sum() / denominator),
        "under_forecast_rate": float((error > 0).mean()),
    }


def _state_feature(values: list[float], meta, month: pd.Timestamp) -> dict[str, float]:
    lag = lambda n: values[-n] if len(values) >= n else values[-1]
    rolling_3 = float(np.mean(values[-3:]))
    rolling_6 = float(np.mean(values[-6:]))
    rolling_12 = float(np.mean(values[-12:]))
    lag_12 = max(float(lag(12)), 1e-6)
    return {
        "lag_1": lag(1), "lag_2": lag(2), "lag_3": lag(3), "lag_6": lag(6), "lag_12": lag(12),
        "rolling_mean_3": rolling_3, "rolling_mean_6": rolling_6,
        "rolling_std_6": float(np.std(values[-6:], ddof=1)) if len(values[-6:]) > 1 else 0.0,
        "rolling_mean_12": rolling_12,
        "trend_3_to_12": float(np.clip(rolling_3 / max(rolling_12, 1e-6), 0.1, 10.0)),
        "lag_1_to_12": float(np.clip(float(lag(1)) / lag_12, 0.1, 10.0)),
        "planned_to_lag_12": float(np.clip(float(meta.planned_bom_requirement) / lag_12, 0.1, 10.0)),
        "month_sin": math.sin(2 * math.pi * month.month / 12),
        "month_cos": math.cos(2 * math.pi * month.month / 12),
        "planned_bom_requirement": float(meta.planned_bom_requirement),
        "promotion_flag": int(meta.promotion_flag), "shutdown_flag": int(meta.shutdown_flag),
        "active_fg_count": float(meta.active_fg_count), "lead_time_days": float(meta.lead_time_days),
        "material_type_code": float(meta.material_type_code), "category_code": float(meta.category_code),
    }


def _apply_model_adjustment(name: str, predictions: np.ndarray, features: list[dict[str, float]]) -> np.ndarray:
    if name != "EXTRA_TREES_DAMPED_TREND":
        return predictions
    trend = np.asarray([row["trend_3_to_12"] for row in features], dtype=float)
    # Damped local trend allows a tree model to extrapolate without applying the
    # full recent growth ratio, which is unstable for intermittent materials.
    factor = np.power(np.clip(trend, 0.81, 1.2544), 0.55)
    return np.maximum(0.0, predictions * factor)


def _recursive_backtest(panel: pd.DataFrame, origins: list[pd.Timestamp], cfg: ForecastConfig) -> pd.DataFrame:
    rows = []
    for origin_index, origin in enumerate(origins, start=1):
        train = panel[panel.month < origin]
        models = _global_models(cfg.seed + origin_index, cfg.trees)
        for model in models.values():
            model.fit(train[FEATURES], train.demand_units)
        names = ["SEASONAL_NAIVE", "MOVING_AVERAGE_3", "CROSTON_SBA", "ETS_A_N_A", *models.keys()]
        base_state = {key: list(group.sort_values("month").demand_units.astype(float)) for key, group in train.groupby("material_id")}
        states = {name: {key: values.copy() for key, values in base_state.items()} for name in names}
        for horizon in range(1, 13):
            month = origin + pd.DateOffset(months=horizon - 1)
            target = panel[panel.month.eq(month)].sort_values("material_id").reset_index(drop=True)
            if target.empty:
                continue
            for name in names:
                features = [_state_feature(states[name][row.material_id], row, month) for row in target.itertuples(index=False)]
                if name in models:
                    predictions = np.maximum(0.0, models[name].predict(pd.DataFrame(features)[FEATURES]))
                    predictions = _apply_model_adjustment(name, predictions, features)
                else:
                    predictions = []
                    for row, feature in zip(target.itertuples(index=False), features):
                        values = states[name][row.material_id]
                        if name == "SEASONAL_NAIVE": prediction = feature["lag_12"]
                        elif name == "MOVING_AVERAGE_3": prediction = feature["rolling_mean_3"]
                        elif name == "CROSTON_SBA": prediction = _croston_sba(np.asarray(values))
                        else:
                            hist_months = pd.date_range(end=month - pd.DateOffset(months=1), periods=len(values), freq="MS").month.to_numpy()
                            prediction = _ets_ana(np.asarray(values), hist_months, month.month)
                        predictions.append(max(0.0, float(prediction)))
                for row, prediction in zip(target.itertuples(index=False), predictions):
                    prediction = float(prediction)
                    states[name][row.material_id].append(prediction)
                    rows.append({
                        "origin_month": origin.date().isoformat(), "forecast_month": month.date().isoformat(),
                        "material_id": row.material_id, "material_code": row.material_code,
                        "material_type": row.material_type, "category": row.category, "model_name": name,
                        "y_true": float(row.demand_units), "prediction": prediction, "horizon": horizon,
                    })
    result = pd.DataFrame(rows)
    result["residual"] = result.y_true - result.prediction
    result["absolute_error"] = result.residual.abs()
    return result


def _leaderboard(rows: pd.DataFrame, split: str) -> pd.DataFrame:
    output = []
    for name, group in rows.groupby("model_name"):
        metrics = _metrics(group)
        output.append({
            "split": split, "model_name": name, **metrics,
            "selection_score": metrics["WAPE"] + 0.5 * abs(metrics["Bias"]),
        })
    return pd.DataFrame(output).sort_values(["selection_score", "WAPE", "MAE"]).reset_index(drop=True)


def _forecast_panel(output_dir: Path) -> pd.DataFrame:
    """Build one leakage-safe panel for FG, RM and PM operational demand."""
    material_demand = pd.read_csv(output_dir / "demand_history.csv.gz")
    production = pd.read_csv(output_dir / "production_history.csv.gz")
    finished_goods = pd.read_csv(output_dir / "finished_goods.csv.gz")
    fg_meta = finished_goods.set_index("material_id")
    fg_demand = production.rename(columns={
        "parent_material_id": "material_id",
        "parent_code": "material_code",
        "planned_fg_units": "planned_bom_requirement",
        "actual_fg_units": "demand_units",
    }).copy()
    fg_demand["actual_bom_requirement"] = fg_demand["demand_units"]
    fg_demand["active_fg_count"] = 1
    fg_demand["material_type"] = "product"
    fg_demand["category"] = fg_demand.material_id.map(fg_meta.category)
    fg_demand["lead_time_days"] = fg_demand.material_id.map(fg_meta.lead_time_days).fillna(1)
    fg_demand["source"] = "PROJECT_OPERATIONAL_BASELINE_V3"
    required = material_demand.columns
    return pd.concat([material_demand, fg_demand[required]], ignore_index=True, sort=False)


def _future_forecast(panel: pd.DataFrame, champion: str, residuals: pd.DataFrame, cfg: ForecastConfig) -> pd.DataFrame:
    history = panel.copy().sort_values(["material_id", "month"])
    models = _global_models(cfg.seed, cfg.trees)
    model = models.get(champion)
    if model is not None:
        model.fit(history[FEATURES], history.demand_units)
    last_month = history.month.max()
    state = {key: list(group.sort_values("month").demand_units.astype(float)) for key, group in history.groupby("material_id")}
    metadata = history.sort_values("month").groupby("material_id").tail(1).set_index("material_id")
    residual_q = residuals.groupby("material_id").residual.quantile([0.05, 0.95]).unstack(fill_value=0)
    global_q = residuals.residual.quantile([0.05, 0.95]).to_dict()
    rows = []
    for horizon in range(1, 13):
        month = last_month + pd.DateOffset(months=horizon)
        material_ids = list(state)
        feature_rows = []
        for material_id in material_ids:
            values = state[material_id]
            meta = metadata.loc[material_id]
            lag = lambda n: values[-n] if len(values) >= n else values[-1]
            feature = _state_feature(values, meta, month)
            feature["planned_bom_requirement"] = lag(12)
            feature["planned_to_lag_12"] = 1.0
            feature["promotion_flag"] = 0
            feature["shutdown_flag"] = 0
            feature_rows.append(feature)
        global_predictions = None
        if model is not None:
            global_predictions = np.maximum(0.0, model.predict(pd.DataFrame(feature_rows)[FEATURES]))
            global_predictions = _apply_model_adjustment(champion, global_predictions, feature_rows)
        for row_index, (material_id, feature) in enumerate(zip(material_ids, feature_rows)):
            values = state[material_id]
            meta = metadata.loc[material_id]
            if champion == "SEASONAL_NAIVE":
                prediction = feature["lag_12"]
            elif champion == "MOVING_AVERAGE_3":
                prediction = feature["rolling_mean_3"]
            elif champion == "CROSTON_SBA":
                prediction = _croston_sba(np.asarray(values))
            elif champion == "ETS_A_N_A":
                months = np.array([(last_month - pd.DateOffset(months=len(values) - i - 1)).month for i in range(len(values))])
                prediction = _ets_ana(np.asarray(values), months, month.month)
            else:
                prediction = float(global_predictions[row_index])
            prediction = max(0.0, prediction)
            low, high = global_q[0.05], global_q[0.95]
            if material_id in residual_q.index:
                low, high = residual_q.loc[material_id, 0.05], residual_q.loc[material_id, 0.95]
            p05, p95 = max(0.0, prediction + low), max(prediction, prediction + high)
            rows.append({
                "material_id": material_id, "material_code": meta.material_code,
                "forecast_period": month.date().isoformat(), "horizon": horizon,
                "model_name": champion, "forecast_p05": p05, "forecast_p50": prediction,
                "forecast_p95": p95, "method": "GLOBAL_CAUSAL" if champion in models else "STATISTICAL_BASELINE",
            })
            values.append(prediction)
    return pd.DataFrame(rows)


def run_forecast_evidence(output_dir: Path, cfg: ForecastConfig = ForecastConfig()) -> dict:
    demand = _forecast_panel(output_dir)
    classes = pd.read_csv(output_dir / "material_classifications.csv.gz")
    panel = _features(demand)
    months = sorted(panel.month.unique())
    if len(months) < cfg.minimum_history + cfg.selection_months + cfg.test_months:
        raise RuntimeError("Insufficient history for locked selection and untouched test windows")
    test_start_index = len(months) - cfg.test_months
    latest_selection_origin = test_start_index - 12
    earliest_selection_origin = max(cfg.minimum_history, latest_selection_origin - cfg.selection_months)
    selection_indexes = list(range(earliest_selection_origin, latest_selection_origin + 1, 6))
    if latest_selection_origin not in selection_indexes:
        selection_indexes.append(latest_selection_origin)
    selection_origins = [pd.Timestamp(months[index]) for index in selection_indexes]
    test_origins = [pd.Timestamp(months[test_start_index])]
    selection_rows = _recursive_backtest(panel, selection_origins, cfg)
    selection_board = _leaderboard(selection_rows, "selection")
    champion = str(selection_board.iloc[0].model_name)
    test_rows = _recursive_backtest(panel, test_origins, cfg)
    test_board = _leaderboard(test_rows, "untouched_test")
    calibration_rows = selection_rows[selection_rows.model_name.eq(champion)].copy()
    champion_test = test_rows[test_rows.model_name.eq(champion)].merge(
        classes[["material_id", "abc_class", "fms_class", "amalgamated_class"]], on="material_id", how="left"
    )
    q05, q95 = calibration_rows.residual.quantile([0.05, 0.95])
    champion_test["forecast_p05"] = (champion_test.prediction + q05).clip(lower=0)
    champion_test["forecast_p95"] = (champion_test.prediction + q95).clip(lower=0)
    champion_test["interval_covered"] = champion_test.y_true.between(champion_test.forecast_p05, champion_test.forecast_p95)
    coverage = float(champion_test.interval_covered.mean())
    critical = champion_test[champion_test.amalgamated_class.isin(["AF", "AM", "BF"])]
    critical_wape = _metrics(critical)["WAPE"] if not critical.empty else 0.0
    test_metric = _metrics(champion_test)
    baseline_wape = float(test_board[test_board.model_name.eq("SEASONAL_NAIVE")].iloc[0].WAPE)
    improvement = (baseline_wape - test_metric["WAPE"]) / max(baseline_wape, 1e-9)
    gate = {
        "beats_seasonal_naive_by_5pct": improvement >= 0.05, "wape_at_most_15pct": test_metric["WAPE"] <= 0.15,
        "absolute_bias_at_most_5pct": abs(test_metric["Bias"]) <= 0.05,
        "empirical_90_interval_coverage_85_to_95pct": 0.85 <= coverage <= 0.95,
        "critical_class_wape_at_most_25pct": critical_wape <= 0.25,
    }
    future = _future_forecast(panel, champion, calibration_rows, cfg)
    paired = []
    champion_abs = selection_rows[selection_rows.model_name.eq(champion)].sort_values(["origin_month", "material_id"]).absolute_error
    for model_name in selection_board.model_name:
        if model_name == champion:
            continue
        other = selection_rows[selection_rows.model_name.eq(model_name)].sort_values(["origin_month", "material_id"]).absolute_error
        statistic, pvalue = stats.wilcoxon(champion_abs.to_numpy(), other.to_numpy(), zero_method="zsplit")
        paired.append({"champion": champion, "challenger": model_name, "test": "Wilcoxon paired absolute error", "statistic": statistic, "p_value": pvalue})

    selection_rows.to_csv(output_dir / "selection_backtest_rows.csv.gz", index=False, compression="gzip")
    champion_test.to_csv(output_dir / "champion_test_backtest_rows.csv.gz", index=False, compression="gzip")
    pd.concat([selection_board, test_board]).to_csv(output_dir / "model_leaderboard.csv", index=False)
    pd.DataFrame(paired).to_csv(output_dir / "paired_model_tests.csv", index=False)
    future.to_csv(output_dir / "forecast_results.csv.gz", index=False, compression="gzip")
    horizon_metrics = pd.DataFrame([
        {"horizon": int(horizon), **_metrics(group),
         "interval_empirical_coverage": float(group.interval_covered.mean())}
        for horizon, group in champion_test.groupby("horizon")
    ])
    horizon_metrics.to_csv(output_dir / "champion_horizon_metrics.csv.gz", index=False, compression="gzip")
    summary = {
        "champion": champion,
        "selection_window": [str(selection_origins[0].date()), str((selection_origins[-1] + pd.DateOffset(months=11)).date())],
        "selection_origins": [str(origin.date()) for origin in selection_origins],
        "untouched_test_window": [str(test_origins[0].date()), str((test_origins[0] + pd.DateOffset(months=11)).date())],
        "evaluation_protocol": "expanding-window fixed-origin recursive H1-H12; final 12 months untouched",
        "selection_objective": "WAPE + 0.5 * absolute bias, computed on selection origins only",
        "forecast_scope": {
            material_type: int(group.material_id.nunique())
            for material_type, group in panel.groupby("material_type")
        },
        "test_metrics": test_metric, "seasonal_naive_test_wape": baseline_wape,
        "relative_wape_improvement": improvement, "interval_nominal_coverage": 0.90,
        "interval_empirical_coverage": coverage, "critical_class_wape": critical_wape,
        "interval_calibration_method": "signed residual 5th/95th quantiles from locked selection window only",
        "interval_calibration_rows": int(len(calibration_rows)),
        "promotion_gate": gate, "promotion_eligible": all(gate.values()),
        "promotion_status": "PENDING_MANAGER_APPROVAL" if all(gate.values()) else "BLOCKED_BY_EVIDENCE_GATE",
    }
    (output_dir / "forecast_evidence_summary.json").write_text(json.dumps(summary, indent=2))
    return summary
