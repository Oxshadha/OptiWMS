from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parent
MODELING_ROOT = ROOT.parent
if str(MODELING_ROOT) not in sys.path:
    sys.path.insert(0, str(MODELING_ROOT))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from evaluator_forecasting.contracts import EvaluatorConfig
from evaluator_forecasting.features import build_prediction_windows, build_training_windows
from evaluator_forecasting.neural import save_normalization, train_ensemble
from evaluator_forecasting.statistics import (
    aggregate_metrics,
    assumption_registry,
    calibrate_intervals,
    claim_evidence_matrix,
    decision_cost_sensitivity,
    interval_calibration,
    model_comparisons,
    residual_diagnostics,
    slice_metrics,
    spectral_stationarity_audit,
)
from pipeline.forecasting import ForecastConfig, _features, _forecast_panel, _recursive_backtest


def _json_default(value):
    if isinstance(value, (pd.Timestamp, np.datetime64)):
        return str(pd.Timestamp(value))
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    raise TypeError(type(value).__name__)


def _baseline_backtest(panel: pd.DataFrame, origins: list[pd.Timestamp], seed: int, trees: int) -> pd.DataFrame:
    rows = _recursive_backtest(
        _features(panel),
        origins,
        ForecastConfig(selection_months=12, test_months=12, minimum_history=24, trees=trees, seed=seed),
    )
    rows["origin_month"] = pd.to_datetime(rows["origin_month"])
    rows["forecast_month"] = pd.to_datetime(rows["forecast_month"])
    return rows


def _rm_pm(rows: pd.DataFrame) -> pd.DataFrame:
    return rows[rows["material_type"].isin(["raw_material", "packaging_material"])]


def _population_metrics(rows: pd.DataFrame, split: str) -> pd.DataFrame:
    frames = [
        aggregate_metrics(_rm_pm(rows), split).assign(population="RM_PM_PRIMARY"),
        aggregate_metrics(rows[rows["material_type"].eq("product")], split).assign(
            population="FG_SECONDARY"
        ),
        aggregate_metrics(rows, split).assign(population="ALL_GLOBAL_SERIES"),
    ]
    return pd.concat(frames, ignore_index=True)


def _population_decisions(rows: pd.DataFrame) -> pd.DataFrame:
    frames = [
        decision_cost_sensitivity(_rm_pm(rows)).assign(population="RM_PM_PRIMARY"),
        decision_cost_sensitivity(rows[rows["material_type"].eq("product")]).assign(
            population="FG_SECONDARY"
        ),
    ]
    return pd.concat(frames, ignore_index=True)


def _run_neural_origins(
    panel: pd.DataFrame,
    origins: list[pd.Timestamp],
    cfg: EvaluatorConfig,
    output_dir: Path,
    *,
    explain: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[pd.Timestamp, object]]:
    rows = []
    seed_metrics = []
    results = {}
    normalizer_dir = output_dir / "normalization"
    normalizer_dir.mkdir(parents=True, exist_ok=True)
    for origin in origins:
        training = build_training_windows(panel, origin, cfg.history, cfg.horizon)
        prediction = build_prediction_windows(panel, origin, cfg.history, cfg.horizon)
        result = train_ensemble(training, prediction, cfg, explain=explain)
        result.rows["origin_month"] = origin
        result.rows["forecast_month"] = pd.to_datetime(result.rows["forecast_month"])
        result.seed_metrics["origin_month"] = origin
        save_normalization(result.normalization, normalizer_dir / f"{origin:%Y-%m-%d}.json")
        rows.append(result.rows)
        seed_metrics.append(result.seed_metrics)
        results[origin] = result
    return pd.concat(rows, ignore_index=True), pd.concat(seed_metrics, ignore_index=True), results


def _add_domain_context(rows: pd.DataFrame, panel: pd.DataFrame, output_dir: Path) -> pd.DataFrame:
    context_columns = [
        "material_id",
        "month",
        "promotion_flag",
        "shutdown_flag",
        "supplier_disruption_flag",
    ]
    context = panel[context_columns].rename(columns={"month": "forecast_month"}).copy()
    context["forecast_month"] = pd.to_datetime(context["forecast_month"])
    result = rows.merge(context, on=["material_id", "forecast_month"], how="left")
    classes = pd.read_csv(output_dir.parent / "material_classifications.csv.gz")
    result = result.merge(
        classes[["material_id", "abc_class", "fms_class", "amalgamated_class"]],
        on="material_id",
        how="left",
    )
    return result


def _plots(
    output_dir: Path,
    leaderboard: pd.DataFrame,
    ablations: pd.DataFrame,
    attention: pd.DataFrame,
    spectral: pd.DataFrame,
    residual_rows: pd.DataFrame,
    champion: str,
    decision: pd.DataFrame,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plots = output_dir / "plots"
    plots.mkdir(parents=True, exist_ok=True)

    test = leaderboard[
        leaderboard["split"].eq("untouched_test")
        & leaderboard["population"].eq("RM_PM_PRIMARY")
    ].sort_values("WAPE")
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.barh(test["model_name"], test["WAPE"], color="#2563eb")
    ax.invert_yaxis()
    ax.set(title="Untouched 2025 H1-H12 model leaderboard", xlabel="WAPE", ylabel="")
    fig.tight_layout()
    fig.savefig(plots / "01_evaluator_model_leaderboard.png", dpi=170)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 5))
    ordered = ablations.sort_values("WAPE")
    ax.barh(ordered["feature_group"], ordered["WAPE"], color="#0f766e")
    ax.invert_yaxis()
    ax.set(title="Conv1D-attention feature-group ablation", xlabel="Selection-origin WAPE")
    fig.tight_layout()
    fig.savefig(plots / "02_neural_feature_ablation.png", dpi=170)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(attention["lag_position"], attention["mean_attention_weight"], marker="o")
    ax.set(
        title="Mean self-attention by historical lag (descriptive, not causal)",
        xlabel="Lag month",
        ylabel="Mean attention weight",
    )
    fig.tight_layout()
    fig.savefig(plots / "03_attention_lag_profile.png", dpi=170)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].hist(spectral["annual_power_ratio"], bins=25, color="#9333ea")
    axes[0].set(title="Annual spectral power across series", xlabel="Annual power ratio")
    axes[1].scatter(spectral["annual_power_ratio"], spectral["seasonal_strength"], alpha=0.6)
    axes[1].set(title="Frequency and STL seasonality evidence", xlabel="Annual power", ylabel="STL strength")
    fig.tight_layout()
    fig.savefig(plots / "04_frequency_domain_evidence.png", dpi=170)
    plt.close(fig)

    selected = residual_rows[residual_rows["model_name"].eq(champion)]
    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    axes[0, 0].hist(selected["residual"], bins=50, color="#2563eb")
    axes[0, 0].set_title("Residual distribution")
    stats = selected.groupby("forecast_month", as_index=False)["residual"].mean()
    axes[0, 1].plot(stats["forecast_month"], stats["residual"], marker="o")
    axes[0, 1].axhline(0, color="black")
    axes[0, 1].set_title("Mean residual over time")
    axes[1, 0].scatter(selected["prediction"], selected["residual"], alpha=0.25, s=10)
    axes[1, 0].axhline(0, color="black")
    axes[1, 0].set(title="Residual versus fitted", xlabel="Prediction", ylabel="Residual")
    limit = max(selected["y_true"].max(), selected["prediction"].max())
    axes[1, 1].scatter(selected["y_true"], selected["prediction"], alpha=0.25, s=10)
    axes[1, 1].plot([0, limit], [0, limit], color="black")
    axes[1, 1].set(title="Actual versus predicted", xlabel="Actual", ylabel="Prediction")
    fig.suptitle(f"Champion diagnostics: {champion}")
    fig.tight_layout()
    fig.savefig(plots / "05_champion_residual_diagnostics.png", dpi=170)
    plt.close(fig)

    pivot = decision[decision["population"].eq("RM_PM_PRIMARY")].pivot(
        index="model_name", columns="under_to_over_cost_ratio", values="weighted_total_cost_proxy"
    )
    pivot = pivot.loc[test["model_name"]]
    fig, ax = plt.subplots(figsize=(12, 7))
    pivot.plot(kind="barh", ax=ax)
    ax.set(title="Under/over forecast cost sensitivity", xlabel="Weighted cost proxy", ylabel="")
    fig.tight_layout()
    fig.savefig(plots / "06_decision_cost_sensitivity.png", dpi=170)
    plt.close(fig)


def run(output_dir: Path, cfg: EvaluatorConfig, quick: bool = False) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    panel = _forecast_panel(output_dir.parent)
    panel["month"] = pd.to_datetime(panel["month"])
    selection_origins = [pd.Timestamp(value) for value in cfg.selection_origins]
    test_origin = pd.Timestamp(cfg.test_origin)
    trees = 40 if quick else 120

    baseline_selection = _baseline_backtest(panel, selection_origins, cfg.seeds[0], trees)
    baseline_test = _baseline_backtest(panel, [test_origin], cfg.seeds[0], trees)
    neural_selection, selection_seed_metrics, selection_results = _run_neural_origins(
        panel, selection_origins, cfg, output_dir
    )
    neural_test, test_seed_metrics, test_results = _run_neural_origins(
        panel, [test_origin], cfg, output_dir, explain=True
    )
    selection_rows = pd.concat([baseline_selection, neural_selection], ignore_index=True, sort=False)
    test_rows = pd.concat([baseline_test, neural_test], ignore_index=True, sort=False)
    for frame in [selection_rows, test_rows]:
        frame["residual"] = frame["y_true"] - frame["prediction"]
        frame["absolute_error"] = frame["residual"].abs()
        frame["origin_month"] = pd.to_datetime(frame["origin_month"])
        frame["forecast_month"] = pd.to_datetime(frame["forecast_month"])

    primary_selection = _rm_pm(selection_rows)
    selection_board = aggregate_metrics(primary_selection, "selection").assign(
        population="RM_PM_PRIMARY"
    )
    provisional = str(selection_board.iloc[0]["model_name"])
    baseline_champion = str(
        selection_board[~selection_board["model_name"].eq("CONV1D_ATTENTION_GLOBAL")].iloc[0]["model_name"]
    )
    neural_comparison = model_comparisons(
        primary_selection,
        "CONV1D_ATTENTION_GLOBAL" if provisional == "CONV1D_ATTENTION_GLOBAL" else baseline_champion,
        cfg,
    )
    selection_cost = decision_cost_sensitivity(primary_selection)
    neural_cost = selection_cost[
        selection_cost["model_name"].eq("CONV1D_ATTENTION_GLOBAL")
        & selection_cost["under_to_over_cost_ratio"].eq("1:1")
    ]["weighted_total_cost_proxy"].iloc[0]
    baseline_cost = selection_cost[
        selection_cost["model_name"].eq(baseline_champion)
        & selection_cost["under_to_over_cost_ratio"].eq("1:1")
    ]["weighted_total_cost_proxy"].iloc[0]
    neural_selection_only = primary_selection[
        primary_selection["model_name"].eq("CONV1D_ATTENTION_GLOBAL")
    ]
    neural_selection_coverage = float(
        neural_selection_only["y_true"].between(neural_selection_only["p10"], neural_selection_only["p90"]).mean()
    )
    decision_gate = bool(neural_cost <= baseline_cost)
    calibration_gate = bool(0.75 <= neural_selection_coverage <= 0.90)
    neural_promoted = False
    promotion_reason = "Neural challenger did not rank first on locked pre-test selection score."
    if provisional == "CONV1D_ATTENTION_GLOBAL":
        evidence = neural_comparison[neural_comparison["challenger"].eq(baseline_champion)]
        neural_promoted = bool(
            not evidence.empty
            and evidence.iloc[0]["statistically_distinguishable"]
            and evidence.iloc[0]["mean_absolute_error_difference"] < 0
            and decision_gate
            and calibration_gate
        )
        promotion_reason = (
            "Neural challenger ranked first and passed superiority, calibration and decision-cost gates."
            if neural_promoted
            else "Neural challenger ranked first but did not pass every superiority, calibration and decision-cost gate."
        )
    champion = "CONV1D_ATTENTION_GLOBAL" if neural_promoted else baseline_champion

    test_rows = calibrate_intervals(selection_rows, test_rows)
    test_rows = _add_domain_context(test_rows, panel, output_dir)
    selection_rows = _add_domain_context(selection_rows, panel, output_dir)
    leaderboard = pd.concat(
        [_population_metrics(selection_rows, "selection"), _population_metrics(test_rows, "untouched_test")],
        ignore_index=True,
    )
    comparisons = model_comparisons(primary_selection, champion, cfg)
    calibration = interval_calibration(test_rows, cfg)
    residual = residual_diagnostics(_rm_pm(test_rows), champion, cfg)
    spectral = spectral_stationarity_audit(panel, cfg)
    decision = _population_decisions(test_rows)
    slices = slice_metrics(test_rows)
    assumptions = assumption_registry(spectral, residual, calibration, champion)
    claims = claim_evidence_matrix()

    last_selection_origin = selection_origins[-1]
    full_result = selection_results[last_selection_origin]
    ablation_rows = []
    ablation_training = build_training_windows(panel, last_selection_origin, cfg.history, cfg.horizon)
    ablation_prediction = build_prediction_windows(panel, last_selection_origin, cfg.history, cfg.horizon)
    for feature_group in ["time_only", "cyclic", "spectral", "known_future"]:
        result = train_ensemble(
            ablation_training,
            ablation_prediction,
            replace(cfg, seeds=(cfg.seeds[0],)),
            feature_group=feature_group,
            seeds=(cfg.seeds[0],),
        )
        metrics = aggregate_metrics(_rm_pm(result.rows), "ablation").iloc[0].to_dict()
        ablation_rows.append({"feature_group": feature_group, **metrics})
    full_metrics = aggregate_metrics(_rm_pm(full_result.rows), "ablation").iloc[0].to_dict()
    ablation_rows.append({"feature_group": "full", **full_metrics})
    ablations = pd.DataFrame(ablation_rows)

    test_result = test_results[test_origin]
    artifacts = {
        "selection_backtest_rows.csv.gz": selection_rows,
        "test_backtest_rows.csv.gz": test_rows,
        "model_leaderboard.csv": leaderboard,
        "neural_seed_stability.csv": pd.concat([selection_seed_metrics, test_seed_metrics], ignore_index=True),
        "neural_training_history.csv": pd.concat(
            [result.history.assign(origin_month=origin) for origin, result in {**selection_results, **test_results}.items()],
            ignore_index=True,
        ),
        "feature_group_ablations.csv": ablations,
        "spectral_evidence.csv": spectral,
        "assumption_registry.csv": assumptions,
        "model_hypothesis_tests.csv": comparisons,
        "residual_diagnostics.csv": residual,
        "interval_calibration.csv": calibration,
        "decision_cost_sensitivity.csv": decision,
        "slice_metrics.csv": slices,
        "attention_weights.csv": test_result.attention,
        "lag_occlusion_sensitivity.csv": test_result.occlusion,
        "heldout_group_permutation.csv": test_result.permutation,
        "claim_evidence_matrix.csv": claims,
    }
    for filename, frame in artifacts.items():
        frame.to_csv(output_dir / filename, index=False, compression="gzip" if filename.endswith(".gz") else None)
    _plots(
        output_dir,
        leaderboard,
        ablations,
        test_result.attention,
        spectral,
        test_rows,
        champion,
        decision,
    )

    test_metrics = leaderboard[
        leaderboard["split"].eq("untouched_test")
        & leaderboard["population"].eq("RM_PM_PRIMARY")
        & leaderboard["model_name"].eq(champion)
    ].iloc[0].to_dict()
    summary = {
        "data_tier": "GENERATED_OPERATIONAL_BASELINE",
        "history_months": cfg.history,
        "forecast_horizon_months": cfg.horizon,
        "series_total": int(panel["material_id"].nunique()),
        "rm_pm_series": int(panel[panel["material_type"].isin(["raw_material", "packaging_material"])]["material_id"].nunique()),
        "finished_good_series": int(panel[panel["material_type"].eq("product")]["material_id"].nunique()),
        "selection_origins": [str(value.date()) for value in selection_origins],
        "untouched_test_window": ["2025-01-01", "2025-12-01"],
        "neural_seeds": list(cfg.seeds),
        "baseline_champion": baseline_champion,
        "locked_champion": champion,
        "neural_promoted": neural_promoted,
        "promotion_reason": promotion_reason,
        "neural_selection_coverage_p10_p90": neural_selection_coverage,
        "neural_selection_calibration_gate": calibration_gate,
        "neural_selection_decision_cost_gate": decision_gate,
        "test_metrics": test_metrics,
        "external_population_validity": "UNVERIFIED",
        "production_decision_eligible": False,
        "claim_boundary": "Generated-data evidence validates the implementation and experimental method, not real warehouse population performance.",
    }
    (output_dir / "evaluator_run_summary.json").write_text(
        json.dumps(summary, indent=2, default=_json_default), encoding="utf-8"
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run evaluator-grade forecasting evidence")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "evaluator")
    parser.add_argument("--quick", action="store_true", help="One neural seed and shorter training for developer checks")
    args = parser.parse_args()
    cfg = EvaluatorConfig()
    if args.quick:
        cfg = replace(
            cfg,
            seeds=(17,),
            selection_origins=("2023-07-01", "2023-10-01", "2024-01-01"),
            max_epochs=18,
            patience=4,
            bootstrap_samples=100,
            spectral_bootstrap_samples=40,
        )
    print(json.dumps(run(args.output, cfg, args.quick), indent=2, default=_json_default))


if __name__ == "__main__":
    main()
