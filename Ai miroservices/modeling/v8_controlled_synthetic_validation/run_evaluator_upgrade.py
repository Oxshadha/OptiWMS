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

from evaluator_forecasting.contracts import EvaluatorConfig
from evaluator_forecasting.features import build_prediction_windows, build_training_windows
from evaluator_forecasting.neural import train_ensemble
from evaluator_forecasting.statistics import aggregate_metrics


def _panel() -> pd.DataFrame:
    frame = pd.read_csv(ROOT / "outputs" / "data" / "material_demand.csv", parse_dates=["month"])
    frame["category"] = frame["material_type"]
    frame["shutdown_flag"] = np.nan
    return frame


def _seasonal_naive(panel: pd.DataFrame, origin: pd.Timestamp, horizon: int) -> pd.DataFrame:
    rows = []
    indexed = panel.set_index(["material_id", "month"])["demand_units"]
    target = panel[
        (panel["month"] >= origin) & (panel["month"] < origin + pd.DateOffset(months=horizon))
    ]
    for record in target.itertuples(index=False):
        previous = pd.Timestamp(record.month) - pd.DateOffset(years=1)
        prediction = float(indexed.get((record.material_id, previous), 0.0))
        rows.append(
            {
                "origin_month": origin,
                "forecast_month": pd.Timestamp(record.month),
                "material_id": record.material_id,
                "material_code": record.material_code,
                "material_type": record.material_type,
                "horizon": int((pd.Timestamp(record.month).year - origin.year) * 12 + pd.Timestamp(record.month).month - origin.month + 1),
                "model_name": "SEASONAL_NAIVE",
                "y_true": float(record.demand_units),
                "prediction": prediction,
                "residual": float(record.demand_units - prediction),
                "absolute_error": abs(float(record.demand_units - prediction)),
            }
        )
    return pd.DataFrame(rows)


def run(output_dir: Path, cfg: EvaluatorConfig) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    panel = _panel()
    all_rows = []
    seeds = []
    for split, origin in [("selection", pd.Timestamp("2024-01-01")), ("untouched_test", pd.Timestamp(cfg.test_origin))]:
        training = build_training_windows(panel, origin, cfg.history, cfg.horizon)
        prediction = build_prediction_windows(panel, origin, cfg.history, cfg.horizon)
        result = train_ensemble(training, prediction, cfg, explain=split == "untouched_test")
        neural = result.rows.copy()
        neural["origin_month"] = origin
        neural["split"] = split
        baseline = _seasonal_naive(panel, origin, cfg.horizon)
        baseline["split"] = split
        all_rows.extend([neural, baseline])
        seed = result.seed_metrics.copy()
        seed["origin_month"] = origin
        seed["split"] = split
        seeds.append(seed)
        if split == "untouched_test":
            result.attention.to_csv(output_dir / "attention_weights.csv", index=False)
            result.occlusion.to_csv(output_dir / "lag_occlusion_sensitivity.csv", index=False)
            result.permutation.to_csv(output_dir / "heldout_group_permutation.csv", index=False)

    rows = pd.concat(all_rows, ignore_index=True, sort=False)
    rows["residual"] = rows["y_true"] - rows["prediction"]
    rows["absolute_error"] = rows["residual"].abs()
    leaderboard = pd.concat(
        [
            aggregate_metrics(rows[rows["split"].eq(split)], split)
            for split in ["selection", "untouched_test"]
        ],
        ignore_index=True,
    )
    rows.to_csv(output_dir / "backtest_rows.csv.gz", index=False, compression="gzip")
    leaderboard.to_csv(output_dir / "model_leaderboard.csv", index=False)
    pd.concat(seeds, ignore_index=True).to_csv(output_dir / "neural_seed_stability.csv", index=False)
    summary = {
        "data_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
        "purpose": "Independent v8 replication of the shared neural window and architecture contract.",
        "history_months": cfg.history,
        "horizon_months": cfg.horizon,
        "seeds": list(cfg.seeds),
        "production_decision_eligible": False,
        "external_population_validity": "UNVERIFIED",
        "leaderboard": leaderboard.to_dict(orient="records"),
    }
    (output_dir / "evaluator_run_summary.json").write_text(
        json.dumps(summary, indent=2, default=str), encoding="utf-8"
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the v8 shared neural evaluator replication")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "evaluator")
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    cfg = EvaluatorConfig()
    if args.quick:
        cfg = replace(cfg, seeds=(17,), max_epochs=18, patience=4)
    print(json.dumps(run(args.output, cfg), indent=2, default=str))


if __name__ == "__main__":
    main()
