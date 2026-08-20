from __future__ import annotations

import argparse
import hashlib
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor

from pipeline.explainability import explain_frame
from pipeline.modeling import CAUSAL_FEATURES, build_features


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
DATA = OUTPUT / "data"
MODEL_NAME = "PROJECT_OPS_EXTRA_TREES_CAUSAL"
DATASET = "PROJECT_OPS_RM_PM"
DEFAULT_HORIZON = 12


def _new_model() -> ExtraTreesRegressor:
    return ExtraTreesRegressor(
        n_estimators=220,
        max_depth=16,
        min_samples_leaf=4,
        max_features=0.75,
        random_state=42,
        n_jobs=2,
    )


def _same_month_plan_proxy(
    history: pd.DataFrame,
    forecast_month: pd.Timestamp,
) -> pd.DataFrame:
    """Create origin-available future covariates without using future actual demand.

    The project simulation has no independently issued plan beyond its final
    observed month. For serving, the most recently observed same-calendar-month
    plan is carried forward and explicitly labelled as a proxy. A real issued
    plan can replace these rows without changing the model contract.
    """
    prior = history[history["month"].dt.month.eq(forecast_month.month)].copy()
    prior = prior.sort_values(["material_id", "month"]).groupby("material_id").tail(1)
    if prior["material_id"].nunique() != history["material_id"].nunique():
        raise ValueError(f"Missing same-month plan proxy for {forecast_month.date()}")
    prior["month"] = forecast_month
    prior["demand_units"] = 0.0
    prior["actual_bom_requirement"] = np.nan
    prior["shock_flag"] = False
    prior["known_future_source"] = "SAME_MONTH_PROJECT_PLAN_PROXY"
    return prior


def recursive_forecast(
    model: ExtraTreesRegressor,
    history: pd.DataFrame,
    future_covariates: pd.DataFrame,
    origin: pd.Timestamp,
    horizon: int = DEFAULT_HORIZON,
    explain_sink: list[pd.DataFrame] | None = None,
) -> pd.DataFrame:
    """Forecast H1-H12 recursively while never inserting future actual demand.

    When ``explain_sink`` is supplied, each step's SHAP attributions are appended
    to it. They are computed from the same frame the step predicted on, so the
    explanation describes the prediction that was actually served rather than a
    reconstruction of it.
    """
    explainer = None
    working = history[history["month"] < origin].copy()
    rows: list[pd.DataFrame] = []
    months = pd.date_range(origin, periods=horizon, freq="MS")
    for step, month in enumerate(months, start=1):
        future = future_covariates[future_covariates["month"].eq(month)].copy()
        if future.empty:
            raise ValueError(f"No known-future covariates for {month.date()}")
        future["demand_units"] = 0.0
        candidate = pd.concat([working, future], ignore_index=True, sort=False)
        features = build_features(candidate)
        target = features[features["target_month"].eq(month)].copy()
        if target["material_id"].nunique() != history["material_id"].nunique():
            raise ValueError(f"Incomplete feature rows for {month.date()}")
        prediction = np.clip(
            np.expm1(model.predict(target[CAUSAL_FEATURES])),
            0.0,
            None,
        )
        step_rows = target[
            ["material_id", "material_code", "material_type", "target_month"]
        ].copy()
        step_rows["horizon"] = step
        step_rows["prediction"] = prediction
        rows.append(step_rows)

        if explain_sink is not None:
            if explainer is None:
                import shap

                explainer = shap.TreeExplainer(model)
            explain_sink.append(
                explain_frame(
                    model,
                    target[CAUSAL_FEATURES],
                    step_rows[["material_id", "material_code", "target_month"]],
                    horizon=step,
                    explainer=explainer,
                )
            )

        future["demand_units"] = prediction
        working = pd.concat([working, future], ignore_index=True, sort=False)
    return pd.concat(rows, ignore_index=True)


def _future_covariates(demand: pd.DataFrame, origin: pd.Timestamp, horizon: int) -> pd.DataFrame:
    future = [
        _same_month_plan_proxy(demand, month)
        for month in pd.date_range(origin, periods=horizon, freq="MS")
    ]
    return pd.concat(future, ignore_index=True, sort=False)


def _metrics(rows: pd.DataFrame) -> pd.DataFrame:
    records: list[dict] = []
    for horizon, group in rows.groupby("horizon"):
        denominator = max(float(group["actual"].abs().sum()), 1e-9)
        error = group["prediction"] - group["actual"]
        records.append(
            {
                "split": "recursive_untouched_test",
                "horizon": int(horizon),
                "rows": int(len(group)),
                "WAPE": float(error.abs().sum() / denominator),
                "MAE": float(error.abs().mean()),
                "RMSE": float(np.sqrt(np.mean(np.square(error)))),
                "Bias": float(error.sum() / denominator),
                "under_forecast_rate": float((error < 0).mean()),
            }
        )
    all_error = rows["prediction"] - rows["actual"]
    denominator = max(float(rows["actual"].abs().sum()), 1e-9)
    records.append(
        {
            "split": "recursive_untouched_test",
            "horizon": 0,
            "rows": int(len(rows)),
            "WAPE": float(all_error.abs().sum() / denominator),
            "MAE": float(all_error.abs().mean()),
            "RMSE": float(np.sqrt(np.mean(np.square(all_error)))),
            "Bias": float(all_error.sum() / denominator),
            "under_forecast_rate": float((all_error < 0).mean()),
        }
    )
    return pd.DataFrame(records).sort_values("horizon").reset_index(drop=True)


def _neural_comparison(backtest: pd.DataFrame, output: Path) -> pd.DataFrame:
    neural_path = output / "evaluator" / "backtest_rows.csv.gz"
    if not neural_path.exists():
        return pd.DataFrame()
    neural = pd.read_csv(neural_path)
    neural = neural[
        neural["split"].eq("untouched_test")
        & neural["model_name"].eq("CONV1D_ATTENTION_GLOBAL")
    ][["material_code", "forecast_month", "y_true", "prediction"]].copy()
    neural["forecast_month"] = pd.to_datetime(neural["forecast_month"])
    paired = backtest.merge(
        neural,
        left_on=["material_code", "target_month"],
        right_on=["material_code", "forecast_month"],
        how="inner",
        suffixes=("_extra_trees", "_neural"),
        validate="one_to_one",
    )
    if len(paired) != len(backtest):
        raise ValueError(
            f"Neural comparison row mismatch: expected {len(backtest)}, got {len(paired)}"
        )
    paired["extra_trees_abs_error"] = (
        paired["actual"] - paired["prediction_extra_trees"]
    ).abs()
    paired["neural_abs_error"] = (
        paired["actual"] - paired["prediction_neural"]
    ).abs()
    paired["loss_difference"] = (
        paired["extra_trees_abs_error"] - paired["neural_abs_error"]
    )
    monthly = paired.groupby("target_month", as_index=False).agg(
        loss_difference=("loss_difference", "mean"),
        extra_trees_abs_error=("extra_trees_abs_error", "sum"),
        neural_abs_error=("neural_abs_error", "sum"),
    )

    import statsmodels.api as sm

    hac = sm.OLS(
        monthly["loss_difference"].to_numpy(),
        np.ones((len(monthly), 1)),
    ).fit(cov_type="HAC", cov_kwds={"maxlags": 3})
    rng = np.random.default_rng(20260711)
    values = monthly["loss_difference"].to_numpy()
    block_length = 3
    circular = np.concatenate([values, values[: block_length - 1]])
    boot = []
    for _ in range(5000):
        starts = rng.integers(0, len(values), size=int(np.ceil(len(values) / block_length)))
        sample = np.concatenate(
            [circular[start : start + block_length] for start in starts]
        )[: len(values)]
        boot.append(float(sample.mean()))
    ci_low, ci_high = np.quantile(boot, [0.025, 0.975])
    actual_total = max(float(paired["actual"].abs().sum()), 1e-9)
    et_wape = float(paired["extra_trees_abs_error"].sum() / actual_total)
    neural_wape = float(paired["neural_abs_error"].sum() / actual_total)
    return pd.DataFrame(
        [
            {
                "champion": MODEL_NAME,
                "challenger": "CONV1D_ATTENTION_GLOBAL",
                "paired_rows": int(len(paired)),
                "months": int(len(monthly)),
                "champion_WAPE": et_wape,
                "challenger_WAPE": neural_wape,
                "relative_WAPE_improvement": float(
                    (neural_wape - et_wape) / max(neural_wape, 1e-9)
                ),
                "mean_monthly_absolute_error_difference": float(values.mean()),
                "circular_block_bootstrap_ci_low": float(ci_low),
                "circular_block_bootstrap_ci_high": float(ci_high),
                "HAC_t_statistic": float(hac.tvalues[0]),
                "HAC_p_value": float(hac.pvalues[0]),
                "Holm_adjusted_p_value": float(hac.pvalues[0]),
                "decision": (
                    "RETAIN_EXTRA_TREES"
                    if et_wape < neural_wape and ci_high < 0
                    else "NO_STATISTICALLY_SUPPORTED_CHANGE"
                ),
            }
        ]
    )


def build_operational_forecast(output: Path = OUTPUT) -> dict:
    demand = pd.read_csv(DATA / "material_demand.csv", parse_dates=["month"])
    supervised = build_features(demand)
    test_origin = pd.Timestamp(demand["month"].max()).to_period("Y").start_time

    # Evaluate the actual serving algorithm on the untouched final year.
    backtest_train = supervised[supervised["target_month"] < test_origin].copy()
    backtest_model = _new_model()
    backtest_model.fit(
        backtest_train[CAUSAL_FEATURES],
        np.log1p(backtest_train["target"]),
    )
    known_test_covariates = demand[
        demand["month"].between(test_origin, demand["month"].max())
    ].copy()
    backtest = recursive_forecast(
        backtest_model,
        demand,
        known_test_covariates,
        test_origin,
        DEFAULT_HORIZON,
    )
    actual = demand[
        demand["month"].between(test_origin, demand["month"].max())
    ][["month", "material_code", "demand_units"]].rename(
        columns={"month": "target_month", "demand_units": "actual"}
    )
    backtest = backtest.merge(
        actual,
        on=["target_month", "material_code"],
        how="left",
        validate="one_to_one",
    )
    metrics = _metrics(backtest)
    backtest["absolute_error"] = (
        backtest["actual"] - backtest["prediction"]
    ).abs()
    comparison = _neural_comparison(backtest, output)

    # Refit the locked family on every accepted row and create a future snapshot.
    model = _new_model()
    model.fit(supervised[CAUSAL_FEATURES], np.log1p(supervised["target"]))
    origin = demand["month"].max().to_period("M").to_timestamp() + pd.offsets.MonthBegin(1)
    future = _future_covariates(demand, origin, DEFAULT_HORIZON)
    explanations: list[pd.DataFrame] = []
    forecast = recursive_forecast(
        model, demand, future, origin, DEFAULT_HORIZON, explain_sink=explanations
    )

    selection = pd.read_csv(output / "selection_backtest_rows.csv")
    selection = selection[selection["model"].eq("extra_trees_causal")].copy()
    normalized_error = (
        (selection["actual"] - selection["prediction"]).abs()
        / selection["prediction"].clip(lower=1.0)
    )
    # Symmetric P10-P90 serving interval: 80% central calibration mass.
    normalized_radius = float(normalized_error.quantile(0.80))
    forecast["p50"] = forecast["prediction"]
    forecast["p10"] = np.clip(
        forecast["p50"] - normalized_radius * np.maximum(forecast["p50"], 1.0),
        0.0,
        None,
    )
    forecast["p90"] = (
        forecast["p50"] + normalized_radius * np.maximum(forecast["p50"], 1.0)
    )
    forecast["forecast_period"] = forecast["target_month"].dt.date.astype(str)
    forecast["model_name"] = MODEL_NAME
    forecast["dataset"] = DATASET
    forecast["training_source"] = "project_ops_v8"
    forecast["known_future_source"] = "SAME_MONTH_PROJECT_PLAN_PROXY"
    forecast["decision_eligible"] = True
    forecast["external_population_validity"] = "UNVERIFIED"

    output.mkdir(parents=True, exist_ok=True)
    forecast_path = output / "operational_forecasts.csv"
    metrics_path = output / "operational_backtest_metrics.csv"
    backtest_path = output / "operational_recursive_backtest_rows.csv.gz"
    forecast.to_csv(forecast_path, index=False)
    metrics.to_csv(metrics_path, index=False)
    if explanations:
        shap_frame = pd.concat(explanations, ignore_index=True)
        shap_frame["model_name"] = MODEL_NAME
        shap_frame["dataset"] = DATASET
        shap_frame.to_csv(output / "operational_shap.csv", index=False)
    backtest.to_csv(backtest_path, index=False, compression="gzip")
    if not comparison.empty:
        comparison.to_csv(output / "operational_model_comparison.csv", index=False)

    bundle = output / "serving_bundle" / "production"
    bundle.mkdir(parents=True, exist_ok=True)
    model_path = bundle / "model.pkl"
    with model_path.open("wb") as handle:
        pickle.dump(model, handle)
    source_hash = hashlib.sha256((DATA / "material_demand.csv").read_bytes()).hexdigest()
    aggregate = metrics[metrics["horizon"].eq(0)].iloc[0].to_dict()
    challenger_decision = (
        comparison.iloc[0].to_dict() if not comparison.empty else None
    )
    metadata = {
        "model_id": "V8_CONTROLLED_EXTRA_TREES_CAUSAL",
        "model_name": MODEL_NAME,
        "dataset": DATASET,
        "model_family": "ExtraTreesRegressor",
        "model_cols": CAUSAL_FEATURES,
        "target_transform": "log1p",
        "inference_strategy": "recursive_one_step",
        "forecast_origin": origin.date().isoformat(),
        "horizons": list(range(1, DEFAULT_HORIZON + 1)),
        "training_rows": int(len(supervised)),
        "training_through": demand["month"].max().date().isoformat(),
        "source_sha256": source_hash,
        "known_future_policy": "same-month project-plan proxy; replaceable by issued timestamped plan",
        "serving_interval": {
            "quantiles": ["P10", "P50", "P90"],
            "calibration_split": "selection",
            "normalized_absolute_error_quantile": 0.80,
            "normalized_radius": normalized_radius,
        },
        "project_operational_decision_eligible": True,
        "external_population_validity": "UNVERIFIED",
        "recursive_untouched_test": aggregate,
        "neural_challenger_comparison": challenger_decision,
    }
    (bundle / "metadata.json").write_text(
        json.dumps(metadata, indent=2, default=str),
        encoding="utf-8",
    )
    return {
        "status": "ready",
        "dataset": DATASET,
        "model_name": MODEL_NAME,
        "forecast_rows": int(len(forecast)),
        "materials": int(forecast["material_code"].nunique()),
        "horizons": DEFAULT_HORIZON,
        "forecast_origin": origin.date().isoformat(),
        "recursive_test_WAPE": float(aggregate["WAPE"]),
        "recursive_test_Bias": float(aggregate["Bias"]),
        "neural_challenger_decision": (
            challenger_decision["decision"] if challenger_decision else "NOT_AVAILABLE"
        ),
        "forecast_file": str(forecast_path),
        "model_bundle": str(bundle),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refit and package the locked v8 Extra Trees project-operational champion."
    )
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    print(json.dumps(build_operational_forecast(args.output), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
