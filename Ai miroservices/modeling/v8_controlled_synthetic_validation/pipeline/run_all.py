from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from pipeline.diagnostics import (
    conformal_intervals,
    demand_band_metrics,
    feature_importance,
    inventory_policy,
    paired_model_tests,
    plot_all,
    plot_feature_importance,
    residual_tests,
)
from pipeline.generate_data import SimulationConfig, generate_controlled_dataset
from pipeline.modeling import (
    CAUSAL_FEATURES,
    aggregate_metrics,
    build_features,
    rolling_backtest,
    tune_lightgbm,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
DATA = OUTPUT / "data"
PLOTS = OUTPUT / "plots"


def _data_quality(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    for table, frame in tables.items():
        rows.append(
            {
                "table": table,
                "rows": int(len(frame)),
                "columns": int(len(frame.columns)),
                "missing_cells": int(frame.isna().sum().sum()),
                "duplicate_rows": int(frame.duplicated().sum()),
                "data_quality_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
            }
        )
    return pd.DataFrame(rows)


def _schema_dictionary(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    for table, frame in tables.items():
        for column in frame.columns:
            rows.append(
                {
                    "table": table,
                    "column": column,
                    "dtype": str(frame[column].dtype),
                    "non_null": int(frame[column].notna().sum()),
                    "unique": int(frame[column].nunique(dropna=True)),
                    "role": "generated_ground_truth" if column in {"demand_units", "actual_fg_units", "actual_bom_requirement"} else "predictor_or_policy",
                }
            )
    return pd.DataFrame(rows)


def _write_executive_summary(summary: dict) -> None:
    champion = summary["locked_champion"]
    result = summary["test_champion_metrics"]
    text = f"""# v8 Controlled Synthetic Forecast Validation

## Experimental Position

This benchmark tests whether the forecasting pipeline can recover a known causal RM/PM demand-generating process. It does not claim production accuracy because every row is controlled synthetic ground truth.

## Protocol

- Seed: `{summary['seed']}`
- Materials: `{summary['materials']}`
- Finished goods: `{summary['finished_goods']}`
- BOM coverage: `100%` within the controlled simulation
- Hyperparameter tuning: `{summary['tuning_months']}` months
- Champion selection: `{summary['selection_months']}` independent months
- Final untouched test: `{summary['test_months']}` rolling origins
- Locked champion: `{champion}`

## Final Test Result

- WAPE: `{result['WAPE']:.2%}`
- MAE: `{result['MAE']:.2f}`
- RMSE: `{result['RMSE']:.2f}`
- Bias: `{result['Bias']:.2%}`
- Under-forecast rate: `{result['under_forecast_rate']:.2%}`

## Interpretation

If BOM/production-plan models materially outperform direct-history models, the experiment demonstrates the value of causal planning signals. If all candidates fail despite the known structure, the pipeline or model specification remains defective. Neither outcome proves that failures on real operational data are caused only by data quality; that conclusion requires real issue-history validation.
"""
    (OUTPUT / "executive_summary.md").write_text(text, encoding="utf-8")


def run() -> dict:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    PLOTS.mkdir(parents=True, exist_ok=True)

    config = SimulationConfig()
    tables = generate_controlled_dataset(DATA, config)
    demand = tables["material_demand"]
    supervised = build_features(demand)
    all_months = sorted(supervised["target_month"].unique())
    tuning_months = all_months[-24:-18]
    selection_months = all_months[-18:-12]
    test_months = all_months[-12:]

    trials, best_params = tune_lightgbm(supervised, tuning_months)
    selection_rows, _, _ = rolling_backtest(supervised, selection_months, best_params)
    selection_leaderboard = aggregate_metrics(selection_rows)
    locked_champion = str(selection_leaderboard.iloc[0]["model"])

    test_rows, final_models, final_test = rolling_backtest(supervised, test_months, best_params)
    test_leaderboard = aggregate_metrics(test_rows)
    bands = demand_band_metrics(test_rows)
    paired = paired_model_tests(test_rows, locked_champion)
    residual = residual_tests(test_rows, locked_champion)
    interval_rows, interval_summary = conformal_intervals(selection_rows, test_rows, locked_champion)
    gain, permutation = feature_importance(
        final_models["lightgbm_causal_ratio"], CAUSAL_FEATURES, final_test, "ratio_log"
    )
    et_gain, et_permutation = feature_importance(
        final_models["extra_trees_causal"], CAUSAL_FEATURES, final_test, "log"
    )
    rf_gain, rf_permutation = feature_importance(
        final_models["random_forest_causal"], CAUSAL_FEATURES, final_test, "log"
    )
    policy = inventory_policy(interval_rows, tables["materials"])
    quality = _data_quality(tables)
    dictionary = _schema_dictionary(tables)

    trials.to_csv(OUTPUT / "hyperparameter_trials.csv", index=False)
    selection_rows.to_csv(OUTPUT / "selection_backtest_rows.csv", index=False)
    selection_leaderboard.to_csv(OUTPUT / "selection_leaderboard.csv", index=False)
    test_rows.to_csv(OUTPUT / "test_backtest_rows.csv", index=False)
    test_leaderboard.to_csv(OUTPUT / "model_leaderboard.csv", index=False)
    bands.to_csv(OUTPUT / "demand_band_metrics.csv", index=False)
    paired.to_csv(OUTPUT / "paired_model_tests.csv", index=False)
    residual.to_csv(OUTPUT / "residual_tests.csv", index=False)
    interval_rows.to_csv(OUTPUT / "champion_prediction_intervals.csv", index=False)
    interval_summary.to_csv(OUTPUT / "interval_calibration.csv", index=False)
    gain.to_csv(OUTPUT / "lightgbm_gain_importance.csv", index=False)
    permutation.to_csv(OUTPUT / "lightgbm_permutation_importance.csv", index=False)
    et_gain.to_csv(OUTPUT / "extra_trees_gain_importance.csv", index=False)
    et_permutation.to_csv(OUTPUT / "extra_trees_permutation_importance.csv", index=False)
    rf_gain.to_csv(OUTPUT / "random_forest_gain_importance.csv", index=False)
    rf_permutation.to_csv(OUTPUT / "random_forest_permutation_importance.csv", index=False)
    policy.to_csv(OUTPUT / "inventory_policy_simulation.csv", index=False)
    quality.to_csv(OUTPUT / "data_quality_report.csv", index=False)
    dictionary.to_csv(OUTPUT / "data_dictionary.csv", index=False)

    plot_all(demand, test_leaderboard, test_rows, bands, locked_champion, gain, permutation, PLOTS)
    plot_feature_importance(et_gain, et_permutation, "Extra Trees Causal", PLOTS / "07_extra_trees_feature_importance.png")
    plot_feature_importance(rf_gain, rf_permutation, "Random Forest Causal", PLOTS / "08_random_forest_feature_importance.png")

    champion_metrics = test_leaderboard[test_leaderboard["model"].eq(locked_champion)].iloc[0].to_dict()
    summary = {
        "seed": config.seed,
        "data_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
        "materials": int(len(tables["materials"])),
        "raw_materials": int(tables["materials"]["material_type"].eq("raw_material").sum()),
        "packaging_materials": int(tables["materials"]["material_type"].eq("packaging_material").sum()),
        "finished_goods": int(len(tables["finished_goods"])),
        "bom_rows": int(len(tables["bom_components"])),
        "bom_coverage_controlled_pct": 100.0,
        "history_months": config.months,
        "tuning_months": len(tuning_months),
        "selection_months": len(selection_months),
        "test_months": len(test_months),
        "best_lightgbm_params": best_params,
        "locked_champion": locked_champion,
        "selection_champion_metrics": selection_leaderboard.iloc[0].to_dict(),
        "test_champion_metrics": champion_metrics,
        "test_leaderboard": test_leaderboard.to_dict(orient="records"),
        "interval_calibration": interval_summary.iloc[0].to_dict(),
        "claim_limit": "Synthetic recovery validates the pipeline and experimental method, not real-world production accuracy or exclusive data causation.",
    }
    (OUTPUT / "run_summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    _write_executive_summary(summary)
    return summary


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, default=str))

