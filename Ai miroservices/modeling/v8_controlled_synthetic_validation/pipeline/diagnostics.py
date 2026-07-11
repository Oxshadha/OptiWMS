from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox, het_breuschpagan
from statsmodels.tools.tools import add_constant


EPS = 1e-9


def demand_band_metrics(rows: pd.DataFrame) -> pd.DataFrame:
    frames = []
    for model, group in rows.groupby("model"):
        work = group.copy()
        work["demand_band"] = pd.qcut(
            work["actual"].rank(method="first"), 5,
            labels=["Q1_lowest", "Q2", "Q3", "Q4", "Q5_highest"],
        )
        result = work.groupby("demand_band", observed=True).agg(
            rows=("actual", "size"), actual_min=("actual", "min"),
            actual_median=("actual", "median"), actual_max=("actual", "max"),
            sum_actual=("actual", "sum"), sum_abs_error=("abs_error", "sum"),
            MAE=("abs_error", "mean"), RMSE=("squared_error", lambda s: np.sqrt(s.mean())),
            BiasUnits=("error", "mean"), under_forecast_rate=("under_forecast", "mean"),
        ).reset_index()
        result["WAPE"] = result["sum_abs_error"] / result["sum_actual"].replace(0, np.nan)
        result.insert(0, "model", model)
        frames.append(result)
    return pd.concat(frames, ignore_index=True)


def _dm_monthly(champion: pd.DataFrame, candidate: pd.DataFrame) -> tuple[float, float]:
    keys = ["origin_month", "material_id"]
    merged = champion[keys + ["abs_error"]].merge(
        candidate[keys + ["abs_error"]], on=keys, suffixes=("_champion", "_candidate")
    )
    monthly = merged.groupby("origin_month").apply(
        lambda g: float((g["abs_error_champion"] - g["abs_error_candidate"]).mean()),
        include_groups=False,
    )
    n = len(monthly)
    if n < 4 or np.isclose(monthly.std(ddof=1), 0):
        return np.nan, np.nan
    statistic = float(monthly.mean() / (monthly.std(ddof=1) / np.sqrt(n)))
    p_value = float(2 * stats.t.sf(abs(statistic), df=n - 1))
    return statistic, p_value


def paired_model_tests(rows: pd.DataFrame, champion: str) -> pd.DataFrame:
    keys = ["origin_month", "material_id"]
    base = rows[rows["model"].eq(champion)]
    output = []
    for candidate_name in sorted(rows["model"].unique()):
        if candidate_name == champion:
            continue
        candidate = rows[rows["model"].eq(candidate_name)]
        paired = base[keys + ["abs_error"]].merge(
            candidate[keys + ["abs_error"]], on=keys, suffixes=("_champion", "_candidate")
        )
        a = paired["abs_error_champion"]
        b = paired["abs_error_candidate"]
        ttest = stats.ttest_rel(a, b)
        try:
            wilcoxon = stats.wilcoxon(a, b, zero_method="zsplit")
            w_stat, w_p = float(wilcoxon.statistic), float(wilcoxon.pvalue)
        except ValueError:
            w_stat, w_p = np.nan, np.nan
        dm_stat, dm_p = _dm_monthly(base, candidate)
        output.append(
            {
                "champion": champion,
                "candidate": candidate_name,
                "paired_rows": int(len(paired)),
                "mean_abs_error_delta": float((a - b).mean()),
                "paired_t_statistic": float(ttest.statistic),
                "paired_t_p_value": float(ttest.pvalue),
                "wilcoxon_statistic": w_stat,
                "wilcoxon_p_value": w_p,
                "monthly_dm_style_statistic": dm_stat,
                "monthly_dm_style_p_value": dm_p,
                "test_limit": "DM-style test uses 12 monthly aggregate loss differentials; low power.",
            }
        )
    return pd.DataFrame(output).sort_values("mean_abs_error_delta")


def residual_tests(rows: pd.DataFrame, champion: str) -> pd.DataFrame:
    selected = rows[rows["model"].eq(champion)].copy()
    residual = selected["error"].to_numpy()
    jb = stats.jarque_bera(residual)
    monthly = selected.groupby("origin_month")["error"].mean()
    lag = min(4, max(1, len(monthly) // 3))
    ljung = acorr_ljungbox(monthly, lags=[lag], return_df=True).iloc[0]
    exog = add_constant(selected[["prediction"]].to_numpy())
    bp = het_breuschpagan(residual, exog)
    spearman = stats.spearmanr(np.abs(residual), selected["prediction"])
    return pd.DataFrame(
        [
            {"test": "Jarque-Bera normality", "statistic": jb.statistic, "p_value": jb.pvalue, "null_hypothesis": "residuals are normally distributed"},
            {"test": f"Ljung-Box monthly mean residual lag {lag}", "statistic": ljung["lb_stat"], "p_value": ljung["lb_pvalue"], "null_hypothesis": "no residual autocorrelation"},
            {"test": "Breusch-Pagan", "statistic": bp[0], "p_value": bp[1], "null_hypothesis": "constant residual variance"},
            {"test": "Spearman abs residual vs fitted", "statistic": spearman.statistic, "p_value": spearman.pvalue, "null_hypothesis": "no monotonic scale-error relationship"},
        ]
    )


def conformal_intervals(validation_rows: pd.DataFrame, test_rows: pd.DataFrame, champion: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    calibration = validation_rows[validation_rows["model"].eq(champion)].copy()
    selected = test_rows[test_rows["model"].eq(champion)].copy()
    scale = calibration["prediction"].clip(lower=1.0)
    normalized_error = calibration["abs_error"] / scale
    quantile = float(normalized_error.quantile(0.90, interpolation="higher"))
    selected["interval_half_width"] = quantile * selected["prediction"].clip(lower=1.0)
    selected["p05"] = (selected["prediction"] - selected["interval_half_width"]).clip(lower=0.0)
    selected["p95"] = selected["prediction"] + selected["interval_half_width"]
    selected["covered"] = selected["actual"].between(selected["p05"], selected["p95"])
    summary = pd.DataFrame(
        [{
            "model": champion,
            "nominal_coverage": 0.90,
            "empirical_coverage": float(selected["covered"].mean()),
            "normalized_error_quantile": quantile,
            "average_interval_width": float((selected["p95"] - selected["p05"]).mean()),
            "calibration_rows": int(len(calibration)),
            "test_rows": int(len(selected)),
        }]
    )
    return selected, summary


def feature_importance(model, features: list[str], final_test: pd.DataFrame, mode: str = "ratio_log") -> tuple[pd.DataFrame, pd.DataFrame]:
    if hasattr(model, "booster_"):
        gain = model.booster_.feature_importance(importance_type="gain")
        split = model.booster_.feature_importance(importance_type="split")
    else:
        gain = model.feature_importances_
        split = model.feature_importances_
    gain_frame = pd.DataFrame(
        {
            "feature": features,
            "gain": gain,
            "split": split,
            "gain_share": gain / max(float(gain.sum()), EPS),
        }
    ).sort_values("gain", ascending=False)

    fixed_scale = final_test["roll_mean_12"].clip(lower=1.0).to_numpy()
    actual = final_test["target"].to_numpy()

    def predict(frame: pd.DataFrame) -> np.ndarray:
        raw = model.predict(frame[features])
        if mode == "ratio_log":
            raw = np.expm1(raw) * fixed_scale
        elif mode == "log":
            raw = np.expm1(raw)
        return np.clip(raw, 0.0, None)

    baseline = np.abs(actual - predict(final_test)).sum() / max(np.abs(actual).sum(), EPS)
    rng = np.random.default_rng(42)
    records = []
    for feature in features:
        changes = []
        for _ in range(5):
            shuffled = final_test.copy()
            shuffled[feature] = rng.permutation(shuffled[feature].to_numpy())
            score = np.abs(actual - predict(shuffled)).sum() / max(np.abs(actual).sum(), EPS)
            changes.append(score - baseline)
        records.append(
            {
                "feature": feature,
                "baseline_WAPE": baseline,
                "permuted_WAPE_increase_mean": float(np.mean(changes)),
                "permuted_WAPE_increase_std": float(np.std(changes)),
            }
        )
    permutation = pd.DataFrame(records).sort_values("permuted_WAPE_increase_mean", ascending=False)
    return gain_frame, permutation


def inventory_policy(interval_rows: pd.DataFrame, materials: pd.DataFrame) -> pd.DataFrame:
    forecast = interval_rows.groupby("material_id", as_index=False).agg(
        monthly_p50=("prediction", "mean"), monthly_p90=("p95", "mean"),
        test_actual_mean=("actual", "mean"),
    ).merge(materials, on="material_id", how="left")
    lead_months = forecast["lead_time_days"] / 30.4375
    forecast["reorder_point"] = forecast["monthly_p90"] * lead_months
    forecast["safety_stock"] = (forecast["monthly_p90"] - forecast["monthly_p50"]).clip(lower=0) * np.sqrt(lead_months.clip(lower=1 / 30))
    forecast["proposed_min"] = forecast["reorder_point"] + forecast["safety_stock"]
    forecast["raw_order_quantity"] = (forecast["monthly_p50"] * 2 - forecast["proposed_min"]).clip(lower=0)
    forecast["order_quantity"] = np.maximum(forecast["raw_order_quantity"], forecast["moq"])
    forecast["order_quantity"] = np.ceil(forecast["order_quantity"] / forecast["order_multiple"]) * forecast["order_multiple"]
    forecast["proposed_max"] = forecast["proposed_min"] + forecast["order_quantity"]
    forecast["policy_source"] = "CONTROLLED_SYNTHETIC_CONFORMAL_P90"
    return forecast


def plot_all(
    demand: pd.DataFrame,
    leaderboard: pd.DataFrame,
    rows: pd.DataFrame,
    bands: pd.DataFrame,
    champion: str,
    gain: pd.DataFrame,
    permutation: pd.DataFrame,
    output_dir: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    output_dir.mkdir(parents=True, exist_ok=True)
    monthly = demand.groupby("month", as_index=False).agg(actual=("demand_units", "sum"), planned=("planned_bom_requirement", "sum"))
    fig, ax = plt.subplots(figsize=(13, 5))
    ax.plot(pd.to_datetime(monthly["month"]), monthly["actual"], label="Generated actual RM/PM usage")
    ax.plot(pd.to_datetime(monthly["month"]), monthly["planned"], label="Known BOM-plan requirement", alpha=0.8)
    ax.set(title="Controlled demand-generating process", ylabel="Units", xlabel="Month")
    ax.legend()
    fig.tight_layout(); fig.savefig(output_dir / "01_generated_demand_vs_bom_plan.png", dpi=170); plt.close(fig)

    plot = leaderboard.sort_values("WAPE")
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.barh(plot["model"], plot["WAPE"], color="#2563eb")
    ax.invert_yaxis(); ax.set(title="Untouched 12-origin test leaderboard", xlabel="WAPE", ylabel="")
    fig.tight_layout(); fig.savefig(output_dir / "02_model_leaderboard.png", dpi=170); plt.close(fig)

    selected = rows[rows["model"].eq(champion)]
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    axes[0, 0].hist(selected["error"], bins=65, color="#2563eb", alpha=0.8); axes[0, 0].axvline(0, color="black"); axes[0, 0].set_title("Residual distribution")
    stats.probplot(selected["error"], dist="norm", plot=axes[0, 1]); axes[0, 1].set_title("Q-Q plot")
    axes[1, 0].scatter(selected["prediction"], selected["error"], s=11, alpha=0.25); axes[1, 0].axhline(0, color="black"); axes[1, 0].set(title="Residual vs fitted", xlabel="Prediction", ylabel="Prediction - actual")
    limit = max(selected["actual"].max(), selected["prediction"].max()); axes[1, 1].scatter(selected["actual"], selected["prediction"], s=11, alpha=0.25); axes[1, 1].plot([0, limit], [0, limit], color="black"); axes[1, 1].set(title="Actual vs predicted", xlabel="Actual", ylabel="Predicted")
    fig.suptitle(f"Champion diagnostics: {champion}"); fig.tight_layout(); fig.savefig(output_dir / "03_champion_residual_diagnostics.png", dpi=170); plt.close(fig)

    highest = bands[bands["demand_band"].eq("Q5_highest")].sort_values("WAPE")
    fig, ax = plt.subplots(figsize=(11, 6)); ax.barh(highest["model"], highest["WAPE"], color="#dc2626"); ax.invert_yaxis(); ax.set(title="Highest-demand quintile", xlabel="WAPE", ylabel=""); fig.tight_layout(); fig.savefig(output_dir / "04_high_volume_comparison.png", dpi=170); plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    g = gain.head(12).sort_values("gain_share"); axes[0].barh(g["feature"], g["gain_share"], color="#0f766e"); axes[0].set(title="LightGBM gain", xlabel="Share")
    p = permutation.head(12).sort_values("permuted_WAPE_increase_mean"); axes[1].barh(p["feature"], p["permuted_WAPE_increase_mean"], color="#9333ea"); axes[1].set(title="Held-out permutation", xlabel="WAPE increase")
    fig.tight_layout(); fig.savefig(output_dir / "05_feature_importance.png", dpi=170); plt.close(fig)

    shock = rows.groupby(["model", "shock_flag"], as_index=False).agg(abs_error=("abs_error", "sum"), actual=("actual", "sum")); shock["WAPE"] = shock["abs_error"] / shock["actual"].clip(lower=EPS)
    pivot = shock.pivot(index="model", columns="shock_flag", values="WAPE").fillna(0).sort_values(True if True in shock["shock_flag"].unique() else False)
    fig, ax = plt.subplots(figsize=(11, 6)); pivot.plot(kind="barh", ax=ax, color=["#16a34a", "#f59e0b"]); ax.set(title="Normal versus shock-period error", xlabel="WAPE", ylabel=""); ax.legend(["Normal", "Shock"]); fig.tight_layout(); fig.savefig(output_dir / "06_shock_robustness.png", dpi=170); plt.close(fig)

def plot_feature_importance(gain: pd.DataFrame, permutation: pd.DataFrame, title: str, output_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    g = gain.head(12).sort_values("gain_share")
    axes[0].barh(g["feature"], g["gain_share"], color="#0f766e")
    axes[0].set(title=f"{title} Gain/Importance", xlabel="Share")
    
    p = permutation.head(12).sort_values("permuted_WAPE_increase_mean")
    axes[1].barh(p["feature"], p["permuted_WAPE_increase_mean"], color="#9333ea")
    axes[1].set(title=f"{title} Held-out Permutation", xlabel="WAPE increase")
    
    fig.tight_layout()
    fig.savefig(output_path, dpi=170)
    plt.close(fig)

