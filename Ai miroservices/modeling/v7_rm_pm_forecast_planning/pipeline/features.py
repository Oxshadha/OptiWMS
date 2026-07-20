from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.io import V7Config


def classify_demand(panel: pd.DataFrame, cfg: V7Config) -> pd.DataFrame:
    if panel.empty:
        return pd.DataFrame()
    g = panel.groupby(["material_id", "material_code", "description", "material_type"], as_index=False).agg(
        total_demand=("demand_units", "sum"),
        avg_monthly_demand=("demand_units", "mean"),
        std_monthly_demand=("demand_units", "std"),
        nonzero_months=("demand_units", lambda s: int((s > 0).sum())),
        months=("month", "nunique"),
        max_monthly_demand=("demand_units", "max"),
    )
    g["std_monthly_demand"] = g["std_monthly_demand"].fillna(0.0)
    g["nonzero_rate"] = g["nonzero_months"] / g["months"].clip(lower=1)
    g["cv"] = g["std_monthly_demand"] / g["avg_monthly_demand"].replace(0, np.nan)
    g["cv"] = g["cv"].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    g = g.sort_values("total_demand", ascending=False).reset_index(drop=True)
    total = max(float(g["total_demand"].sum()), 1.0)
    g["demand_share"] = g["total_demand"] / total
    g["cumulative_share"] = g["demand_share"].cumsum()
    g["abc_class"] = np.select(
        [g["cumulative_share"] <= cfg.abc_a_cutoff, g["cumulative_share"] <= cfg.abc_b_cutoff],
        ["A", "B"],
        default="C",
    )
    g["fms_class"] = np.select(
        [g["nonzero_rate"] >= 0.80, g["nonzero_rate"] >= cfg.intermittent_nonzero_threshold],
        ["F", "M"],
        default="S",
    )
    g["intermittency_flag"] = g["nonzero_rate"] < cfg.intermittent_nonzero_threshold
    g["planning_priority"] = np.select(
        [g["abc_class"].eq("A") & g["fms_class"].isin(["F", "M"]), g["abc_class"].eq("A")],
        ["high_access_candidate", "high_value_review"],
        default="standard",
    )
    return g


def add_supervised_features(panel: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    if panel.empty:
        return pd.DataFrame(), []
    df = panel.copy()
    df["month"] = pd.to_datetime(df["month"]).dt.to_period("M").dt.to_timestamp()
    df = df.sort_values(["material_id", "month"]).reset_index(drop=True)
    df["month_num"] = df["month"].dt.month
    df["quarter"] = df["month"].dt.quarter
    df["year"] = df["month"].dt.year
    df["month_sin"] = np.sin(2 * np.pi * df["month_num"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_num"] / 12)
    df["material_type_enc"] = df["material_type"].astype("category").cat.codes
    df["material_code_enc"] = df["material_code"].astype("category").cat.codes
    group = df.groupby("material_id")["demand_units"]
    for lag in [1, 2, 3, 6, 12]:
        df[f"lag_{lag}"] = group.shift(lag)
    for window in [3, 6, 12]:
        df[f"roll_mean_{window}"] = group.transform(lambda s, w=window: s.shift(1).rolling(w, min_periods=1).mean())
        df[f"roll_std_{window}"] = group.transform(lambda s, w=window: s.shift(1).rolling(w, min_periods=2).std())
    df["target"] = group.shift(-1)
    feature_cols = [
        "month_num",
        "quarter",
        "year",
        "month_sin",
        "month_cos",
        "material_type_enc",
        "material_code_enc",
        "lag_1",
        "lag_2",
        "lag_3",
        "lag_6",
        "lag_12",
        "roll_mean_3",
        "roll_mean_6",
        "roll_mean_12",
        "roll_std_3",
        "roll_std_6",
        "roll_std_12",
    ]
    df = df.dropna(subset=["lag_12", "target"]).copy()
    df[feature_cols] = df[feature_cols].fillna(0.0)
    return df, feature_cols


def build_future_feature_row(history: list[float], material_meta: dict, future_month: pd.Timestamp) -> dict:
    values = list(history)
    def lag(n: int) -> float:
        return float(values[-n]) if len(values) >= n else 0.0
    def roll_mean(n: int) -> float:
        return float(np.mean(values[-n:])) if values else 0.0
    def roll_std(n: int) -> float:
        return float(np.std(values[-n:], ddof=1)) if len(values[-n:]) > 1 else 0.0
    month_num = int(future_month.month)
    return {
        "month_num": month_num,
        "quarter": int(future_month.quarter),
        "year": int(future_month.year),
        "month_sin": float(np.sin(2 * np.pi * month_num / 12)),
        "month_cos": float(np.cos(2 * np.pi * month_num / 12)),
        "material_type_enc": int(material_meta.get("material_type_enc", 0)),
        "material_code_enc": int(material_meta.get("material_code_enc", 0)),
        "lag_1": lag(1),
        "lag_2": lag(2),
        "lag_3": lag(3),
        "lag_6": lag(6),
        "lag_12": lag(12),
        "roll_mean_3": roll_mean(3),
        "roll_mean_6": roll_mean(6),
        "roll_mean_12": roll_mean(12),
        "roll_std_3": roll_std(3),
        "roll_std_6": roll_std(6),
        "roll_std_12": roll_std(12),
    }
