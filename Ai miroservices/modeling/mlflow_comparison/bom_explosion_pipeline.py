"""
Two-Layer BOM Forecast Pipeline — Phase 2.4

FG demand forecast -> BOM explosion -> RM gross requirements.
Uses quantile forecasts (p10/p50/p90) for uncertainty propagation.
"""
from __future__ import annotations

import os
from pathlib import Path

import mlflow
import numpy as np
import pandas as pd

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
EXPERIMENT_NAME = "OptiWMS_BOM_Explosion"

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "modeling" / "outputs"
GENERATED_DIR = OUTPUT_DIR / "generated"


def setup_mlflow():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)


def load_inputs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load FG forecasts and BOM mappings."""
    forecast_path = GENERATED_DIR / "warehouse_quantile_forecasts.csv"
    bom_path = GENERATED_DIR / "bom_clean.csv"

    if not forecast_path.exists():
        raise FileNotFoundError(f"Run warehouse_forecast_pipeline.py first: {forecast_path}")
    if not bom_path.exists():
        raise FileNotFoundError(f"Run generate_bom_clean.py first: {bom_path}")

    forecasts = pd.read_csv(forecast_path)
    bom = pd.read_csv(bom_path)

    return forecasts, bom


def explode_bom(fg_forecasts: pd.DataFrame, bom: pd.DataFrame) -> pd.DataFrame:
    """
    Multiply FG quantile forecasts by BOM coefficients to derive RM requirements.
    Propagates uncertainty: RM_p90 = sum(FG_p90 * bom_coef) for worst-case planning.
    """
    fg_only = fg_forecasts[fg_forecasts["fg_code"].str.startswith("FG")].copy()

    merged = fg_only.merge(bom, on="fg_code", how="inner")

    if merged.empty:
        print("WARNING: No BOM matches found. Check FG code alignment.")
        return pd.DataFrame()

    merged["rm_req_p10"] = merged["forecast_p10"] * merged["bom_coef"]
    merged["rm_req_p50"] = merged["forecast_p50"] * merged["bom_coef"]
    merged["rm_req_p90"] = merged["forecast_p90"] * merged["bom_coef"]

    rm_requirements = (
        merged.groupby(["rm_code", "rm_family", "month", "horizon"])
        .agg(
            gross_req_p10=("rm_req_p10", "sum"),
            gross_req_p50=("rm_req_p50", "sum"),
            gross_req_p90=("rm_req_p90", "sum"),
            n_parent_fgs=("fg_code", "nunique"),
        )
        .reset_index()
    )

    rm_requirements["uncertainty_spread"] = (
        rm_requirements["gross_req_p90"] - rm_requirements["gross_req_p10"]
    )

    return rm_requirements


def compute_inventory_policy(rm_requirements: pd.DataFrame, lead_time_days: float = 45.0,
                               service_level_z: float = 1.65) -> pd.DataFrame:
    """Derive safety stock, ROP, and max stock from BOM-exploded requirements."""
    summary = (
        rm_requirements.groupby(["rm_code", "rm_family"])
        .agg(
            avg_monthly_req_p50=("gross_req_p50", "mean"),
            avg_monthly_req_p90=("gross_req_p90", "mean"),
            req_std=("gross_req_p50", "std"),
            avg_spread=("uncertainty_spread", "mean"),
        )
        .reset_index()
    )

    lt_months = lead_time_days / 30.0
    summary["safety_stock"] = np.round(
        service_level_z * summary["req_std"].fillna(0) * np.sqrt(lt_months)
    )
    summary["reorder_point"] = np.round(
        summary["avg_monthly_req_p50"] * lt_months + summary["safety_stock"]
    )
    summary["max_stock"] = np.round(
        summary["reorder_point"] + summary["avg_monthly_req_p90"]
    )
    summary["suggested_order_qty"] = np.round(
        summary["avg_monthly_req_p90"] * lt_months
    )

    return summary


def main():
    setup_mlflow()
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    forecasts, bom = load_inputs()
    print(f"FG forecasts: {len(forecasts)} rows, {forecasts['fg_code'].nunique()} series")
    print(f"BOM: {len(bom)} entries, {bom['fg_code'].nunique()} FGs -> {bom['rm_code'].nunique()} RMs")

    rm_requirements = explode_bom(forecasts, bom)
    if rm_requirements.empty:
        print("No RM requirements generated — check BOM/forecast alignment.")
        return

    rm_req_path = GENERATED_DIR / "rm_gross_requirements.csv"
    rm_requirements.to_csv(rm_req_path, index=False)
    print(f"RM requirements: {rm_req_path} ({len(rm_requirements)} rows, "
          f"{rm_requirements['rm_code'].nunique()} RMs)")

    inventory = compute_inventory_policy(rm_requirements)
    inv_path = GENERATED_DIR / "rm_inventory_policy.csv"
    inventory.to_csv(inv_path, index=False)
    print(f"RM inventory policy: {inv_path}")

    with mlflow.start_run(run_name="bom_explosion"):
        mlflow.set_tag("pipeline", "bom_explosion")
        mlflow.log_metric("n_rm_series", int(rm_requirements["rm_code"].nunique()))
        mlflow.log_metric("total_rm_entries", len(rm_requirements))
        mlflow.log_metric("avg_gross_req_p50", float(rm_requirements["gross_req_p50"].mean()))
        mlflow.log_metric("avg_uncertainty_spread", float(rm_requirements["uncertainty_spread"].mean()))
        mlflow.log_metric("avg_safety_stock", float(inventory["safety_stock"].mean()))
        mlflow.log_metric("avg_reorder_point", float(inventory["reorder_point"].mean()))
        mlflow.log_artifact(str(rm_req_path))
        mlflow.log_artifact(str(inv_path))

    print("\nTop 10 RM by gross requirement (p50):")
    top = (
        rm_requirements.groupby("rm_code")["gross_req_p50"]
        .mean()
        .sort_values(ascending=False)
        .head(10)
    )
    for rm, val in top.items():
        print(f"  {rm}: {val:,.0f} units/month")


if __name__ == "__main__":
    main()
