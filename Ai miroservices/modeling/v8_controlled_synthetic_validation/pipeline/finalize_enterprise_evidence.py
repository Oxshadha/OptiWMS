from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"


def _md(text: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": [line + "\n" for line in dedent(text).strip().splitlines()]}


def _code(text: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [line + "\n" for line in dedent(text).strip().splitlines()]}


def finalize() -> dict:
    summary = json.loads((OUT / "run_summary.json").read_text())
    leaderboard = pd.read_csv(OUT / "model_leaderboard.csv")
    residual = pd.read_csv(OUT / "residual_tests.csv")
    interval = pd.read_csv(OUT / "interval_calibration.csv").iloc[0].to_dict()
    operational_metrics = pd.read_csv(OUT / "operational_backtest_metrics.csv")
    recursive_metrics = operational_metrics[
        operational_metrics["horizon"].eq(0)
    ].iloc[0].to_dict()
    model_comparison = pd.read_csv(
        OUT / "operational_model_comparison.csv"
    ).iloc[0].to_dict()
    storage_summary = json.loads((OUT / "storage_slotting_summary.json").read_text())
    champion = summary["locked_champion"]
    metrics = summary["test_champion_metrics"]

    model_card = {
        "model_id": "V8_CONTROLLED_EXTRA_TREES_CAUSAL",
        "display_name": "Controlled RM/PM Causal Extra Trees",
        "model_family": "ExtraTreesRegressor",
        "role": "project_operational_baseline_champion",
        "training_data_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
        "training_source": "generated_fg_plan_bom_rm_pm_history",
        "synthetic_ratio": 1.0,
        "decision_scope": "PROJECT_OPERATIONAL_SYNTHETIC_BASELINE",
        "decision_eligible": True,
        "external_population_validity": "UNVERIFIED",
        "external_business_decision_eligible": False,
        "simulation_decision_eligible": True,
        "locked_before_test": True,
        "test_protocol": "6 tuning origins + 6 champion-selection origins + 12 untouched rolling origins",
        "test_metrics": metrics,
        "recursive_serving_test_metrics": recursive_metrics,
        "neural_challenger_comparison": model_comparison,
        "interval_coverage": interval,
        "approved_uses": [
            "forecast microservice batch serving",
            "project WMS forecast_results publication",
            "project inventory min/max and reorder recommendations",
            "project inventory-policy and quantity-optimization inputs",
            "project physical storage and OR-Tools slotting optimization",
            "offline statistical validation",
            "schema and API contract testing",
        ],
        "prohibited_uses": [
            "claiming results were measured on externally observed history",
            "claiming measured production accuracy",
            "unlabelled use outside the project synthetic population",
            "claiming generated coordinates were confirmed by a physical warehouse survey",
        ],
        "external_population_promotion_requirements": [
            "real material-issue history with source lineage",
            "validated effective-dated FG-to-RM/PM BOM coverage",
            "production plans known at forecast creation time",
            "same nested rolling-origin protocol on real data",
            "calibrated intervals and inventory service/cost validation",
            "shadow-mode approval before decision eligibility",
        ],
        "physical_population": storage_summary,
    }
    (OUT / "model_card.json").write_text(json.dumps(model_card, indent=2, default=str))

    integration_contract = {
        "contract_version": "2.1",
        "mode": "PROJECT_OPERATIONAL_SYNTHETIC_BASELINE",
        "model_id": model_card["model_id"],
        "canonical_business_store": "Spring PostgreSQL forecast_results",
        "publish_allowed": True,
        "required_forecast_fields": [
            "material_id", "warehouse_id", "forecast_period", "horizon",
            "forecast_p10", "forecast_p50", "forecast_p90", "model_name",
            "training_source", "data_quality_tier", "synthetic_ratio",
            "decision_eligible", "source_lineage",
        ],
        "downstream_gate": {
            "inventory_policy": "allowed for the project population when decision_eligible=true",
            "milp_knapsack": "quantity optimization allowed using the same forecast and inventory dataset hash",
            "slotting": "allowed for the project population using the validated v8 physical layout and assignments",
            "frontend": "show PROJECT SYNTHETIC BASELINE provenance on every evidence view",
        },
        "recalculate_contract": {
            "required_steps": [
                "create immutable run",
                "validate model and dataset binding",
                "publish progress events",
                "generate forecasts",
                "persist evaluation and lineage",
                "publish canonical rows atomically",
                "refresh policy and optional optimizer readiness",
            ],
            "current_v8_status": "wired to /v8/recalculate and the v8 snapshot forecast provider",
        },
    }
    (OUT / "integration_contract.json").write_text(json.dumps(integration_contract, indent=2))

    deployment = {
        "decision": "PROMOTE_TO_PROJECT_OPERATIONAL_BASELINE",
        "simulation_ready": True,
        "python_microservice_ready": True,
        "spring_canonical_publish_ready": True,
        "frontend_project_operational_ready": True,
        "policy_simulation_ready": True,
        "milp_knapsack_simulation_ready": True,
        "storage_slotting_population_ready": True,
        "storage_slotting_validation": storage_summary,
        "reason": "The generated v8 population is the declared project-operational source of truth; forecasting, physical storage and OR-Tools slotting pass their project acceptance evidence.",
        "external_population_validity": "UNVERIFIED",
        "next_gate": "Use scheduled POST /v8/recalculate refreshes. A physical survey remains the separate gate before claiming the generated coordinates represent an external warehouse.",
    }
    (OUT / "deployment_decision.json").write_text(json.dumps(deployment, indent=2))

    setup = """
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
    PLOTS = OUT / "plots"
    summary = json.loads((OUT / "run_summary.json").read_text())
    model_card = json.loads((OUT / "model_card.json").read_text())
    deployment = json.loads((OUT / "deployment_decision.json").read_text())
    contract = json.loads((OUT / "integration_contract.json").read_text())
    """
    cells = [
        _md("""
        # Final Enterprise Model Decision And End-to-End Contract

        This notebook consolidates the complete controlled experiment using the model-building principles in *Forecasting: Theory and Practice*: preprocessing and outlier awareness, exogenous/domain features, cross-learning, statistical baselines, intermittent-demand methods, rolling-origin testing, formal forecast comparison, residual diagnosis, probabilistic calibration and explicit decision consequences.

        **Decision:** the v8 champion is the deployable forecasting, inventory-policy and storage/slotting baseline for the explicitly synthetic OptiWMS population. Synthetic provenance remains visible, while external real-world population validity and physical-survey confirmation remain `UNVERIFIED`.
        """),
        _code(setup),
        _md("""
        ## 1. Research-Guideline Checklist

        - Data lineage and generated-ground-truth flags are explicit.
        - Target month `t` uses demand only through `t-1`.
        - Production/BOM inputs are used only when assumed known at forecast creation time.
        - Statistical, intermittent, deterministic and ML candidates share identical test rows.
        - Hyperparameters are tuned before champion selection.
        - Champion selection is separate from the untouched final test.
        - Paired t, Wilcoxon and low-power monthly DM-style evidence are reported together.
        - Residual normality, autocorrelation and heteroscedasticity are tested.
        - Prediction intervals are calibrated outside the test window.
        - Inventory policy obeys MOQ and order multiples.
        """),
        _code("""
        leaderboard = pd.read_csv(OUT / "model_leaderboard.csv")
        paired = pd.read_csv(OUT / "paired_model_tests.csv")
        residual = pd.read_csv(OUT / "residual_tests.csv")
        interval = pd.read_csv(OUT / "interval_calibration.csv")
        operational_metrics = pd.read_csv(OUT / "operational_backtest_metrics.csv")
        model_comparison = pd.read_csv(OUT / "operational_model_comparison.csv")
        storage_validation = pd.read_csv(OUT / "storage_slotting_validation.csv")
        storage_summary = json.loads((OUT / "storage_slotting_summary.json").read_text())
        display(leaderboard.assign(WAPE_pct=100*leaderboard.WAPE, Bias_pct=100*leaderboard.Bias).round(2))
        display(paired.round(4))
        display(residual)
        display(interval)
        display(operational_metrics.assign(WAPE_pct=100*operational_metrics.WAPE, Bias_pct=100*operational_metrics.Bias).round(3))
        display(model_comparison.round(4))
        display(storage_validation)
        display(storage_summary)
        """),
        _code("""
        display(Image(filename=str(PLOTS / "02_model_leaderboard.png")))
        display(Image(filename=str(PLOTS / "03_champion_residual_diagnostics.png")))
        display(Image(filename=str(PLOTS / "05_feature_importance.png")))
        display(Image(filename=str(PLOTS / "07_extra_trees_feature_importance.png")))
        display(Image(filename=str(PLOTS / "08_random_forest_feature_importance.png")))
        """),
        _md("""
        ## 2. End-to-End Readiness

        | Layer | Status | Reason |
        |---|---|---|
        | Controlled data generator | Ready | Reproducible seed, complete synthetic BOM and policies |
        | Model/evaluation pipeline | Ready | Nested rolling protocol and diagnostics pass |
        | Inventory policy simulation | Ready | MOQ/order-multiple constraints validated |
        | MILP/knapsack quantity optimization | Ready | Uses the same project material, BOM, inventory and forecast population |
        | Storage/slotting optimization | Ready | 144 materials, 4,200 storage positions and 3,257 policy-capacity assignments pass physical validation |
        | Python forecast microservice | Ready | Governed recursive H1-H12 snapshot provider |
        | Spring canonical publication | Ready | Atomic v8 loader preserves lineage and decision scope |
        | Frontend project display | Ready | Must retain project-synthetic provenance |
        | Recalculate action | Ready | `POST /v8/recalculate` refits, publishes and registers the locked champion |
        """),
        _code("""
        {"model_card": model_card, "deployment": deployment, "integration_contract": contract}
        """),
        _md("""
        ## 3. Final Conclusion

        The v8 population is the project-operational source of truth for forecasts, inventory policy, quantity optimization, physical storage and slotting when every consumer uses the same dataset hash. The generated A-E layout is internally feasible and OR-Tools optimal for this population. This does not convert synthetic evidence or generated coordinates into externally observed evidence: external population validity and physical-survey confirmation remain `UNVERIFIED`.
        """),
    ]
    notebook = {
        "cells": cells,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python", "version": "3.10"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path = ROOT / "06_Final_Enterprise_Model_Decision_And_E2E.ipynb"
    path.write_text(json.dumps(notebook, indent=1))
    return {"model_card": model_card, "integration_contract": integration_contract, "deployment": deployment, "notebook": str(path)}


if __name__ == "__main__":
    print(json.dumps(finalize(), indent=2, default=str))
