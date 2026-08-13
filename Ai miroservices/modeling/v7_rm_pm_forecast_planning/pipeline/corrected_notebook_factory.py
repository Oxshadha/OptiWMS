from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "13_Corrected_High_Volume_LightGBM_Experiment.ipynb"


def markdown(text: str) -> dict:
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in dedent(text).strip().splitlines()],
    }


def code(text: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [line + "\n" for line in dedent(text).strip().splitlines()],
    }


def build() -> Path:
    cells = [
        markdown(
            """
            # Corrected High-Volume RM/PM LightGBM Experiment

            **Purpose:** test whether feature alignment, scale normalization, objective choice, and high-volume handling improve the v7 global model.

            This is an **offline evidence notebook**. It does not publish forecasts and does not replace the current operational model. The demand source is `HEMAS_SYNTHETIC_WMS_V6` / `canonical_v6`, so results demonstrate engineering behavior on simulated operational history, not production validity on real material issues.
            """
        ),
        code(
            """
            from pathlib import Path
            import json
            import pandas as pd
            try:
                from IPython.display import Image, display
            except ImportError:
                class Image:
                    def __init__(self, filename):
                        self.filename = filename
                    def __repr__(self):
                        return f"Image({self.filename})"
                def display(value):
                    print(value)

            ROOT = Path.cwd()
            if ROOT.name != "v7_rm_pm_forecast_planning":
                candidate = ROOT / "Ai miroservices/modeling/v7_rm_pm_forecast_planning"
                ROOT = candidate if candidate.exists() else ROOT
            OUT = ROOT / "outputs" / "corrected_experiment"
            PLOTS = OUT / "plots"
            summary = json.loads((OUT / "corrected_experiment_summary.json").read_text())
            summary
            """
        ),
        markdown(
            """
            ## 1. Defect Corrected

            The previous supervised matrix placed the target at `t+1` while lag and rolling features were calculated from a row indexed at `t`, with rolling values shifted again. Live inference used history through `t`, creating a training/inference mismatch.

            Correct contract used here:

            - target: demand in month `t`
            - allowed predictors: demand observed through `t-1`
            - validation: six expanding-window, one-step-ahead forecast origins
            - no random train/test split
            """
        ),
        code(
            """
            leaderboard = pd.read_csv(OUT / "corrected_model_leaderboard.csv")
            old = pd.DataFrame([summary["old_v7_lightgbm"]]).rename(columns={"model": "model"})
            comparison = pd.concat([old, leaderboard], ignore_index=True)
            comparison[["model", "WAPE", "MAE", "RMSE", "Bias", "under_forecast_rate"]]
            """
        ),
        code(
            """
            display(Image(filename=str(PLOTS / "corrected_model_leaderboard.png")))
            """
        ),
        markdown(
            """
            ## 2. Controlled Objective And Scaling Experiment

            The experiment compares aligned log-L2, log-Huber, raw-L1, Tweedie, Poisson, volume-weighted log-L2, and two scale-normalized global models.

            The scale-normalized models predict demand relative to the material's previous 12-month mean and transform the result back to units. This lets a global model learn common *relative* changes without allowing large-volume materials to dominate the target scale.
            """
        ),
        code(
            """
            leaderboard.assign(
                WAPE_pct=100 * leaderboard["WAPE"],
                Bias_pct=100 * leaderboard["Bias"],
                under_forecast_pct=100 * leaderboard["under_forecast_rate"],
            ).drop(columns=["WAPE", "Bias", "under_forecast_rate"]).round(2)
            """
        ),
        markdown(
            """
            ## 3. High-Volume Failure Analysis

            Aggregate accuracy can hide scale-dependent failure. Metrics are therefore calculated separately for five actual-demand bands. Q5 contains the largest 20% of material-month demand observations.
            """
        ),
        code(
            """
            bands = pd.read_csv(OUT / "corrected_demand_band_metrics.csv")
            q5 = bands[bands["demand_band"].eq("Q5_highest")].sort_values("WAPE")
            q5.assign(
                WAPE_pct=100 * q5["WAPE"],
                under_forecast_pct=100 * q5["under_forecast_rate"],
            )[["model", "rows", "actual_median", "actual_max", "WAPE_pct", "MAE", "RMSE", "mean_error", "under_forecast_pct"]].round(2)
            """
        ),
        code(
            """
            display(Image(filename=str(PLOTS / "high_volume_wape_comparison.png")))
            """
        ),
        markdown(
            """
            ## 4. Residual Diagnostics

            Inspect residual location, tail behavior, variance against fitted values, and actual-versus-predicted compression. A strong model should not show systematic scale-dependent variance or persistent underprediction of extremes.
            """
        ),
        code(
            """
            display(Image(filename=str(PLOTS / "corrected_champion_diagnostics.png")))
            """
        ),
        markdown(
            """
            ## 5. Feature Importance: Gain Versus Permutation

            LightGBM gain importance is not treated as causal evidence. Correlated lag and rolling features can divide or concentrate gain unpredictably. Permutation importance measures the increase in held-out WAPE when one input is shuffled while the target and inverse-scaling contract remain fixed.
            """
        ),
        code(
            """
            gain = pd.read_csv(OUT / "corrected_gain_importance.csv")
            permutation = pd.read_csv(OUT / "corrected_permutation_importance.csv")
            display(Image(filename=str(PLOTS / "corrected_feature_importance.png")))
            display(gain.head(12))
            display(permutation.head(12))
            """
        ),
        markdown(
            """
            ## 6. Paired Forecast Comparison

            Aggregate ranking alone does not establish superiority. Paired tests compare absolute errors for the same material and forecast origin. A small p-value supports a difference within this simulated backtest, but it does not establish external production validity.
            """
        ),
        code(
            """
            paired = pd.read_csv(OUT / "corrected_paired_comparisons.csv")
            paired.round({"mean_abs_error_delta": 2, "paired_ttest_p_value": 4})
            """
        ),
        markdown(
            """
            ## 7. Statistical Conclusion

            - The corrected scale-normalized model improves WAPE and RMSE relative to the previous v7 LightGBM result on the same simulated panel.
            - Scale normalization helps more than raw high-volume weighting, Tweedie, Poisson, or ordinary hyperparameter changes.
            - The feature profile is less dominated by one gain feature, but rolling demand level and volatility remain the primary predictive signals.
            - Extreme-demand residuals remain materially larger than ordinary-demand residuals. The model cannot infer production spikes without real causal inputs such as production plans, validated BOM demand, material issues, backorders, and planned shutdowns.
            - This corrected model remains a candidate. Promotion requires rolling backtests on real RM/PM issue history, calibrated prediction intervals, stability by material class, and inventory-cost/service-level validation.
            """
        ),
        code(
            """
            result = {
                "old_WAPE": summary["old_v7_lightgbm"]["WAPE"],
                "corrected_WAPE": summary["corrected_champion"]["WAPE"],
                "relative_WAPE_improvement": (
                    summary["old_v7_lightgbm"]["WAPE"] - summary["corrected_champion"]["WAPE"]
                ) / summary["old_v7_lightgbm"]["WAPE"],
                "corrected_Q5_WAPE": summary["corrected_champion_q5"]["WAPE"],
                "decision": "retain as offline candidate; do not auto-promote",
            }
            result
            """
        ),
        markdown(
            """
            ## Reproducibility

            Run from the v7 directory:

            ```bash
            MPLCONFIGDIR=/tmp/optiwms-mpl-cache \\
            XDG_CACHE_HOME=/tmp/optiwms-xdg-cache \\
            PYTHONPATH=. \\
            /Users/k.e.oshada/Documents/OptiWMS/.venv/bin/python \\
              -m pipeline.run_corrected_experiment
            ```

            No database publication is performed by this command.
            """
        ),
    ]
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.10"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    NOTEBOOK.write_text(json.dumps(notebook, indent=1), encoding="utf-8")
    return NOTEBOOK


if __name__ == "__main__":
    print(build())
