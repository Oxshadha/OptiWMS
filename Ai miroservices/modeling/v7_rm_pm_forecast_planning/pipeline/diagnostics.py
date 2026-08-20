from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

try:
    import matplotlib.pyplot as plt
except Exception:
    plt = None

try:
    import scipy.stats as scipy_stats
except Exception:
    scipy_stats = None

try:
    from statsmodels.graphics.tsaplots import plot_acf
except Exception:
    plot_acf = None

from pipeline.features import add_supervised_features


EPS = 1e-9


def build_data_dictionary(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows: list[dict] = []
    for table, df in frames.items():
        for col in df.columns:
            s = df[col]
            rows.append(
                {
                    "dataset": table,
                    "column": col,
                    "dtype": str(s.dtype),
                    "non_null_rows": int(s.notna().sum()),
                    "null_rows": int(s.isna().sum()),
                    "null_pct": float(s.isna().mean()) if len(s) else 0.0,
                    "unique_values": int(s.nunique(dropna=True)),
                    "sample_values": ", ".join(map(str, s.dropna().astype(str).head(3).tolist())),
                }
            )
    return pd.DataFrame(rows)


def build_table_relationships() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "from_dataset": "demand_history",
                "from_column": "material_id",
                "to_dataset": "materials",
                "to_column": "id",
                "relationship": "many demand observations to one material",
                "status": "primary RM/PM history join",
            },
            {
                "from_dataset": "inventory",
                "from_column": "material_id",
                "to_dataset": "materials",
                "to_column": "id",
                "relationship": "many inventory rows to one material",
                "status": "stock reality for policy conversion",
            },
            {
                "from_dataset": "forecast_results",
                "from_column": "material_id",
                "to_dataset": "materials",
                "to_column": "id",
                "relationship": "many forecast horizon rows to one material",
                "status": "canonical operational forecast output",
            },
            {
                "from_dataset": "bom_headers",
                "from_column": "parent_material_id",
                "to_dataset": "materials",
                "to_column": "id",
                "relationship": "one parent material to BOM header",
                "status": "audited only; not production-primary yet",
            },
            {
                "from_dataset": "bom_components",
                "from_column": "component_material_id",
                "to_dataset": "materials",
                "to_column": "id",
                "relationship": "component material consumed by parent",
                "status": "secondary path until BOM coverage improves",
            },
        ]
    )


def build_data_quality_report(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows: list[dict] = []
    for name, df in frames.items():
        duplicate_rows = int(df.duplicated().sum()) if not df.empty else 0
        rows.append(
            {
                "dataset": name,
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "duplicate_rows": duplicate_rows,
                "total_null_cells": int(df.isna().sum().sum()),
                "null_cell_pct": float(df.isna().sum().sum() / max(len(df) * max(len(df.columns), 1), 1)),
            }
        )
    return pd.DataFrame(rows)


def build_outlier_report(panel: pd.DataFrame) -> pd.DataFrame:
    if panel.empty:
        return pd.DataFrame()
    rows: list[dict] = []
    for material_id, g in panel.groupby("material_id"):
        demand = g["demand_units"].astype(float)
        q1 = float(demand.quantile(0.25))
        q3 = float(demand.quantile(0.75))
        iqr = q3 - q1
        lower = max(0.0, q1 - 1.5 * iqr)
        upper = q3 + 1.5 * iqr
        outliers = g[(demand < lower) | (demand > upper)]
        meta = g.iloc[-1]
        rows.append(
            {
                "material_id": material_id,
                "material_code": meta["material_code"],
                "description": meta["description"],
                "material_type": meta["material_type"],
                "months": int(len(g)),
                "zero_months": int((demand == 0).sum()),
                "negative_months": int((demand < 0).sum()),
                "iqr_lower_bound": lower,
                "iqr_upper_bound": upper,
                "outlier_months": int(len(outliers)),
                "max_demand": float(demand.max()),
            }
        )
    return pd.DataFrame(rows).sort_values(["outlier_months", "max_demand"], ascending=[False, False])


def build_feature_matrix_profile(panel: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    supervised, feature_cols = add_supervised_features(panel)
    if supervised.empty:
        return pd.DataFrame(), pd.DataFrame()
    profile = []
    for col in feature_cols + ["target"]:
        s = supervised[col]
        profile.append(
            {
                "column": col,
                "dtype": str(s.dtype),
                "non_null_rows": int(s.notna().sum()),
                "null_rows": int(s.isna().sum()),
                "mean": float(s.mean()) if pd.api.types.is_numeric_dtype(s) else np.nan,
                "std": float(s.std()) if pd.api.types.is_numeric_dtype(s) else np.nan,
                "min": float(s.min()) if pd.api.types.is_numeric_dtype(s) else np.nan,
                "max": float(s.max()) if pd.api.types.is_numeric_dtype(s) else np.nan,
            }
        )
    return supervised, pd.DataFrame(profile)


def build_rolling_origin_splits(panel: pd.DataFrame, backtest_months: int, history_min_months: int) -> pd.DataFrame:
    if panel.empty:
        return pd.DataFrame()
    panel = panel.copy()
    panel["month"] = pd.to_datetime(panel["month"]).dt.to_period("M").dt.to_timestamp()
    months = sorted(panel["month"].unique())
    cutoff_months = months[-backtest_months:]
    rows = []
    for fold, test_month in enumerate(cutoff_months, start=1):
        train = panel[panel["month"] < test_month]
        test = panel[panel["month"].eq(test_month)]
        eligible = train.groupby("material_id")["month"].nunique()
        eligible_materials = int((eligible >= history_min_months).sum())
        rows.append(
            {
                "fold": fold,
                "train_start": str(train["month"].min().date()) if not train.empty else None,
                "train_end": str(train["month"].max().date()) if not train.empty else None,
                "test_month": str(pd.Timestamp(test_month).date()),
                "train_rows": int(len(train)),
                "test_rows": int(len(test)),
                "eligible_materials": eligible_materials,
            }
        )
    return pd.DataFrame(rows)


def combine_backtest_rows(baseline_eval: pd.DataFrame, lgb_eval: pd.DataFrame) -> pd.DataFrame:
    rows = pd.concat([baseline_eval, lgb_eval], ignore_index=True)
    if rows.empty:
        return rows
    rows = rows.copy()
    rows["month"] = pd.to_datetime(rows["month"]).dt.to_period("M").dt.to_timestamp()
    rows["residual"] = rows["prediction"] - rows["actual"]
    rows["abs_error"] = rows["residual"].abs()
    rows["squared_error"] = np.square(rows["residual"])
    rows["ape"] = rows["abs_error"] / rows["actual"].abs().replace(0, np.nan)
    rows["under_forecast"] = rows["prediction"] < rows["actual"]
    return rows


def build_per_material_metrics(backtest_rows: pd.DataFrame) -> pd.DataFrame:
    if backtest_rows.empty:
        return pd.DataFrame()
    out = []
    for (model, material_id), g in backtest_rows.groupby(["model", "material_id"]):
        denom = max(float(g["actual"].abs().sum()), EPS)
        meta = g.iloc[-1]
        err = g["prediction"] - g["actual"]
        out.append(
            {
                "model": model,
                "material_id": material_id,
                "material_code": meta["material_code"],
                "description": meta["description"],
                "material_type": meta["material_type"],
                "rows": int(len(g)),
                "actual_sum": float(g["actual"].sum()),
                "prediction_sum": float(g["prediction"].sum()),
                "WAPE": float(g["abs_error"].sum() / denom),
                "MAE": float(g["abs_error"].mean()),
                "RMSE": float(np.sqrt(np.mean(np.square(err)))),
                "Bias": float(err.sum() / denom),
                "under_forecast_rate": float(g["under_forecast"].mean()),
            }
        )
    return pd.DataFrame(out).sort_values(["model", "WAPE"], ascending=[True, False])


def build_interval_calibration(selected_rows: pd.DataFrame) -> pd.DataFrame:
    if selected_rows.empty:
        return pd.DataFrame()
    rows = selected_rows.copy()
    denom = rows["actual"].abs().replace(0, np.nan)
    rel_err = ((rows["prediction"] - rows["actual"]) / denom).replace([np.inf, -np.inf], np.nan).dropna()
    q10 = float(rel_err.quantile(0.10)) if not rel_err.empty else -0.2
    q90 = float(rel_err.quantile(0.90)) if not rel_err.empty else 0.2
    q10 = min(q10, -0.05)
    q90 = max(q90, 0.05)
    rows["p10"] = (rows["prediction"] * (1.0 + q10)).clip(lower=0)
    rows["p90"] = (rows["prediction"] * (1.0 + q90)).clip(lower=rows["prediction"])
    rows["inside_p10_p90"] = (rows["actual"] >= rows["p10"]) & (rows["actual"] <= rows["p90"])
    rows["interval_width"] = rows["p90"] - rows["p10"]
    by_model = rows.groupby("model", as_index=False).agg(
        rows=("actual", "size"),
        coverage=("inside_p10_p90", "mean"),
        avg_interval_width=("interval_width", "mean"),
        p10=("p10", "mean"),
        p90=("p90", "mean"),
    )
    by_model["target_coverage"] = 0.80
    by_model["calibration_gap"] = by_model["coverage"] - by_model["target_coverage"]
    return by_model


def build_statistical_comparison(backtest_rows: pd.DataFrame, selected_model: str) -> pd.DataFrame:
    if backtest_rows.empty:
        return pd.DataFrame()
    key_cols = ["material_id", "month"]
    selected = backtest_rows[backtest_rows["model"].eq(selected_model)][key_cols + ["abs_error"]].rename(columns={"abs_error": "selected_abs_error"})
    rows = []
    for model, g in backtest_rows.groupby("model"):
        if model == selected_model:
            continue
        paired = selected.merge(g[key_cols + ["abs_error"]].rename(columns={"abs_error": "candidate_abs_error"}), on=key_cols, how="inner")
        if paired.empty:
            continue
        delta = paired["selected_abs_error"] - paired["candidate_abs_error"]
        mean_delta = float(delta.mean())
        p_value = np.nan
        if scipy_stats is not None and len(delta) > 2 and float(delta.std()) > 0:
            p_value = float(scipy_stats.ttest_1samp(delta, 0.0).pvalue)
        rows.append(
            {
                "selected_model": selected_model,
                "candidate_model": model,
                "paired_rows": int(len(paired)),
                "mean_abs_error_delta_selected_minus_candidate": mean_delta,
                "selected_better_when_negative": mean_delta < 0,
                "paired_ttest_p_value": p_value,
                "test_note": "Paired absolute-error comparison on common material-month backtest rows.",
            }
        )
    return pd.DataFrame(rows).sort_values("mean_abs_error_delta_selected_minus_candidate")


def build_feature_importance(model, feature_cols: list[str]) -> pd.DataFrame:
    if model is None or not feature_cols:
        return pd.DataFrame(columns=["feature", "importance_gain", "importance_split"])
    booster = getattr(model, "booster_", None)
    if booster is not None:
        gain = booster.feature_importance(importance_type="gain")
        split = booster.feature_importance(importance_type="split")
    else:
        gain = getattr(model, "feature_importances_", np.zeros(len(feature_cols)))
        split = gain
    out = pd.DataFrame({"feature": feature_cols, "importance_gain": gain, "importance_split": split})
    total = max(float(out["importance_gain"].sum()), EPS)
    out["importance_gain_share"] = out["importance_gain"] / total
    return out.sort_values("importance_gain", ascending=False)


def plot_data_quality(report: pd.DataFrame, out_path: Path) -> None:
    if plt is None or report.empty:
        return
    plot = report.sort_values("null_cell_pct", ascending=False)
    plt.figure(figsize=(10, 4))
    plt.bar(plot["dataset"], plot["null_cell_pct"] * 100)
    plt.ylabel("Null cell %")
    plt.title("v7 Data Quality - Missing Cell Rate")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def plot_abc_fms(classes: pd.DataFrame, out_path: Path) -> None:
    if plt is None or classes.empty:
        return
    matrix = classes.groupby(["abc_class", "fms_class"]).size().unstack(fill_value=0)
    fig, ax = plt.subplots(figsize=(6, 4))
    im = ax.imshow(matrix.values, cmap="YlGnBu")
    ax.set_xticks(range(len(matrix.columns)), matrix.columns)
    ax.set_yticks(range(len(matrix.index)), matrix.index)
    ax.set_xlabel("FMS class")
    ax.set_ylabel("ABC class")
    ax.set_title("RM/PM ABC-FMS Material Count")
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(j, i, int(matrix.values[i, j]), ha="center", va="center")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def plot_seasonality(panel: pd.DataFrame, out_path: Path) -> None:
    if plt is None or panel.empty:
        return
    p = panel.copy()
    p["month_num"] = pd.to_datetime(p["month"]).dt.month
    month_avg = p.groupby("month_num", as_index=False)["demand_units"].mean()
    overall = max(float(month_avg["demand_units"].mean()), EPS)
    month_avg["seasonality_index"] = month_avg["demand_units"] / overall
    plt.figure(figsize=(9, 4))
    plt.plot(month_avg["month_num"], month_avg["seasonality_index"], marker="o")
    plt.axhline(1.0, color="gray", linestyle="--", linewidth=1)
    plt.xticks(range(1, 13))
    plt.xlabel("Calendar month")
    plt.ylabel("Index vs monthly mean")
    plt.title("RM/PM Mean Seasonality Index")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def plot_residual_diagnostics(selected_rows: pd.DataFrame, out_path: Path) -> None:
    if plt is None or selected_rows.empty:
        return
    rows = selected_rows.copy().sort_values("month")
    residuals = rows["residual"].astype(float)
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    axes[0, 0].hist(residuals, bins=40, color="#2563eb", alpha=0.75)
    axes[0, 0].axvline(0, color="black", linewidth=1)
    axes[0, 0].set_title("Residual distribution")
    axes[0, 0].set_xlabel("prediction - actual")
    if scipy_stats is not None:
        scipy_stats.probplot(residuals.sample(min(len(residuals), 500), random_state=42), plot=axes[0, 1])
        axes[0, 1].set_title("Q-Q plot")
    else:
        axes[0, 1].scatter(rows["prediction"], residuals, alpha=0.25, s=8)
        axes[0, 1].axhline(0, color="black", linewidth=1)
        axes[0, 1].set_title("Residual vs fitted")
    axes[1, 0].scatter(rows["prediction"], residuals, alpha=0.2, s=8)
    axes[1, 0].axhline(0, color="black", linewidth=1)
    axes[1, 0].set_title("Residual vs fitted")
    if plot_acf is not None and len(residuals) > 20:
        plot_acf(residuals.head(500), lags=min(20, len(residuals) - 1), ax=axes[1, 1])
        axes[1, 1].set_title("Residual autocorrelation")
    else:
        monthly = rows.groupby("month", as_index=False)["residual"].mean()
        axes[1, 1].plot(monthly["month"], monthly["residual"], marker="o")
        axes[1, 1].axhline(0, color="black", linewidth=1)
        axes[1, 1].set_title("Mean residual over time")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def plot_actual_vs_predicted(selected_rows: pd.DataFrame, out_path: Path) -> None:
    if plt is None or selected_rows.empty:
        return
    rows = selected_rows.copy()
    plt.figure(figsize=(6, 6))
    plt.scatter(rows["actual"], rows["prediction"], alpha=0.25, s=10)
    limit = max(float(rows["actual"].max()), float(rows["prediction"].max()), 1.0)
    plt.plot([0, limit], [0, limit], color="black", linewidth=1)
    plt.xlabel("Actual demand")
    plt.ylabel("Predicted demand")
    plt.title("Backtest Actual vs Predicted")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def plot_feature_importance(importances: pd.DataFrame, out_path: Path) -> None:
    if plt is None or importances.empty:
        return
    plot = importances.head(20).sort_values("importance_gain")
    plt.figure(figsize=(9, 6))
    plt.barh(plot["feature"], plot["importance_gain"])
    plt.xlabel("Gain importance")
    plt.title("LightGBM Feature Importance")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()

