from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from pipeline.corrected_experiment import (
    VARIANTS,
    demand_band_metrics,
    gain_importance,
    paired_comparisons,
    permutation_importance_wape,
    plot_experiment,
    rolling_origin_experiment,
)


ROOT = Path(__file__).resolve().parents[1]


def run(panel_path: Path, output_dir: Path, backtest_months: int = 6) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    plots = output_dir / "plots"
    panel = pd.read_csv(panel_path, parse_dates=["month"])
    rows, leaderboard, models, final_test, features = rolling_origin_experiment(panel, backtest_months)
    champion = str(leaderboard.iloc[0]["model"])
    variant = next(item for item in VARIANTS if item.name == champion)
    gain = gain_importance(models[champion], features)
    permutation = permutation_importance_wape(models[champion], final_test, features, variant)
    bands = demand_band_metrics(rows)
    comparisons = paired_comparisons(rows, champion)

    rows.to_csv(output_dir / "corrected_backtest_rows.csv", index=False)
    leaderboard.to_csv(output_dir / "corrected_model_leaderboard.csv", index=False)
    bands.to_csv(output_dir / "corrected_demand_band_metrics.csv", index=False)
    comparisons.to_csv(output_dir / "corrected_paired_comparisons.csv", index=False)
    gain.to_csv(output_dir / "corrected_gain_importance.csv", index=False)
    permutation.to_csv(output_dir / "corrected_permutation_importance.csv", index=False)
    old_path = ROOT / "outputs" / "lightgbm_evaluation.csv"
    old = pd.read_csv(old_path).iloc[0].to_dict() if old_path.exists() else {}
    best = leaderboard.iloc[0].to_dict()
    q5 = bands[(bands["model"].eq(champion)) & (bands["demand_band"].eq("Q5_highest"))].iloc[0].to_dict()
    summary = {
        "position": "offline corrected experiment; not published to forecast_results",
        "data_lineage": "HEMAS_SYNTHETIC_WMS_V6 / canonical_v6 simulated operational history",
        "backtest_design": f"{backtest_months} expanding-window rolling origins; one-step-ahead per origin",
        "old_v7_lightgbm": old,
        "corrected_champion": best,
        "corrected_champion_q5": q5,
        "feature_alignment": "target month t uses only observations through t-1; future inference follows the same contract",
        "variants": [item.name for item in VARIANTS],
        "claim_limit": "Results measure fit to simulated operational history, not production validity on real RM/PM issues.",
    }
    (output_dir / "corrected_experiment_summary.json").write_text(json.dumps(summary, indent=2, default=str))
    plot_experiment(rows, leaderboard, bands, gain, permutation, plots)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run corrected RM/PM forecasting experiments without publishing.")
    parser.add_argument(
        "--panel",
        type=Path,
        default=ROOT / "outputs" / "monthly_demand_panel.csv",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "outputs" / "corrected_experiment",
    )
    parser.add_argument("--backtest-months", type=int, default=6)
    args = parser.parse_args()
    print(json.dumps(run(args.panel, args.output_dir, args.backtest_months), indent=2, default=str))


if __name__ == "__main__":
    main()
