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
    champion = summary["locked_champion"]
    metrics = summary["test_champion_metrics"]

    model_card = {
        "model_id": "V8_CONTROLLED_EXTRA_TREES_CAUSAL",
        "display_name": "Controlled RM/PM Causal Extra Trees",
        "model_family": "ExtraTreesRegressor",
        "role": "enterprise_validation_harness",
        "training_data_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
        "training_source": "generated_fg_plan_bom_rm_pm_history",
        "synthetic_ratio": 1.0,
        "production_decision_eligible": False,
        "simulation_decision_eligible": True,
        "locked_before_test": True,
        "test_protocol": "6 tuning origins + 6 champion-selection origins + 12 untouched rolling origins",
        "test_metrics": metrics,
        "interval_coverage": interval,
        "approved_uses": [
            "offline statistical validation",
            "simulation UI mode",
            "MILP and knapsack sandbox tests",
            "inventory-policy integration tests",
            "schema and API contract testing",
        ],
        "prohibited_uses": [
            "automatic operational min/max updates",
            "production purchase-order creation",
            "production slotting or space-plan approval",
            "publication as a real Hemas forecast",
            "claiming measured production accuracy",
        ],
        "promotion_requirements": [
            "real material-issue history with source lineage",
            "validated effective-dated FG-to-RM/PM BOM coverage",
            "production plans known at forecast creation time",
            "same nested rolling-origin protocol on real data",
            "calibrated intervals and inventory service/cost validation",
            "shadow-mode approval before decision eligibility",
        ],
    }
    (OUT / "model_card.json").write_text(json.dumps(model_card, indent=2, default=str))

    integration_contract = {
        "contract_version": "1.0",
        "mode": "SIMULATION_ONLY",
        "model_id": model_card["model_id"],
        "canonical_business_store": "Spring PostgreSQL forecast_results",
        "publish_allowed": False,
        "required_forecast_fields": [
            "material_id", "warehouse_id", "forecast_period", "horizon",
            "forecast_p10", "forecast_p50", "forecast_p90", "model_name",
            "training_source", "data_quality_tier", "synthetic_ratio",
            "decision_eligible", "source_lineage",
        ],
        "downstream_gate": {
            "inventory_policy": "simulation workspace only when decision_eligible=false",
            "milp_knapsack": "sandbox run only; no approval/apply action",
            "slotting": "simulation recommendation only",
            "frontend": "show SIMULATION badge and evidence source on every chart",
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
            "current_v8_status": "not registered in forecast-service; intentionally blocked from production recalculate",
        },
    }
    (OUT / "integration_contract.json").write_text(json.dumps(integration_contract, indent=2))

    deployment = {
        "decision": "DO_NOT_PROMOTE_TO_PRODUCTION",
        "simulation_ready": True,
        "python_microservice_ready": False,
        "spring_canonical_publish_ready": False,
        "frontend_production_ready": False,
        "policy_simulation_ready": True,
        "milp_knapsack_simulation_ready": True,
        "reason": "Model and features are fitted to generated material identities, BOMs, production plans and history.",
        "next_gate": "replace generated identities and history with validated operational data, retrain, shadow-test and approve",
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

        **Decision:** the v8 champion is enterprise-quality as a validation harness and simulation model. It is not a production forecast model because its material identities, BOMs, production plans and history are generated.
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
        display(leaderboard.assign(WAPE_pct=100*leaderboard.WAPE, Bias_pct=100*leaderboard.Bias).round(2))
        display(paired.round(4))
        display(residual)
        display(interval)
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
        | MILP/knapsack sandbox | Ready | Policy outputs can be used in non-operational optimizer tests |
        | Python production inference | Blocked | Model is fitted to generated identities and features |
        | Spring canonical publication | Blocked | Synthetic rows are not operational decision evidence |
        | Frontend production display | Blocked | Must not present simulation metrics as live production performance |
        | Recalculate production action | Blocked for v8 | Requires a registered real-data model and atomic canonical publish job |
        """),
        _code("""
        {"model_card": model_card, "deployment": deployment, "integration_contract": contract}
        """),
        _md("""
        ## 3. Final Conclusion

        The experiment proves that the architecture and implementation can forecast a controlled RM/PM process and that production/BOM signals materially improve performance. It does not prove that v8 can forecast the real warehouse. The enterprise next step is data substitution, not another synthetic hyperparameter search: load real issue transactions, validated BOM versions and production plans into the same contract, retrain, run shadow backtests, calibrate intervals, validate inventory outcomes, and only then set `decision_eligible=true`.
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

