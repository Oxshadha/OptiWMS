from __future__ import annotations

from pathlib import Path
from textwrap import dedent

import nbformat as nbf

ROOT = Path(__file__).resolve().parents[1]


def md(text: str):
    return nbf.v4.new_markdown_cell(dedent(text).strip())


def code(text: str):
    return nbf.v4.new_code_cell(dedent(text).strip())


COMMON_SETUP = """
from pathlib import Path
import json
import pandas as pd
import matplotlib.pyplot as plt
try:
    from IPython.display import Image, Markdown, display
except Exception:
    def display(value):
        print(value)
    def Markdown(text):
        return text
    class Image:
        def __init__(self, filename=None, **kwargs):
            self.filename = filename
        def __repr__(self):
            return f"Image(filename={self.filename!r})"

ROOT = Path.cwd()
if ROOT.name != "v7_rm_pm_forecast_planning":
    ROOT = Path("Ai miroservices/modeling/v7_rm_pm_forecast_planning").resolve()
OUT = ROOT / "outputs"
PLOTS = OUT / "plots"
pd.set_option("display.max_columns", 120)
pd.set_option("display.max_rows", 80)

def load_csv(name, **kwargs):
    path = OUT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing artifact: {path}. Run PYTHONPATH=. python3 -m pipeline.run_all first.")
    return pd.read_csv(path, **kwargs)

def load_json(name):
    path = OUT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing artifact: {path}. Run PYTHONPATH=. python3 -m pipeline.run_all first.")
    return json.loads(path.read_text())

def show_plot(name):
    path = PLOTS / name
    if path.exists():
        display(Image(filename=str(path)))
    else:
        display(Markdown(f"Plot not generated: `{path}`"))
"""


OBSOLETE_NOTEBOOKS = [
    "00_Data_Lineage_And_Readiness.ipynb",
    "01_RM_PM_Demand_EDA.ipynb",
    "02_BOM_Coverage_Audit.ipynb",
    "03_Baseline_Models.ipynb",
    "04_LightGBM_Global_RM_Model.ipynb",
    "05_Model_Evaluation_And_Residuals.ipynb",
    "06_Forecast_To_Inventory_Policy.ipynb",
    "07_Forecast_To_Slotting_Readiness.ipynb",
    "08_Executive_Evidence_Report.ipynb",
]


NOTEBOOKS = [
    (
        "00_Methodology_And_Paper_Map.ipynb",
        "Methodology And Paper Map",
        [
            md(
                """
                # v7 Methodology And Paper Map

                This notebook defines the evidence standard for the v7 raw-material and packaging-material forecasting track.

                Reference paper: Petropoulos et al., "Forecasting: theory and practice", International Journal of Forecasting, 2022.

                v7 uses the paper as a methodological guide:

                - pre-processing before modeling
                - anomaly and outlier handling
                - time-series cross-validation / rolling origin evaluation
                - benchmarks before complex ML models
                - intermittent-demand methods for sparse material usage
                - point forecasts plus prediction intervals
                - residual diagnostics, calibration, and transparent limitations
                """
            ),
            code(COMMON_SETUP),
            code(
                """
                summary = load_json("data_lineage_summary.json")
                pd.DataFrame([
                    {"principle": "Data lineage before modeling", "v7_artifact": "data_dictionary.csv, table_relationships.csv"},
                    {"principle": "Pre-processing and anomaly checks", "v7_artifact": "data_quality_report.csv, outlier_report.csv"},
                    {"principle": "Intermittent demand handling", "v7_artifact": "demand_classification.csv, baseline_leaderboard.csv"},
                    {"principle": "Benchmarking", "v7_artifact": "model_leaderboard.csv"},
                    {"principle": "Rolling-origin validation", "v7_artifact": "rolling_origin_splits.csv, backtest_residuals.csv"},
                    {"principle": "Residual diagnostics", "v7_artifact": "selected_model_residual_diagnostics.png"},
                    {"principle": "Prediction interval calibration", "v7_artifact": "interval_calibration.csv"},
                    {"principle": "Planning conversion", "v7_artifact": "inventory_policy_recommendations_v7.csv, slotting_readiness_v7.csv"},
                ])
                """
            ),
            code(
                """
                {
                    "selected_model": summary.get("selected_model"),
                    "forecast_rows": summary.get("v7_forecast_rows"),
                    "policy_rows": summary.get("v7_policy_rows"),
                    "slotting_rows": summary.get("v7_slotting_rows"),
                    "lineage_position": summary.get("lineage_position"),
                }
                """
            ),
        ],
    ),
    (
        "01_Data_Lineage_Schema_And_Relationships.ipynb",
        "Data Lineage Schema And Relationships",
        [
            md(
                """
                # Data Lineage, Schema, And Relationships

                This notebook proves what data was received, what columns exist, and how WMS tables relate before any forecast claim is made.
                """
            ),
            code(COMMON_SETUP),
            code("summary = load_json('data_lineage_summary.json')\nsummary"),
            code(
                """
                dictionary = load_csv("data_dictionary.csv")
                dictionary.sort_values(["dataset", "column"]).head(120)
                """
            ),
            code(
                """
                relationships = load_csv("table_relationships.csv")
                relationships
                """
            ),
            code(
                """
                load_csv("material_type_counts.csv")
                """
            ),
            code(
                """
                inv = load_csv("material_inventory_snapshot.csv")
                inv.groupby("material_type").agg(
                    materials=("material_id", "nunique"),
                    inventory_rows=("inventory_rows", "sum"),
                    on_hand_qty=("on_hand_qty", "sum"),
                    available_qty=("available_qty", "sum"),
                )
                """
            ),
            code(
                """
                demand = load_csv("monthly_demand_panel.csv", parse_dates=["month"])
                demand.groupby("material_type").agg(
                    rows=("material_id", "size"),
                    materials=("material_id", "nunique"),
                    min_month=("month", "min"),
                    max_month=("month", "max"),
                    total_demand=("demand_units", "sum"),
                )
                """
            ),
        ],
    ),
    (
        "02_Data_Quality_Profiling.ipynb",
        "Data Quality Profiling",
        [
            md(
                """
                # Data Quality Profiling

                This notebook checks missingness, duplicates, negative demand, zero-demand periods, and IQR outliers.
                """
            ),
            code(COMMON_SETUP),
            code("quality = load_csv('data_quality_report.csv')\nquality"),
            code("show_plot('data_quality_missingness.png')"),
            code(
                """
                outliers = load_csv("outlier_report.csv")
                outliers.head(30)
                """
            ),
            code(
                """
                outliers.agg(
                    materials=("material_id", "count"),
                    materials_with_outliers=("outlier_months", lambda s: int((s > 0).sum())),
                    total_outlier_months=("outlier_months", "sum"),
                    negative_months=("negative_months", "sum"),
                    zero_months=("zero_months", "sum"),
                )
                """
            ),
            code(
                """
                demand = load_csv("monthly_demand_panel.csv", parse_dates=["month"])
                demand[["demand_units"]].describe(percentiles=[.01, .05, .25, .5, .75, .95, .99])
                """
            ),
        ],
    ),
    (
        "03_RM_PM_Demand_EDA.ipynb",
        "RM PM Demand EDA",
        [
            md(
                """
                # RM/PM Demand EDA

                Visual and statistical exploration of demand concentration, material classes, intermittency, seasonality, and demand volatility.
                """
            ),
            code(COMMON_SETUP),
            code("classes = load_csv('demand_classification.csv')\nclasses.head(30)"),
            code("classes.groupby(['material_type', 'abc_class', 'fms_class']).size().reset_index(name='materials')"),
            code("show_plot('top_demand_materials.png')"),
            code("show_plot('abc_fms_heatmap.png')"),
            code("show_plot('seasonality_index.png')"),
            code(
                """
                classes[["total_demand", "avg_monthly_demand", "std_monthly_demand", "nonzero_rate", "cv"]].describe(percentiles=[.05, .25, .5, .75, .95])
                """
            ),
            code(
                """
                classes.sort_values("total_demand", ascending=False)[
                    ["material_code", "description", "material_type", "total_demand", "demand_share", "cumulative_share", "abc_class", "fms_class", "nonzero_rate", "cv", "planning_priority"]
                ].head(50)
                """
            ),
        ],
    ),
    (
        "04_Preprocessing_And_Feature_Engineering.ipynb",
        "Preprocessing And Feature Engineering",
        [
            md(
                """
                # Preprocessing And Feature Engineering

                This notebook documents the supervised learning matrix and leakage controls. Features are based on information available before the target month.
                """
            ),
            code(COMMON_SETUP),
            code("profile = load_csv('feature_matrix_profile.csv')\nprofile"),
            code(
                """
                sample = load_csv("feature_matrix_sample.csv", parse_dates=["month"])
                sample.head(30)
                """
            ),
            code(
                """
                sample[["month", "target", "lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "roll_mean_3", "roll_mean_6", "roll_mean_12"]].head(20)
                """
            ),
            code(
                """
                leakage_rules = pd.DataFrame([
                    {"feature_group": "lags", "rule": "lag_n uses demand from n months before the feature row month"},
                    {"feature_group": "rolling means/std", "rule": "rolling windows are shifted by 1 before aggregation"},
                    {"feature_group": "calendar", "rule": "month, quarter, year are known before forecast generation"},
                    {"feature_group": "material encodings", "rule": "material code/type are static metadata"},
                    {"feature_group": "target", "rule": "target is next-month demand and is never used as an input feature"},
                ])
                leakage_rules
                """
            ),
        ],
    ),
    (
        "05_Baseline_And_Intermittent_Models.ipynb",
        "Baseline And Intermittent Models",
        [
            md(
                """
                # Baseline And Intermittent Models

                Simple and intermittent-demand baselines are mandatory. LightGBM is only meaningful if it beats these defensible baselines.
                """
            ),
            code(COMMON_SETUP),
            code("baseline = load_csv('baseline_leaderboard.csv')\nbaseline"),
            code(
                """
                rows = load_csv("baseline_backtest_rows.csv", parse_dates=["month"])
                rows.head(30)
                """
            ),
            code(
                """
                rows.groupby("model").agg(
                    rows=("actual", "size"),
                    materials=("material_id", "nunique"),
                    actual_sum=("actual", "sum"),
                    prediction_sum=("prediction", "sum"),
                )
                """
            ),
            code(
                """
                classes = load_csv("demand_classification.csv")
                classes.groupby("fms_class").agg(
                    materials=("material_id", "count"),
                    avg_nonzero_rate=("nonzero_rate", "mean"),
                    avg_cv=("cv", "mean"),
                )
                """
            ),
        ],
    ),
    (
        "06_LightGBM_Global_RM_PM_Model.ipynb",
        "LightGBM Global RM PM Model",
        [
            md(
                """
                # LightGBM Global RM/PM Model

                This is a global tabular model over RM/PM demand history. It is not an M5 transfer claim and not a finished production claim by itself.
                """
            ),
            code(COMMON_SETUP),
            code("lgb_eval = load_csv('lightgbm_evaluation.csv')\nlgb_eval"),
            code("importance = load_csv('model_feature_importance.csv')\nimportance.head(30)"),
            code("show_plot('lightgbm_feature_importance.png')"),
            code(
                """
                rows = load_csv("lightgbm_backtest_rows.csv", parse_dates=["month"])
                rows.head(30)
                """
            ),
            code(
                """
                rows.groupby("material_type").agg(
                    rows=("actual", "size"),
                    materials=("material_id", "nunique"),
                    actual=("actual", "sum"),
                    prediction=("prediction", "sum"),
                )
                """
            ),
        ],
    ),
    (
        "07_Rolling_Backtest_And_Model_Selection.ipynb",
        "Rolling Backtest And Model Selection",
        [
            md(
                """
                # Rolling Backtest And Model Selection

                Model choice is based on rolling-origin backtest evidence, not model branding.
                """
            ),
            code(COMMON_SETUP),
            code("splits = load_csv('rolling_origin_splits.csv')\nsplits"),
            code("leaderboard = load_csv('model_leaderboard.csv')\nleaderboard"),
            code("show_plot('model_wape_leaderboard.png')"),
            code(
                """
                comparison = load_csv("statistical_comparison.csv")
                comparison
                """
            ),
            code(
                """
                per_material = load_csv("per_material_metrics.csv")
                best = leaderboard.sort_values("WAPE").iloc[0]["model"]
                per_material[per_material["model"].eq(best)].sort_values("WAPE", ascending=False).head(30)
                """
            ),
        ],
    ),
    (
        "08_Residual_Diagnostics_And_Error_Analysis.ipynb",
        "Residual Diagnostics And Error Analysis",
        [
            md(
                """
                # Residual Diagnostics And Error Analysis

                Residuals must come from backtest rows with actuals. Forward published forecast rows do not prove residual behavior.
                """
            ),
            code(COMMON_SETUP),
            code("selected = load_csv('selected_model_backtest_rows.csv', parse_dates=['month'])\nselected.head(30)"),
            code("show_plot('selected_model_residual_diagnostics.png')"),
            code("show_plot('selected_model_actual_vs_predicted.png')"),
            code(
                """
                selected["residual"].describe(percentiles=[.01, .05, .25, .5, .75, .95, .99])
                """
            ),
            code(
                """
                selected.groupby("material_type").agg(
                    rows=("actual", "size"),
                    actual_sum=("actual", "sum"),
                    prediction_sum=("prediction", "sum"),
                    mean_residual=("residual", "mean"),
                    mae=("abs_error", "mean"),
                    under_forecast_rate=("under_forecast", "mean"),
                )
                """
            ),
        ],
    ),
    (
        "09_Prediction_Intervals_And_Calibration.ipynb",
        "Prediction Intervals And Calibration",
        [
            md(
                """
                # Prediction Intervals And Calibration

                P10/P90 intervals are useful only if coverage is checked against held-out actuals.
                """
            ),
            code(COMMON_SETUP),
            code("calibration = load_csv('interval_calibration.csv')\ncalibration"),
            code(
                """
                selected = load_csv("selected_model_backtest_rows.csv")
                selected[["model", "material_code", "month", "actual", "prediction", "residual", "abs_error"]].head(30)
                """
            ),
            code(
                """
                forward = load_csv("forecast_results_v7.csv", parse_dates=["forecast_period"])
                forward.groupby("horizon").agg(
                    materials=("material_id", "nunique"),
                    p10_sum=("forecast_p10", "sum"),
                    p50_sum=("forecast_p50", "sum"),
                    p90_sum=("forecast_p90", "sum"),
                )
                """
            ),
        ],
    ),
    (
        "10_Forecast_To_Inventory_Policy.ipynb",
        "Forecast To Inventory Policy",
        [
            md(
                """
                # Forecast To Inventory Policy

                Forecasts are converted to safety stock, reorder point, min/max, order quantity, and pallet-position impact.
                """
            ),
            code(COMMON_SETUP),
            code("forecasts = load_csv('forecast_results_v7.csv', parse_dates=['forecast_period'])\nforecasts.head(30)"),
            code("policy = load_csv('inventory_policy_recommendations_v7.csv')\npolicy.head(30)"),
            code("policy.groupby(['recommendation_status', 'abc_class', 'fms_class']).size().reset_index(name='materials')"),
            code(
                """
                policy.sort_values("suggested_order_qty", ascending=False)[
                    ["material_code", "description", "abc_class", "fms_class", "forecast_p50_sum", "available_qty", "proposed_reorder_point", "proposed_max_stock", "suggested_order_qty", "recommendation_status"]
                ].head(40)
                """
            ),
        ],
    ),
    (
        "11_Forecast_To_Slotting_And_Space.ipynb",
        "Forecast To Slotting And Space",
        [
            md(
                """
                # Forecast To Slotting And Space

                Slotting evidence is based on demand class, forecast volume, order pressure, and pallet-position delta.
                """
            ),
            code(COMMON_SETUP),
            code("slotting = load_csv('slotting_readiness_v7.csv')\nslotting.head(40)"),
            code("slotting.groupby(['accessibility_need', 'slotting_action']).size().reset_index(name='materials')"),
            code(
                """
                slotting.sort_values("slotting_score", ascending=False)[
                    ["material_code", "description", "abc_class", "fms_class", "forecast_p50_sum", "pallet_positions_delta", "accessibility_need", "slotting_score", "slotting_action"]
                ].head(50)
                """
            ),
        ],
    ),
    (
        "12_Limitations_And_Executive_Evidence.ipynb",
        "Limitations And Executive Evidence",
        [
            md(
                """
                # Limitations And Executive Evidence

                This final notebook gives the honest evaluator-facing story: what is real, what is wired, and what remains a limitation.
                """
            ),
            code(COMMON_SETUP),
            code("Markdown((OUT / 'executive_summary.md').read_text())"),
            code(
                """
                summary = load_json("data_lineage_summary.json")
                pd.DataFrame([
                    {"claim": "v7 forecasts RM/PM directly", "evidence": f"{summary.get('demand_materials')} materials, {summary.get('demand_rows')} monthly rows"},
                    {"claim": "BOM explosion is not production-primary", "evidence": f"BOM product-parent coverage {summary.get('bom_product_parent_coverage_pct')}%"},
                    {"claim": "Spring forecast_results is canonical", "evidence": str(summary.get("publication", "publication not requested in this run"))},
                    {"claim": "LightGBM is candidate champion", "evidence": f"selected model {summary.get('selected_model')} with leaderboard in model_leaderboard.csv"},
                    {"claim": "Dashboard residuals need backtest source", "evidence": "forward forecast_results rows normally have null y_true"},
                ])
                """
            ),
            code(
                """
                load_csv("model_leaderboard.csv")
                """
            ),
        ],
    ),
]


def build_notebook(title: str, cells: list) -> nbf.NotebookNode:
    nb = nbf.v4.new_notebook()
    nb["metadata"] = {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "pygments_lexer": "ipython3"},
        "title": title,
    }
    nb["cells"] = cells
    return nb


def generate_notebooks(root: Path = ROOT) -> list[Path]:
    for filename in OBSOLETE_NOTEBOOKS:
        path = root / filename
        if path.exists():
            path.unlink()
    written: list[Path] = []
    for filename, title, cells in NOTEBOOKS:
        path = root / filename
        nbf.write(build_notebook(title, cells), path)
        written.append(path)
    return written


def main() -> int:
    for path in generate_notebooks():
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
