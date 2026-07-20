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
            - The selection-locked Extra Trees causal model reaches approximately 8.34% WAPE on twelve untouched origins.
            - Random Forest is statistically indistinguishable from the locked Extra Trees candidate in this test, showing that causal tree ensembles recover similar behavior.
            - Direct-history LightGBM is significantly worse than BOM-plan forecasting, demonstrating the value of known production/BOM inputs.
            - Conformal intervals achieve approximately their nominal 90% coverage.
            - Heavy tails and heteroscedasticity remain even when point forecasts are good; Gaussian residual claims remain invalid.

            ## Unsupported Conclusions

            - Synthetic success does not prove real production accuracy.
            - Synthetic success does not prove that every v7 error is exclusively a data problem.
            - A complete synthetic BOM cannot be represented as a real validated Hemas BOM.
            - Hyperparameter search cannot replace real material-issue and production-order history.

            ## Operational Decision

            Keep v8 as the controlled validation harness and explicit project-operational simulation seed. Its rows may drive the integrated demonstration only while their synthetic provenance and decision scope remain visible. They are not evidence of external production accuracy.
            """),
        ],
        "07_Synthetic_Data_Generation_Methods_And_Proof.ipynb": [
            md("""
            # Synthetic RM/PM Data Generation: Methods, Proof And Workflow Suitability

            This standalone notebook provides evaluator-facing proof of how the project-operational dataset was generated. It documents the technologies, equations, stochastic distributions, causal relationships, validation checks, plots, reproducibility controls and WMS table mapping.

            **Claim boundary:** this is a seeded controlled simulation with known ground truth. It validates software integration and whether forecasting methods can recover a known process. It does not prove accuracy on an external warehouse and must not be described as observed customer history.
            """),
            code("""
            from pathlib import Path
            import hashlib
            import inspect
            import json
            import sys
            import numpy as np
            import pandas as pd
            import matplotlib.pyplot as plt
            import seaborn as sns

            ROOT = Path.cwd()
            if ROOT.name != "v8_controlled_synthetic_validation":
                candidate = ROOT / "Ai miroservices/modeling/v8_controlled_synthetic_validation"
                ROOT = candidate if candidate.exists() else ROOT
            sys.path.insert(0, str(ROOT))
            from pipeline.generate_data import SimulationConfig, generate_controlled_dataset

            OUT = ROOT / "outputs"
            DATA = OUT / "data"
            summary = json.loads((OUT / "run_summary.json").read_text())
            cfg = SimulationConfig()
            sns.set_theme(style="whitegrid", context="notebook")
            pd.set_option("display.max_columns", 80)
            cfg
            """),
            md("""
            ## 1. Technologies And Randomness

            - **NumPy `Generator`** supplies deterministic pseudo-random draws from a fixed seed (`20260711`). NumPy's generator provides an auditable, reproducible random stream; it is not an LLM or an undocumented data generator.
            - **Pandas** builds relational tables and performs the FG-to-component BOM explosion.
            - **Sinusoidal seasonal profiles** represent annual periodicity with randomized phase and amplitude.
            - **Lognormal distributions** generate positive, right-skewed costs, BOM quantities and multiplicative operational variation.
            - **Bernoulli events** generate promotions and rare disruptions/surges.
            - **Autoregressive carryover** links current actual production to the previous month, preventing independent random months.
            - **Structural interventions** introduce persistent level changes.
            - **Heteroscedastic noise** increases absolute uncertainty with material demand scale.

            These methods are suitable for a controlled WMS benchmark because their parameters are explicit, causal relationships are known, and the entire dataset is reproducible. They are not a substitute for estimating real-site distributions from observed data.
            """),
            code("""
            technology_register = pd.DataFrame([
                ["Reproducibility", "NumPy seeded Generator", cfg.seed, "Repeatable complete dataset"],
                ["Seasonality", "1 + A sin(2*pi*m/12 + phase)", "A ~ U(0.05, 0.28)", "Annual FG demand pattern"],
                ["Trend", "Compound annual trend", "r ~ U(-0.04, 0.12)", "Growth and decline"],
                ["Promotion", "Bernoulli event", "p = 0.11; multiplier 1.18", "Known demand uplift"],
                ["Holiday", "Calendar intervention", "months 1, 4, 12; multiplier 0.88", "Planned shutdown/slowdown"],
                ["Structural shift", "Persistent level intervention", "start month U(42,58); factor U(0.78,1.30)", "Regime change"],
                ["Rare shock", "Bernoulli plus discrete severity", "p = 0.035; {0.45,0.60,1.55,1.90}", "Disruption or surge"],
                ["Actual production", "Autoregressive causal equation", "0.55 plan + 0.25 lag actual + 0.20 shocked plan", "Plan deviation and persistence"],
                ["RM/PM demand", "BOM explosion", "FG actual * qty * (1+scrap) / yield", "Material requirements"],
                ["Process error", "Scale-dependent additive noise", "sigma grows with requirement", "Heteroscedastic consumption"],
            ], columns=["Purpose", "Method", "Parameters", "Workflow meaning"])
            technology_register
            """),
            md(r"""
            ## 2. Data-Generating Equations

            For finished good (i), month (t):

            \[
            P_{i,t}=B_i(1+r_i)^{t/12}S_{i,m(t)}I^{promo}_{i,t}I^{holiday}_tI^{shift}_{i,t}\epsilon^{plan}_{i,t}
            \]

            \[
            A_{i,t}=\left(0.55P_{i,t}+0.25A_{i,t-1}+0.20P_{i,t}K_{i,t}\right)\epsilon^{actual}_{i,t}
            \]

            For material (j), BOM component relation (q_{ij}), scrap (s_{ij}), and yield (y_{ij}):

            \[
            R_{j,t}=\sum_i A_{i,t}q_{ij}\frac{1+s_{ij}}{y_{ij}}
            \]

            Observed simulated issue demand is (D_{j,t}=\max(0,R_{j,t}+e_{j,t})), where the variance of (e_{j,t}) increases with (R_{j,t}). This deliberately creates the high-volume error behavior seen in real inventory systems without claiming that its fitted parameters came from a real warehouse.
            """),
            code("""
            materials = pd.read_csv(DATA / "materials.csv")
            fg = pd.read_csv(DATA / "finished_goods.csv")
            bom = pd.read_csv(DATA / "bom_components.csv")
            production = pd.read_csv(DATA / "production_plan_actuals.csv", parse_dates=["month"])
            demand = pd.read_csv(DATA / "material_demand.csv", parse_dates=["month"])
            initial = pd.read_csv(DATA / "initial_inventory.csv")

            table_register = pd.DataFrame([
                ["materials.csv", len(materials), "Material master, MOQ, order multiple, lead time, cost, service level", "materials"],
                ["finished_goods.csv", len(fg), "FG base demand, trend and volatility parameters", "materials (type=product)"],
                ["bom_components.csv", len(bom), "Effective component quantities, scrap and yield", "bom_headers + bom_components"],
                ["production_plan_actuals.csv", len(production), "Monthly FG plan, actual, promotion, holiday and shock state", "planning evidence"],
                ["material_demand.csv", len(demand), "Monthly exploded RM/PM requirement and issue demand", "demand_history"],
                ["initial_inventory.csv", len(initial), "Starting stock and replenishment constraints", "inventory"],
            ], columns=["Generated table", "Rows", "Role", "WMS destination"])
            table_register
            """),
            md("""
            ## 3. Parameter And Master-Data Distributions

            Discrete operational values are used for MOQ/order multiples because purchasing constraints are not continuous. Lead times are bounded at 5-45 days. Costs are right-skewed and positive. The service-level choices are explicit policy scenarios, not estimated customer service levels.
            """),
            code("""
            fig, axes = plt.subplots(2, 2, figsize=(14, 9))
            sns.histplot(materials, x="lead_time_days", hue="material_type", multiple="stack", bins=12, ax=axes[0,0])
            axes[0,0].set_title("Supplier Lead-Time Distribution")
            sns.countplot(materials, x="order_multiple", hue="material_type", ax=axes[0,1])
            axes[0,1].set_title("Discrete Order Multiples")
            sns.histplot(materials, x="moq", hue="material_type", element="step", log_scale=True, ax=axes[1,0])
            axes[1,0].set_title("MOQ Distribution (log x-axis)")
            sns.histplot(materials, x="unit_cost", hue="material_type", element="step", log_scale=True, ax=axes[1,1])
            axes[1,1].set_title("Right-Skewed Unit Cost (log x-axis)")
            plt.tight_layout()
            plt.show()
            materials.groupby("material_type")[["moq", "order_multiple", "lead_time_days", "unit_cost"]].describe().round(2)
            """),
            md("""
            ## 4. BOM Topology And Coverage Proof

            Each FG initially draws 4-8 RM and 1-3 PM components without replacement. A deterministic coverage repair then attaches any unused material to one FG. This guarantees controlled component coverage for testing BOM explosion; it must not be confused with a naturally observed BOM network.
            """),
            code("""
            fg_degree = bom.groupby("fg_id")["material_id"].nunique()
            material_degree = bom.groupby("material_id")["fg_id"].nunique()
            coverage = pd.DataFrame({
                "check": ["FG parents covered", "RM/PM components covered", "unique BOM relations", "duplicate FG-component keys"],
                "value": [bom.fg_id.nunique(), bom.material_id.nunique(), len(bom), bom.duplicated(["fg_id", "material_id"]).sum()],
                "expected": [len(fg), len(materials), len(bom), 0],
            })
            display(coverage)
            fig, axes = plt.subplots(1, 2, figsize=(13, 4))
            sns.histplot(fg_degree, discrete=True, ax=axes[0], color="#d90b4d")
            axes[0].set_title("Components Per Finished Good")
            sns.histplot(material_degree, discrete=True, ax=axes[1], color="#1473e6")
            axes[1].set_title("Finished Goods Using Each Material")
            plt.tight_layout(); plt.show()
            """),
            md("""
            ## 5. Production Dynamics: Plan, Actual, Seasonality And Events

            The plan is known at forecast creation time in the controlled causal experiment. Actual production deviates through persistence, multiplicative variation and rare shocks. This distinction prevents using future actual production as a feature.
            """),
            code("""
            monthly = production.groupby("month", as_index=False).agg(
                planned=("planned_fg_units", "sum"), actual=("actual_fg_units", "sum"),
                promotions=("promotion_flag", "sum"), shocks=("shock_type", lambda x: (x != "none").sum()),
            )
            fig, ax = plt.subplots(figsize=(15, 5))
            ax.plot(monthly.month, monthly.planned, label="Known production plan", color="#1473e6")
            ax.plot(monthly.month, monthly.actual, label="Simulated actual production", color="#d90b4d", alpha=.85)
            shock_months = monthly.loc[monthly.shocks.gt(0)]
            ax.scatter(shock_months.month, shock_months.actual, label="Month containing shock", color="#f59e0b", zorder=3)
            ax.set_title("Aggregate Planned Versus Actual Finished-Good Production")
            ax.set_ylabel("FG units"); ax.legend(); plt.tight_layout(); plt.show()
            production.groupby("shock_type").agg(rows=("fg_id","size"), mean_plan=("planned_fg_units","mean"), mean_actual=("actual_fg_units","mean")).round(2)
            """),
            md("""
            ## 6. Material Demand, Scale And Heteroscedasticity

            Raw and packaging demand is not sampled independently. It is caused by FG production and the BOM. The final process error is scale dependent, so large-volume materials have larger absolute errors even when relative error is reasonable.
            """),
            code("""
            demand["process_error"] = demand["demand_units"] - demand["actual_bom_requirement"]
            demand["requirement_band"] = pd.qcut(demand["actual_bom_requirement"].rank(method="first"), 5, labels=["Q1","Q2","Q3","Q4","Q5"])
            band = demand.groupby("requirement_band", observed=True).agg(
                rows=("material_id","size"), mean_requirement=("actual_bom_requirement","mean"),
                error_std=("process_error","std"), mean_abs_error=("process_error", lambda s: s.abs().mean()),
            ).reset_index()
            display(band.round(2))
            sample = demand.sample(min(5000, len(demand)), random_state=cfg.seed)
            fig, axes = plt.subplots(1, 2, figsize=(14, 5))
            sns.histplot(sample, x="demand_units", hue="material_type", element="step", log_scale=True, ax=axes[0])
            axes[0].set_title("RM/PM Demand Is Positive And Right-Skewed")
            sns.scatterplot(sample, x="actual_bom_requirement", y="process_error", hue="material_type", alpha=.35, s=22, ax=axes[1])
            axes[1].set_xscale("symlog"); axes[1].set_yscale("symlog")
            axes[1].set_title("Error Spread Increases With Requirement Scale")
            plt.tight_layout(); plt.show()
            """),
            md("""
            ## 7. Temporal Dependence And Intermittency

            A warehouse history should not be independent rows. Lag correlation comes from production carryover and repeated BOM usage. Intermittency appears when materials are attached to fewer active FGs or when their exploded requirement is zero.
            """),
            code("""
            temporal = []
            for material_id, group in demand.sort_values("month").groupby("material_id"):
                temporal.append({
                    "material_id": material_id,
                    "lag1_autocorrelation": group.demand_units.autocorr(1),
                    "zero_rate": group.demand_units.eq(0).mean(),
                    "mean_demand": group.demand_units.mean(),
                })
            temporal = pd.DataFrame(temporal).merge(materials[["material_id","material_type"]], on="material_id")
            fig, axes = plt.subplots(1, 2, figsize=(13, 4))
            sns.histplot(temporal, x="lag1_autocorrelation", hue="material_type", element="step", ax=axes[0])
            axes[0].axvline(0, color="black", lw=1); axes[0].set_title("Material Lag-1 Autocorrelation")
            sns.histplot(temporal, x="zero_rate", hue="material_type", element="step", ax=axes[1])
            axes[1].set_title("Material Intermittency / Zero Rate")
            plt.tight_layout(); plt.show()
            temporal.groupby("material_type")[["lag1_autocorrelation","zero_rate","mean_demand"]].describe().round(3)
            """),
            md("""
            ## 8. Integrity, Leakage And Reproducibility Proof

            The fixed seed must regenerate identical CSV bytes under the same code/library behavior. The model protocol must use demand lags only through `t-1`; current-month production plan may be used only by explicitly causal candidates. Future actual production and target-month actual material demand are forbidden features.
            """),
            code("""
            integrity = {
                "months": int(demand.month.nunique()),
                "material_month_rows": int(len(demand)),
                "expected_material_month_rows": int(cfg.months * (cfg.rm_count + cfg.pm_count)),
                "negative_demand_rows": int(demand.demand_units.lt(0).sum()),
                "duplicate_material_month_keys": int(demand.duplicated(["material_id","month"]).sum()),
                "bom_parent_coverage_pct": 100 * bom.fg_id.nunique() / len(fg),
                "bom_component_coverage_pct": 100 * bom.material_id.nunique() / len(materials),
                "seed": cfg.seed,
            }
            digest = hashlib.sha256()
            for path in sorted(DATA.glob("*.csv")):
                digest.update(path.name.encode())
                digest.update(path.read_bytes())
            integrity["generated_data_sha256"] = digest.hexdigest()
            pd.Series(integrity, name="value").to_frame()
            """),
            code("""
            source_lines = inspect.getsource(generate_controlled_dataset).splitlines()
            print("Generator implementation:", ROOT / "pipeline/generate_data.py")
            print("Function lines:", len(source_lines))
            print("First 35 lines of the executable generator:")
            print()
            print(chr(10).join(source_lines[:35]))
            """),
            md("""
            ## 9. Suitability For OptiWMS Workflows

            | WMS workflow | Generated evidence | Suitable project use | Limitation |
            |---|---|---|---|
            | Product/material catalogue | RM, PM, FG masters and units | UI/API/database integration | Names and attributes are simulated |
            | BOM management | Complete effective FG-component graph | BOM CRUD and explosion tests | Coverage is deliberately repaired to 100% |
            | Demand forecasting | 72-month causal RM/PM panel | Rolling backtests, model comparison | Parameters are not fitted to a real site |
            | Inventory policy | MOQ, order multiple, lead time, service level, cost | Min/max, ROP, safety stock, order rounding | Service outcomes need real lead-time variation |
            | Slotting/MILP | Demand velocity, ABC/FMS inputs and stock quantities | Space/ranking/solver integration | Physical dimensions and travel observations need site calibration |
            | Supplier planning | Lead time and purchasing constraints | API and procurement-rule validation | Supplier reliability is simplified |

            This dataset is appropriate as the project's operational simulation seed and as a controlled scientific benchmark. It is not appropriate for claiming customer savings, real fill rate, real stockout risk, or deployment accuracy.
            """),
            code("""
            suitability_checks = pd.DataFrame([
                ["Relational completeness", integrity["bom_parent_coverage_pct"] == 100 and integrity["bom_component_coverage_pct"] == 100],
                ["Balanced material panel", integrity["material_month_rows"] == integrity["expected_material_month_rows"]],
                ["Non-negative demand", integrity["negative_demand_rows"] == 0],
                ["Unique material-month keys", integrity["duplicate_material_month_keys"] == 0],
                ["Reproducible seed recorded", integrity["seed"] == 20260711],
                ["External production validity proven", False],
            ], columns=["Gate", "Pass"])
            suitability_checks
            """),
            md("""
            ## 10. Defensible Conclusion And Next Step

            The generator is statistically reasonable for **controlled recovery and end-to-end WMS testing** because it contains temporal dependence, annual seasonality, causal BOM structure, policy constraints, regime changes, rare shocks, skewed positive variables and scale-dependent error. The resulting benchmark is harder and more realistic than independent Gaussian random rows.

            The evidence does **not** establish external validity. The next scientific step is to replace each assumed distribution with an empirical or fitted distribution when actual issue, production, supplier and BOM data become available, while retaining the same leakage-safe rolling-origin protocol. Until then, OptiWMS should display `Project operational simulation` provenance and treat model metrics as controlled-test evidence.
            """),
        ],
    }
    for name, cells in notebooks.items():
        _write(name, cells)
    return list(notebooks)


if __name__ == "__main__":
    print("\n".join(build()))
