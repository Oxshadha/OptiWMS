from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]


def md(text: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": [line + "\n" for line in dedent(text).strip().splitlines()]}


def code(text: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [line + "\n" for line in dedent(text).strip().splitlines()]}


SETUP = """
from pathlib import Path
import json
import pandas as pd
try:
    from IPython.display import Image, display
except ImportError:
    class Image:
        def __init__(self, filename): self.filename = filename
        def __repr__(self): return f"Image({self.filename})"
    def display(value): print(value)

ROOT = Path.cwd()
if ROOT.name != "v8_controlled_synthetic_validation":
    candidate = ROOT / "Ai miroservices/modeling/v8_controlled_synthetic_validation"
    ROOT = candidate if candidate.exists() else ROOT
OUT = ROOT / "outputs"
DATA = OUT / "data"
PLOTS = OUT / "plots"
summary = json.loads((OUT / "run_summary.json").read_text())
"""


def _write(name: str, cells: list[dict]) -> None:
    notebook = {
        "cells": cells,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python", "version": "3.10"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    (ROOT / name).write_text(json.dumps(notebook, indent=1), encoding="utf-8")


def build() -> list[str]:
    notebooks: dict[str, list[dict]] = {
        "00_Controlled_Data_Generation.ipynb": [
            md("""
            # Controlled RM/PM Data Generation And Lineage

            This notebook documents a reproducible data-generating process with known ground truth. It contains 24 finished goods, 120 RM/PM materials, complete BOM mappings, yield, scrap, MOQ, order multiples, lead times, production plans, actual production, shocks and structural changes.

            **Claim boundary:** controlled synthetic recovery validates pipeline behavior. It does not prove production accuracy or that all real-data error is caused by data quality.
            """),
            code(SETUP),
            code("""
            quality = pd.read_csv(OUT / "data_quality_report.csv")
            dictionary = pd.read_csv(OUT / "data_dictionary.csv")
            quality
            """),
            code("""
            materials = pd.read_csv(DATA / "materials.csv")
            bom = pd.read_csv(DATA / "bom_components.csv")
            production = pd.read_csv(DATA / "production_plan_actuals.csv", parse_dates=["month"])
            demand = pd.read_csv(DATA / "material_demand.csv", parse_dates=["month"])
            display(materials.head())
            display(bom.head())
            display(production.head())
            display(demand.head())
            """),
            code("""
            lineage = {
                "seed": summary["seed"], "tier": summary["data_tier"],
                "materials": summary["materials"], "finished_goods": summary["finished_goods"],
                "bom_rows": summary["bom_rows"], "controlled_bom_coverage_pct": summary["bom_coverage_controlled_pct"],
            }
            lineage
            """),
        ],
        "01_Controlled_Demand_EDA.ipynb": [
            md("""
            # Controlled Demand EDA

            The generated target combines planned FG demand, actual-production deviations, BOM coefficients, yield/scrap, heteroscedastic process noise, promotions, holidays, shocks and structural shifts. The EDA verifies that the target is neither a smooth sine wave nor arbitrary independent noise.
            """),
            code(SETUP),
            code("""
            demand = pd.read_csv(DATA / "material_demand.csv", parse_dates=["month"])
            demand[["demand_units", "planned_bom_requirement", "actual_bom_requirement"]].describe(percentiles=[.5,.75,.9,.95,.99])
            """),
            code("""
            eda = demand.groupby("material_type").agg(
                materials=("material_id", "nunique"), rows=("material_id", "size"),
                zero_rate=("demand_units", lambda s: (s == 0).mean()),
                mean=("demand_units", "mean"), median=("demand_units", "median"),
                p95=("demand_units", lambda s: s.quantile(.95)), max=("demand_units", "max"),
            )
            eda
            """),
            code("display(Image(filename=str(PLOTS / '01_generated_demand_vs_bom_plan.png')))"),
        ],
        "02_Features_Models_And_Tuning.ipynb": [
            md("""
            # Leakage-Safe Features, Models And Hyperparameter Tuning

            Target month `t` uses demand history only through `t-1`. Planned production/BOM requirement for `t` is allowed only in causal models because it is assumed available at forecast creation time.

            The protocol uses six tuning months, six independent champion-selection months, and twelve untouched rolling test origins. Random splitting is not used.
            """),
            code(SETUP),
            code("""
            trials = pd.read_csv(OUT / "hyperparameter_trials.csv")
            trials.head(15).round(4)
            """),
            code("""
            selection = pd.read_csv(OUT / "selection_leaderboard.csv")
            selection.assign(WAPE_pct=100*selection.WAPE, Bias_pct=100*selection.Bias).round(2)
            """),
            md("""
            Candidate families include seasonal naive, moving average, Croston/SBA, damped Holt/ETS, deterministic BOM-plan, Ridge, Elastic Net, Random Forest, Extra Trees, direct LightGBM, causal LightGBM and Tweedie LightGBM.
            """),
        ],
        "03_Untouched_Test_And_Hypothesis_Tests.ipynb": [
            md("""
            # Untouched Test And Paired Hypothesis Tests

            The champion is locked using the selection window before the final twelve origins are scored. Paired t and Wilcoxon tests compare material-month absolute errors. A DM-style test uses twelve monthly aggregate loss differentials and is explicitly treated as low-power evidence.
            """),
            code(SETUP),
            code("""
            leaderboard = pd.read_csv(OUT / "model_leaderboard.csv")
            leaderboard.assign(WAPE_pct=100*leaderboard.WAPE, Bias_pct=100*leaderboard.Bias, shock_WAPE_pct=100*leaderboard.shock_WAPE).round(2)
            """),
            code("display(Image(filename=str(PLOTS / '02_model_leaderboard.png')))"),
            code("""
            tests = pd.read_csv(OUT / "paired_model_tests.csv")
            tests.round({"mean_abs_error_delta": 2, "paired_t_p_value": 4, "wilcoxon_p_value": 4, "monthly_dm_style_p_value": 4})
            """),
            code("display(Image(filename=str(PLOTS / '04_high_volume_comparison.png')))"),
            code("display(Image(filename=str(PLOTS / '06_shock_robustness.png')))"),
        ],
        "04_Residuals_Intervals_And_Policy.ipynb": [
            md("""
            # Residuals, Interval Calibration And Inventory Policy

            Point accuracy is not sufficient for inventory decisions. This notebook checks residual normality, autocorrelation, heteroscedasticity and scale dependence, then validates split-conformal 90% intervals and converts them into MOQ/order-multiple constrained policy evidence.
            """),
            code(SETUP),
            code("display(Image(filename=str(PLOTS / '03_champion_residual_diagnostics.png')))"),
            code("""
            residual_tests = pd.read_csv(OUT / "residual_tests.csv")
            calibration = pd.read_csv(OUT / "interval_calibration.csv")
            display(residual_tests)
            display(calibration)
            """),
            code("""
            policy = pd.read_csv(OUT / "inventory_policy_simulation.csv")
            policy[["material_code", "material_type", "monthly_p50", "monthly_p90", "reorder_point", "safety_stock", "moq", "order_multiple", "order_quantity", "proposed_min", "proposed_max"]].head(20).round(2)
            """),
            code("""
            gain = pd.read_csv(OUT / "lightgbm_gain_importance.csv")
            permutation = pd.read_csv(OUT / "lightgbm_permutation_importance.csv")
            display(Image(filename=str(PLOTS / "05_feature_importance.png")))
            display(gain.head(15))
            display(permutation.head(15))
            """),
        ],
        "05_Statistical_Conclusion.ipynb": [
            md("""
            # Statistical Conclusion And Claim Boundary

            The experiment answers a narrow but useful question: can the pipeline recover a known RM/PM demand process when complete production-plan and BOM signals exist?
            """),
            code(SETUP),
            code("summary"),
            md("""
            ## Supported Conclusions

            - The pipeline successfully recovers the controlled causal structure.
            - The locked BOM-plan champion reaches approximately 8.6% WAPE on twelve untouched origins.
            - Random Forest is statistically indistinguishable from the BOM-plan champion in this test, showing that causal ML can recover similar behavior.
            - Direct-history LightGBM is significantly worse than BOM-plan forecasting, demonstrating the value of known production/BOM inputs.
            - Conformal intervals achieve approximately their nominal 90% coverage.
            - Heavy tails and heteroscedasticity remain even when point forecasts are good; Gaussian residual claims remain invalid.

            ## Unsupported Conclusions

            - Synthetic success does not prove real production accuracy.
            - Synthetic success does not prove that every v7 error is exclusively a data problem.
            - A complete synthetic BOM cannot be represented as a real validated Hemas BOM.
            - Hyperparameter search cannot replace real material-issue and production-order history.

            ## Operational Decision

            Keep v8 as a validation harness. Use its schema and tests when real history arrives, but do not publish v8 forecasts into the operational `forecast_results` table.
            """),
        ],
    }
    for name, cells in notebooks.items():
        _write(name, cells)
    return list(notebooks)


if __name__ == "__main__":
    print("\n".join(build()))

