from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.io import V7Config


def build_inventory_policy(
    forecasts: pd.DataFrame,
    material_inventory: pd.DataFrame,
    demand_classes: pd.DataFrame,
    cfg: V7Config,
) -> pd.DataFrame:
    if forecasts.empty:
        return pd.DataFrame()
    agg = forecasts.groupby(["material_id", "material_code", "description", "material_type"], as_index=False).agg(
        horizon_months=("horizon", "max"),
        forecast_p10_sum=("forecast_p10", "sum"),
        forecast_p50_sum=("forecast_p50", "sum"),
        forecast_p90_sum=("forecast_p90", "sum"),
        avg_monthly_p50=("forecast_p50", "mean"),
    )
    inv_cols = [
        "material_id",
        "on_hand_qty",
        "available_qty",
        "current_min_stock",
        "current_max_stock",
        "current_reorder_point",
        "inventory_lead_time_days",
        "units_per_pallet",
        "weight_kg",
        "volume_cm3",
        "storage_type",
    ]
    out = agg.merge(material_inventory[inv_cols], on="material_id", how="left")
    out = out.merge(
        demand_classes[["material_id", "abc_class", "fms_class", "intermittency_flag", "planning_priority", "nonzero_rate", "cv"]],
        on="material_id",
        how="left",
    )
    out["on_hand_qty"] = out["on_hand_qty"].fillna(0.0)
    out["available_qty"] = out["available_qty"].fillna(out["on_hand_qty"])
    out["lead_time_days"] = out["inventory_lead_time_days"].fillna(0)
    out.loc[out["lead_time_days"] <= 0, "lead_time_days"] = cfg.default_lead_time_days
    out["daily_p50"] = out["forecast_p50_sum"] / (out["horizon_months"].clip(lower=1) * 30.0)
    spread = (out["forecast_p90_sum"] - out["forecast_p10_sum"]).abs() / 2.5632
    out["daily_sigma"] = spread / (out["horizon_months"].clip(lower=1) * 30.0)
    out["lead_demand"] = out["daily_p50"] * out["lead_time_days"]
    out["safety_stock"] = cfg.service_level_z * np.sqrt((out["lead_time_days"] * np.square(out["daily_sigma"])).clip(lower=0))
    out["proposed_min_stock"] = out["safety_stock"].clip(lower=0).round(2)
    out["proposed_reorder_point"] = (out["lead_demand"] + out["proposed_min_stock"]).round(2)
    out["proposed_target_stock"] = (out["forecast_p50_sum"] + out["proposed_min_stock"]).round(2)
    out["proposed_max_stock"] = (out["forecast_p90_sum"] + out["proposed_min_stock"]).round(2)
    out["suggested_order_qty"] = (out["proposed_target_stock"] - out["available_qty"]).clip(lower=0).round(2)
    out["units_per_pallet"] = out["units_per_pallet"].replace(0, np.nan).fillna(1.0)
    out["current_pallet_positions"] = (out["on_hand_qty"] / out["units_per_pallet"]).round(2)
    out["target_pallet_positions"] = (out["proposed_max_stock"] / out["units_per_pallet"]).round(2)
    out["pallet_positions_delta"] = (out["target_pallet_positions"] - out["current_pallet_positions"]).round(2)
    out["recommendation_status"] = np.select(
        [
            out["forecast_p50_sum"].le(0),
            out["suggested_order_qty"].gt(0) & out["abc_class"].eq("A"),
            out["pallet_positions_delta"].abs().lt(0.5),
        ],
        ["DATA_INSUFFICIENT", "HIGH_RISK_REVIEW", "SAFE_TO_APPLY"],
        default="APPLY_WITH_APPROVAL",
    )
    out["rationale"] = (
        "v7 direct RM/PM forecast, ABC="
        + out["abc_class"].fillna("?")
        + ", FMS="
        + out["fms_class"].fillna("?")
        + ", horizon_p50="
        + out["forecast_p50_sum"].round(0).astype(str)
    )
    return out.sort_values(["abc_class", "suggested_order_qty"], ascending=[True, False])


def build_slotting_readiness(policy: pd.DataFrame, material_inventory: pd.DataFrame) -> pd.DataFrame:
    if policy.empty:
        return pd.DataFrame()
    out = policy.copy()
    out["accessibility_need"] = np.select(
        [
            out["abc_class"].eq("A") & out["fms_class"].eq("F"),
            out["abc_class"].eq("A") | out["fms_class"].eq("F"),
            out["abc_class"].eq("B"),
        ],
        ["highest_access", "high_access", "medium_access"],
        default="standard_access",
    )
    out["slotting_score"] = (
        out["forecast_p50_sum"].rank(pct=True).fillna(0) * 50
        + out["suggested_order_qty"].rank(pct=True).fillna(0) * 20
        + out["pallet_positions_delta"].clip(lower=0).rank(pct=True).fillna(0) * 20
        + out["nonzero_rate"].fillna(0) * 10
    ).round(2)
    out["slotting_action"] = np.select(
        [
            out["recommendation_status"].eq("DATA_INSUFFICIENT"),
            out["accessibility_need"].isin(["highest_access", "high_access"]) & out["pallet_positions_delta"].ge(0),
            out["pallet_positions_delta"].lt(-1),
        ],
        ["hold_data_review", "prefer_forward_accessible_pick_face", "release_or_downslot_excess_space"],
        default="keep_or_standard_slot",
    )
    keep = [
        "material_id",
        "material_code",
        "description",
        "material_type",
        "abc_class",
        "fms_class",
        "forecast_p50_sum",
        "suggested_order_qty",
        "current_pallet_positions",
        "target_pallet_positions",
        "pallet_positions_delta",
        "accessibility_need",
        "slotting_score",
        "slotting_action",
        "recommendation_status",
        "rationale",
    ]
    return out[keep].sort_values("slotting_score", ascending=False)
