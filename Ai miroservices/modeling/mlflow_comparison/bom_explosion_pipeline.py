"""
Two-Layer BOM Forecast Pipeline — Phase 2.4

FG demand forecast -> BOM explosion (with yield variance) -> RM gross requirements.
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
    forecast_path = GENERATED_DIR / "warehouse_quantile_forecasts.csv"
    bom_path = GENERATED_DIR / "bom_clean.csv"

    if not forecast_path.exists():
        raise FileNotFoundError(f"Run warehouse_forecast_pipeline.py first: {forecast_path}")
    if not bom_path.exists():
        raise FileNotFoundError(f"Run generate_bom_clean.py first: {bom_path}")

    forecasts = pd.read_csv(forecast_path)
    bom = pd.read_csv(bom_path)

    return forecasts, bom


def _ensure_yield_columns(bom: pd.DataFrame) -> pd.DataFrame:
    bom = bom.copy()
    if "yield_factor_mean" not in bom.columns:
        bom["yield_factor_mean"] = 0.95
    if "yield_factor_std" not in bom.columns:
        bom["yield_factor_std"] = 0.03
    return bom


def explode_bom(fg_forecasts: pd.DataFrame, bom: pd.DataFrame) -> pd.DataFrame:
    """
    Multiply FG quantile forecasts by BOM coefficients adjusted for manufacturing yield.
    RM_gross = FG_forecast * bom_coef / yield_factor
    Pessimistic p90 uses lower yield (more scrap).
    """
    fg_only = fg_forecasts[fg_forecasts["fg_code"].str.startswith("FG")].copy()
    bom = _ensure_yield_columns(bom)

    merged = fg_only.merge(bom, on="fg_code", how="inner")

    if merged.empty:
        print("WARNING: No BOM matches found. Check FG code alignment.")
        return pd.DataFrame()

    yield_mean = merged["yield_factor_mean"].clip(lower=0.85, upper=1.0)
    yield_pessimistic = (yield_mean - 1.28 * merged["yield_factor_std"].fillna(0.03)).clip(lower=0.80, upper=1.0)

    merged["rm_req_p10"] = merged["forecast_p10"] * merged["bom_coef"] / yield_mean
    merged["rm_req_p50"] = merged["forecast_p50"] * merged["bom_coef"] / yield_mean
    merged["rm_req_p90"] = merged["forecast_p90"] * merged["bom_coef"] / yield_pessimistic

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


def compute_inventory_policy(
    rm_requirements: pd.DataFrame,
    lead_time_days: float = 45.0,
    lead_time_std_days: float = 10.0,
    service_level_z: float = 1.65,
) -> pd.DataFrame:
    """RM inventory policy with combined demand + lead-time uncertainty."""
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
    lt_std_months = lead_time_std_days / 30.0

    d_bar = summary["avg_monthly_req_p50"].fillna(0)
    sigma_d = summary["req_std"].fillna(summary["avg_spread"] / (2 * 1.28)).fillna(0)

    # SS = z * sqrt(L * sigma_d^2 + d_bar^2 * sigma_L^2)
    summary["safety_stock"] = np.round(
        service_level_z
        * np.sqrt(lt_months * sigma_d**2 + d_bar**2 * lt_std_months**2)
    )
    summary["reorder_point"] = np.round(d_bar * lt_months + summary["safety_stock"])
    summary["max_stock"] = np.round(summary["reorder_point"] + summary["avg_monthly_req_p90"])
    summary["suggested_order_qty"] = np.round(summary["avg_monthly_req_p90"] * lt_months)
    summary["lead_time_days"] = lead_time_days
    summary["lead_time_std_days"] = lead_time_std_days

    return summary


def main():
    setup_mlflow()
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    forecasts, bom = load_inputs()
    print(f"FG forecasts: {len(forecasts)} rows, {forecasts['fg_code'].nunique()} series")
    print(f"BOM: {len(bom)} entries, {bom['fg_code'].nunique()} FGs -> {bom['rm_code'].nunique()} RMs")

    rm_requirements = explode_bom(forecasts, bom)
    if rm_requirements.empty:
        return

    inventory = compute_inventory_policy(rm_requirements)

    out_req = GENERATED_DIR / "rm_gross_requirements.csv"
    out_inv = GENERATED_DIR / "rm_inventory_policy.csv"
    rm_requirements.to_csv(out_req, index=False)
    inventory.to_csv(out_inv, index=False)

    with mlflow.start_run(run_name="bom_explosion_yield_adjusted"):
        mlflow.log_param("yield_adjusted", True)
        mlflow.log_param("rm_lead_time_days", 45)
        mlflow.log_param("rm_lead_time_std_days", 10)
        mlflow.log_metric("rm_codes", rm_requirements["rm_code"].nunique())
        mlflow.log_metric("total_gross_p50", rm_requirements["gross_req_p50"].sum())
        mlflow.log_metric("avg_safety_stock", inventory["safety_stock"].mean())

    print(f"RM requirements: {out_req}")
    print(f"RM inventory policy: {out_inv}")


if __name__ == "__main__":
    main()
