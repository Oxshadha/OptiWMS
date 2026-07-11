from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd


EPS = 1e-9
BASE_FEATURES = [
    "month_num",
    "quarter",
    "year_index",
    "month_sin",
    "month_cos",
    "material_code_enc",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_6",
    "lag_12",
    "roll_mean_3",
    "roll_mean_6",
    "roll_mean_12",
    "roll_median_6",
    "roll_max_6",
    "roll_std_6",
    "roll_std_12",
    "ewm_mean_3",
    "nonzero_rate_12",
    "months_since_nonzero",
    "trend_6",
]


@dataclass(frozen=True)
class Variant:
    name: str
    objective: str
    transform: str
    metric: str
    weighted: bool = False


VARIANTS = [
    Variant("lgb_log_l2_aligned", "regression", "log1p", "rmse"),
    Variant("lgb_log_huber_aligned", "huber", "log1p", "mae"),
    Variant("lgb_raw_l1_aligned", "regression_l1", "identity", "mae"),
    Variant("lgb_ratio_log_l2", "regression", "ratio_log1p", "rmse"),
    Variant("lgb_ratio_l1", "regression_l1", "ratio_identity", "mae"),
    Variant("lgb_tweedie_aligned", "tweedie", "identity", "tweedie"),
    Variant("lgb_poisson_aligned", "poisson", "identity", "poisson"),
    Variant("lgb_log_weighted_volume", "regression", "log1p", "rmse", weighted=True),
]


def _months_since_nonzero(values: pd.Series) -> pd.Series:
    result: list[float] = []
    distance = 0
    seen = False
    for value in values.shift(1):
        if pd.isna(value):
            result.append(0.0)
        elif value > 0:
            distance = 0
            seen = True
            result.append(0.0)
        else:
            distance += 1
            result.append(float(distance if seen else 12))
    return pd.Series(result, index=values.index)


def _rolling_slope(values: np.ndarray) -> float:
    y = np.asarray(values, dtype=float)
    if len(y) < 2 or np.allclose(y, y[0]):
        return 0.0
    x = np.arange(len(y), dtype=float)
    return float(np.polyfit(x, y, 1)[0])


def build_aligned_features(panel: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Build one-step-ahead rows where target month t uses information through t-1."""
    df = panel.copy()
    df["month"] = pd.to_datetime(df["month"]).dt.to_period("M").dt.to_timestamp()
    df = df.sort_values(["material_id", "month"]).reset_index(drop=True)
    df["month_num"] = df["month"].dt.month
    df["quarter"] = df["month"].dt.quarter
    df["year_index"] = df["month"].dt.year - df["month"].dt.year.min()
    df["month_sin"] = np.sin(2 * np.pi * df["month_num"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_num"] / 12)
    codes = sorted(df["material_code"].astype(str).unique())
    code_map = {code: idx for idx, code in enumerate(codes)}
    df["material_code_enc"] = df["material_code"].astype(str).map(code_map).astype(int)

    grouped = df.groupby("material_id", group_keys=False)["demand_units"]
    for lag in [1, 2, 3, 6, 12]:
        df[f"lag_{lag}"] = grouped.shift(lag)
    shifted = grouped.shift(1)
    by_material = shifted.groupby(df["material_id"], group_keys=False)
    for window in [3, 6, 12]:
        df[f"roll_mean_{window}"] = by_material.transform(
            lambda s, w=window: s.rolling(w, min_periods=1).mean()
        )
    df["roll_median_6"] = by_material.transform(lambda s: s.rolling(6, min_periods=1).median())
    df["roll_max_6"] = by_material.transform(lambda s: s.rolling(6, min_periods=1).max())
    df["roll_std_6"] = by_material.transform(lambda s: s.rolling(6, min_periods=2).std())
    df["roll_std_12"] = by_material.transform(lambda s: s.rolling(12, min_periods=2).std())
    df["ewm_mean_3"] = by_material.transform(lambda s: s.ewm(span=3, adjust=False).mean())
    df["nonzero_rate_12"] = by_material.transform(
        lambda s: s.gt(0).rolling(12, min_periods=1).mean()
    )
    df["months_since_nonzero"] = df.groupby("material_id", group_keys=False)["demand_units"].apply(
        _months_since_nonzero
    )
    df["trend_6"] = by_material.transform(
        lambda s: s.rolling(6, min_periods=3).apply(_rolling_slope, raw=True)
    )
    df["target"] = df["demand_units"].astype(float)
    df["target_month"] = df["month"]
    df = df.dropna(subset=["lag_12"]).copy()
    df[BASE_FEATURES] = df[BASE_FEATURES].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df, list(BASE_FEATURES)


def _make_model(variant: Variant, seed: int = 42) -> lgb.LGBMRegressor:
    params = dict(
        objective=variant.objective,
        metric=variant.metric,
        learning_rate=0.03,
        n_estimators=450,
        num_leaves=24,
        max_depth=7,
        min_child_samples=24,
        subsample=0.85,
        colsample_bytree=0.80,
        reg_alpha=0.25,
        reg_lambda=1.0,
        random_state=seed,
        n_jobs=2,
        verbose=-1,
    )
    if variant.objective == "tweedie":
        params["tweedie_variance_power"] = 1.35
    return lgb.LGBMRegressor(**params)


def _fit_predict(
    train: pd.DataFrame,
    test: pd.DataFrame,
    features: list[str],
    variant: Variant,
) -> tuple[np.ndarray, lgb.LGBMRegressor]:
    model = _make_model(variant)
    y = train["target"].astype(float).to_numpy()
    train_scale = train["roll_mean_12"].clip(lower=1.0).to_numpy()
    test_scale = test["roll_mean_12"].clip(lower=1.0).to_numpy()
    if variant.transform == "log1p":
        fit_y = np.log1p(y)
    elif variant.transform == "ratio_log1p":
        fit_y = np.log1p(y / train_scale)
    elif variant.transform == "ratio_identity":
        fit_y = y / train_scale
    else:
        fit_y = y
    weights = None
    if variant.weighted:
        positive = y[y > 0]
        scale = float(np.median(positive)) if len(positive) else 1.0
        weights = np.clip(np.sqrt(np.maximum(y, 0.0) / max(scale, 1.0)), 0.5, 8.0)
    model.fit(train[features], fit_y, sample_weight=weights)
    pred = model.predict(test[features])
    if variant.transform == "log1p":
        pred = np.expm1(pred)
    elif variant.transform == "ratio_log1p":
        pred = np.expm1(pred) * test_scale
    elif variant.transform == "ratio_identity":
        pred = pred * test_scale
    return np.clip(pred, 0.0, None), model


def rolling_origin_experiment(
    panel: pd.DataFrame,
    backtest_months: int = 6,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, lgb.LGBMRegressor], pd.DataFrame, list[str]]:
    supervised, features = build_aligned_features(panel)
    origins = sorted(supervised["target_month"].unique())[-backtest_months:]
    rows: list[dict] = []
    final_models: dict[str, lgb.LGBMRegressor] = {}
    final_test = pd.DataFrame()
    for origin in origins:
        train = supervised[supervised["target_month"] < origin].copy()
        test = supervised[supervised["target_month"] == origin].copy()
        if train.empty or test.empty:
            continue
        for variant in VARIANTS:
            pred, model = _fit_predict(train, test, features, variant)
            for record, prediction in zip(test.to_dict(orient="records"), pred):
                actual = float(record["target"])
                error = float(prediction - actual)
                rows.append(
                    {
                        "model": variant.name,
                        "origin_month": pd.Timestamp(origin).date().isoformat(),
                        "material_id": record["material_id"],
                        "material_code": record["material_code"],
                        "description": record["description"],
                        "material_type": record["material_type"],
                        "actual": actual,
                        "prediction": float(prediction),
                        "error": error,
                        "residual": error,
                        "abs_error": abs(error),
                        "squared_error": error * error,
                        "under_forecast": bool(prediction < actual),
                    }
                )
            if origin == origins[-1]:
                final_models[variant.name] = model
                final_test = test.copy()
    eval_rows = pd.DataFrame(rows)
    leaderboard = aggregate_metrics(eval_rows)
    return eval_rows, leaderboard, final_models, final_test, features


def aggregate_metrics(rows: pd.DataFrame) -> pd.DataFrame:
    metrics: list[dict] = []
    for model, group in rows.groupby("model"):
        actual_sum = max(float(group["actual"].abs().sum()), EPS)
        error = group["prediction"] - group["actual"]
        metrics.append(
            {
                "model": model,
                "rows": int(len(group)),
                "materials": int(group["material_id"].nunique()),
                "WAPE": float(group["abs_error"].sum() / actual_sum),
                "MAE": float(group["abs_error"].mean()),
                "RMSE": float(np.sqrt(group["squared_error"].mean())),
                "Bias": float(error.sum() / actual_sum),
                "under_forecast_rate": float(group["under_forecast"].mean()),
            }
        )
    return pd.DataFrame(metrics).sort_values("WAPE").reset_index(drop=True)


def demand_band_metrics(rows: pd.DataFrame) -> pd.DataFrame:
    output: list[pd.DataFrame] = []
    for model, group in rows.groupby("model"):
        work = group.copy()
        work["demand_band"] = pd.qcut(
            work["actual"].rank(method="first"),
            5,
            labels=["Q1_lowest", "Q2", "Q3", "Q4", "Q5_highest"],
        )
        summary = work.groupby("demand_band", observed=True).agg(
            rows=("actual", "size"),
            actual_min=("actual", "min"),
            actual_median=("actual", "median"),
            actual_max=("actual", "max"),
            sum_actual=("actual", "sum"),
            sum_abs_error=("abs_error", "sum"),
            MAE=("abs_error", "mean"),
            RMSE=("squared_error", lambda s: float(np.sqrt(s.mean()))),
            mean_error=("error", "mean"),
            under_forecast_rate=("under_forecast", "mean"),
        ).reset_index()
        summary["WAPE"] = summary["sum_abs_error"] / summary["sum_actual"].replace(0, np.nan)
        summary.insert(0, "model", model)
        output.append(summary)
    return pd.concat(output, ignore_index=True)


def paired_comparisons(rows: pd.DataFrame, champion: str) -> pd.DataFrame:
    try:
        from scipy.stats import ttest_rel
    except Exception:
        ttest_rel = None
    keys = ["origin_month", "material_id"]
    champion_rows = rows[rows["model"].eq(champion)][keys + ["abs_error"]].rename(
        columns={"abs_error": "champion_abs_error"}
    )
    output = []
    for candidate in sorted(rows["model"].unique()):
        if candidate == champion:
            continue
        other = rows[rows["model"].eq(candidate)][keys + ["abs_error"]].rename(
            columns={"abs_error": "candidate_abs_error"}
        )
        paired = champion_rows.merge(other, on=keys, how="inner")
        delta = paired["champion_abs_error"] - paired["candidate_abs_error"]
        p_value = float(ttest_rel(paired["champion_abs_error"], paired["candidate_abs_error"]).pvalue) if ttest_rel and len(paired) > 1 else np.nan
        output.append(
            {
                "champion": champion,
                "candidate": candidate,
                "paired_rows": int(len(paired)),
                "mean_abs_error_delta": float(delta.mean()),
                "champion_better_when_negative": bool(delta.mean() < 0),
                "paired_ttest_p_value": p_value,
            }
        )
    return pd.DataFrame(output).sort_values("mean_abs_error_delta")


def permutation_importance_wape(
    model: lgb.LGBMRegressor,
    test: pd.DataFrame,
    features: list[str],
    variant: Variant,
    repeats: int = 5,
) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    fixed_scale = test["roll_mean_12"].clip(lower=1.0).to_numpy()

    def predict(frame: pd.DataFrame) -> np.ndarray:
        values = model.predict(frame[features])
        if variant.transform == "log1p":
            values = np.expm1(values)
        elif variant.transform == "ratio_log1p":
            values = np.expm1(values) * fixed_scale
        elif variant.transform == "ratio_identity":
            values = values * fixed_scale
        return np.clip(values, 0.0, None)

    actual = test["target"].astype(float).to_numpy()
    baseline = float(np.abs(actual - predict(test)).sum() / max(np.abs(actual).sum(), EPS))
    records = []
    for feature in features:
        increases = []
        for _ in range(repeats):
            shuffled = test.copy()
            shuffled[feature] = rng.permutation(shuffled[feature].to_numpy())
            score = float(np.abs(actual - predict(shuffled)).sum() / max(np.abs(actual).sum(), EPS))
            increases.append(score - baseline)
        records.append(
            {
                "feature": feature,
                "baseline_WAPE": baseline,
                "permuted_WAPE_increase_mean": float(np.mean(increases)),
                "permuted_WAPE_increase_std": float(np.std(increases)),
            }
        )
    return pd.DataFrame(records).sort_values("permuted_WAPE_increase_mean", ascending=False)


def gain_importance(model: lgb.LGBMRegressor, features: list[str]) -> pd.DataFrame:
    gain = model.booster_.feature_importance(importance_type="gain")
    split = model.booster_.feature_importance(importance_type="split")
    total = max(float(gain.sum()), EPS)
    return pd.DataFrame(
        {
            "feature": features,
            "importance_gain": gain,
            "importance_split": split,
            "importance_gain_share": gain / total,
        }
    ).sort_values("importance_gain", ascending=False)


def plot_experiment(
    rows: pd.DataFrame,
    leaderboard: pd.DataFrame,
    band_metrics: pd.DataFrame,
    gain: pd.DataFrame,
    permutation: pd.DataFrame,
    output_dir: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy import stats

    output_dir.mkdir(parents=True, exist_ok=True)
    champion = str(leaderboard.iloc[0]["model"])
    selected = rows[rows["model"].eq(champion)].copy()

    plot = leaderboard.sort_values("WAPE")
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.barh(plot["model"], plot["WAPE"], color="#2563eb")
    ax.invert_yaxis()
    ax.set(title="Corrected rolling-origin model comparison", xlabel="WAPE", ylabel="")
    fig.tight_layout()
    fig.savefig(output_dir / "corrected_model_leaderboard.png", dpi=170)
    plt.close(fig)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    axes[0, 0].hist(selected["residual"], bins=60, color="#2563eb", alpha=0.8)
    axes[0, 0].axvline(0, color="black", linewidth=1)
    axes[0, 0].set_title("Residual distribution")
    stats.probplot(selected["residual"], dist="norm", plot=axes[0, 1])
    axes[0, 1].set_title("Q-Q plot")
    axes[1, 0].scatter(selected["prediction"], selected["residual"], s=12, alpha=0.25)
    axes[1, 0].axhline(0, color="black", linewidth=1)
    axes[1, 0].set(title="Residual vs fitted", xlabel="Prediction", ylabel="Prediction - actual")
    actual = selected["actual"].to_numpy()
    pred = selected["prediction"].to_numpy()
    axes[1, 1].scatter(actual, pred, s=12, alpha=0.25)
    limit = float(max(actual.max(), pred.max()))
    axes[1, 1].plot([0, limit], [0, limit], color="black")
    axes[1, 1].set(title="Actual vs predicted", xlabel="Actual", ylabel="Predicted")
    fig.suptitle(f"Corrected champion diagnostics: {champion}")
    fig.tight_layout()
    fig.savefig(output_dir / "corrected_champion_diagnostics.png", dpi=170)
    plt.close(fig)

    highest = band_metrics[band_metrics["demand_band"].eq("Q5_highest")].sort_values("WAPE")
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.barh(highest["model"], highest["WAPE"], color="#dc2626")
    ax.invert_yaxis()
    ax.set(title="Highest-demand quintile performance", xlabel="Q5 WAPE", ylabel="")
    fig.tight_layout()
    fig.savefig(output_dir / "high_volume_wape_comparison.png", dpi=170)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    gain_plot = gain.head(12).sort_values("importance_gain_share")
    axes[0].barh(gain_plot["feature"], gain_plot["importance_gain_share"], color="#0f766e")
    axes[0].set(title="Gain importance", xlabel="Gain share")
    perm_plot = permutation.head(12).sort_values("permuted_WAPE_increase_mean")
    axes[1].barh(perm_plot["feature"], perm_plot["permuted_WAPE_increase_mean"], color="#9333ea")
    axes[1].set(title="Permutation importance", xlabel="Increase in WAPE after shuffle")
    fig.suptitle("Feature evidence: gain is not enough")
    fig.tight_layout()
    fig.savefig(output_dir / "corrected_feature_importance.png", dpi=170)
    plt.close(fig)
