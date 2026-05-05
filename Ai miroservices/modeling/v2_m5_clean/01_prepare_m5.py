#!/usr/bin/env python3
"""Step 1: Prepare M5 dataset for global model training.

Loads Walmart M5 competition data, aggregates daily sales to monthly
at the configured hierarchy level, engineers lag/rolling/calendar features,
and applies a temporal train/val/test split.

Output: ../outputs/m5_prepared/m5_monthly_panel.parquet
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml


def load_config() -> dict:
    cfg_path = Path(__file__).parent / "config.yaml"
    with cfg_path.open() as f:
        return yaml.safe_load(f)


# ── M5 Loading ────────────────────────────────────────────────────

def load_m5_sales(cfg: dict) -> pd.DataFrame:
    """Load M5 sales_train_evaluation.csv and melt to long format."""
    base = Path(__file__).parent / cfg["m5_data"]["base_dir"]
    sales_path = base / cfg["m5_data"]["sales_file"]
    print(f"[01] Loading sales from {sales_path} ...")

    sales = pd.read_csv(sales_path)
    # Columns: id, item_id, dept_id, cat_id, store_id, state_id, d_1..d_1941
    id_cols = ["id", "item_id", "dept_id", "cat_id", "store_id", "state_id"]
    day_cols = [c for c in sales.columns if c.startswith("d_")]

    long = sales.melt(id_vars=id_cols, value_vars=day_cols,
                      var_name="d", value_name="sales")
    long["day_num"] = long["d"].str.replace("d_", "").astype(int)
    print(f"[01] Loaded {len(long):,} daily records ({sales.shape[0]:,} series × {len(day_cols)} days)")
    return long


def load_m5_calendar(cfg: dict) -> pd.DataFrame:
    """Load calendar.csv and parse dates."""
    base = Path(__file__).parent / cfg["m5_data"]["base_dir"]
    cal_path = base / cfg["m5_data"]["calendar_file"]
    cal = pd.read_csv(cal_path)
    cal["date"] = pd.to_datetime(cal["date"])
    cal["d_num"] = cal["d"].str.replace("d_", "").astype(int)
    return cal


def load_m5_prices(cfg: dict) -> pd.DataFrame:
    """Load sell_prices.csv."""
    base = Path(__file__).parent / cfg["m5_data"]["base_dir"]
    prices_path = base / cfg["m5_data"]["prices_file"]
    print(f"[01] Loading prices from {prices_path} ...")
    return pd.read_csv(prices_path)


# ── Aggregation ───────────────────────────────────────────────────

def aggregate_to_monthly(long: pd.DataFrame, cal: pd.DataFrame,
                         prices: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Aggregate daily sales to monthly at the configured hierarchy level."""
    level = cfg["aggregation"]["level"]
    print(f"[01] Aggregating to monthly at '{level}' level ...")

    # Merge calendar to get dates
    merged = long.merge(cal[["d_num", "date"]], left_on="day_num", right_on="d_num", how="left")
    merged["month"] = merged["date"].dt.to_period("M")

    # Define grouping based on level
    if level == "dept_store":
        group_cols = ["dept_id", "store_id"]
        merged["series_id"] = merged["dept_id"] + "_" + merged["store_id"]
        merged["category"] = merged["dept_id"]
    elif level == "cat_store":
        group_cols = ["cat_id", "store_id"]
        merged["series_id"] = merged["cat_id"] + "_" + merged["store_id"]
        merged["category"] = merged["cat_id"]
    elif level == "item_store":
        group_cols = ["item_id", "store_id"]
        merged["series_id"] = merged["item_id"] + "_" + merged["store_id"]
        merged["category"] = merged["dept_id"]
    else:
        raise ValueError(f"Unknown aggregation level: {level}")

    # Monthly aggregation
    monthly = (
        merged.groupby(["series_id", "category", "month"], as_index=False)
        .agg(demand=("sales", "sum"))
    )

    # Add average sell_price if configured
    if cfg["features"].get("price") and level in ("dept_store", "cat_store"):
        # Compute average price per (store, wm_yr_wk) then aggregate to monthly
        merged_with_prices = merged.merge(
            cal[["d_num", "wm_yr_wk"]], left_on="day_num", right_on="d_num",
            how="left", suffixes=("", "_cal2")
        )
        price_merged = merged_with_prices.merge(
            prices, left_on=["store_id", "item_id", "wm_yr_wk"],
            right_on=["store_id", "item_id", "wm_yr_wk"], how="left"
        )
        price_monthly = (
            price_merged.groupby(["series_id", "month"], as_index=False)
            .agg(sell_price=("sell_price", "mean"))
        )
        monthly = monthly.merge(price_monthly, on=["series_id", "month"], how="left")
        monthly["sell_price"] = monthly["sell_price"].fillna(monthly["sell_price"].median())

    monthly = monthly.sort_values(["series_id", "month"]).reset_index(drop=True)
    n_series = monthly["series_id"].nunique()
    n_months = monthly["month"].nunique()
    print(f"[01] Aggregated: {n_series} series × {n_months} months = {len(monthly):,} rows")
    return monthly


# ── Feature Engineering ───────────────────────────────────────────

def engineer_features(monthly: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Add lag, rolling, and calendar features."""
    print("[01] Engineering features ...")
    feat_cfg = cfg["features"]
    frames = []

    for series_id, group in monthly.groupby("series_id"):
        g = group.sort_values("month").copy()
        demand = g["demand"].values.astype(float)

        # Lag features
        for lag in feat_cfg["lags"]:
            g[f"lag_{lag}"] = g["demand"].shift(lag)

        # Rolling mean features
        for window in feat_cfg["rolling_means"]:
            g[f"roll_mean_{window}"] = g["demand"].shift(1).rolling(window, min_periods=1).mean()

        # Rolling std features
        for window in feat_cfg["rolling_stds"]:
            g[f"roll_std_{window}"] = g["demand"].shift(1).rolling(window, min_periods=2).std().fillna(0)

        # Calendar features
        g["month_num"] = g["month"].dt.month
        g["quarter"] = g["month"].dt.quarter
        g["year"] = g["month"].dt.year
        g["month_sin"] = np.sin(2 * np.pi * g["month_num"] / 12.0)
        g["month_cos"] = np.cos(2 * np.pi * g["month_num"] / 12.0)

        frames.append(g)

    result = pd.concat(frames, ignore_index=True)

    # Drop rows where lags are NaN (need at least max_lag months of history)
    max_lag = max(feat_cfg["lags"])
    before = len(result)
    result = result.dropna(subset=[f"lag_{max_lag}"]).reset_index(drop=True)
    print(f"[01] Dropped {before - len(result)} rows with insufficient lag history")
    print(f"[01] Final panel: {len(result):,} rows, {result.shape[1]} columns")
    return result


# ── Train/Val/Test Split ──────────────────────────────────────────

def apply_split(panel: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Add split column based on temporal cutoffs."""
    split_cfg = cfg["split"]
    all_months = sorted(panel["month"].unique())
    n = len(all_months)
    test_n = split_cfg["test_months"]
    val_n = split_cfg["validation_months"]

    test_start = all_months[n - test_n]
    val_start = all_months[n - test_n - val_n]

    panel = panel.copy()
    panel["split"] = "train"
    panel.loc[panel["month"] >= val_start, "split"] = "validation"
    panel.loc[panel["month"] >= test_start, "split"] = "test"

    for s in ["train", "validation", "test"]:
        count = (panel["split"] == s).sum()
        months = panel[panel["split"] == s]["month"].nunique()
        print(f"[01] {s:>12}: {count:>8,} rows  ({months} months)")

    return panel


# ── Main ──────────────────────────────────────────────────────────

def main():
    cfg = load_config()
    out_dir = Path(__file__).parent / cfg["output"]["data_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "m5_monthly_panel.parquet"

    # Load
    sales_long = load_m5_sales(cfg)
    calendar = load_m5_calendar(cfg)
    prices = load_m5_prices(cfg)

    # Aggregate
    monthly = aggregate_to_monthly(sales_long, calendar, prices, cfg)

    # Feature engineering
    panel = engineer_features(monthly, cfg)

    # Split
    panel = apply_split(panel, cfg)

    # Convert period to string for parquet compatibility
    panel["month"] = panel["month"].astype(str)

    # Save
    panel.to_parquet(out_path, index=False)
    print(f"\n[01] ✓ Saved prepared panel to {out_path}")
    print(f"[01]   Shape: {panel.shape}")
    print(f"[01]   Series: {panel['series_id'].nunique()}")
    print(f"[01]   Columns: {list(panel.columns)}")

    # Quick sanity checks
    assert panel["demand"].isna().sum() == 0, "NaN in demand column"
    assert panel["lag_1"].isna().sum() == 0, "NaN in lag_1 after filtering"
    assert panel["split"].value_counts().get("test", 0) > 0, "No test rows"
    print("[01] ✓ All sanity checks passed")


if __name__ == "__main__":
    main()
