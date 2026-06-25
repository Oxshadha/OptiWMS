"""Feature engineering for v6 production pipeline (service-compatible column names)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# Reuse v6 shared utilities
_V6_ROOT = Path(__file__).resolve().parents[1]
if str(_V6_ROOT) not in sys.path:
    sys.path.insert(0, str(_V6_ROOT))
from forecast_utils import aggregate_fg_monthly  # noqa: E402

LAG_PERIODS = [1, 2, 3, 6, 12]
ROLL_WINDOWS = [3, 6]

# Names understood by forecast-service artifact_service._build_online_feature_row
SERVICE_FEATURE_COLS = [
    "month_num",
    "quarter",
    "year",
    "month_sin",
    "month_cos",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_6",
    "lag_12",
    "roll_mean_3",
    "roll_mean_6",
    "roll_std_3",
    "roll_std_6",
    "promotion_flag",
    "holiday_flag",
    "on_hand_inventory",
    "lead_time_days",
    "supplier_otif",
    "price_per_unit",
]


def _monthly_aggregate(fg: pd.DataFrame) -> pd.DataFrame:
    if fg.duplicated(subset=["fg_code", "month"]).any():
        return aggregate_fg_monthly(fg)
    fg = fg.copy()
    fg["month"] = pd.to_datetime(fg["month"]).dt.to_period("M").dt.to_timestamp()
    return fg.sort_values(["fg_code", "month"]).reset_index(drop=True)


def engineer_features(fg: pd.DataFrame, save_path: Path | None = None) -> tuple[pd.DataFrame, list[str], dict]:
    fg = _monthly_aggregate(fg)

    fg["month_num"] = fg["month"].dt.month
    fg["quarter"] = fg["month"].dt.quarter
    fg["year"] = fg["month"].dt.year
    fg["month_sin"] = np.sin(2 * np.pi * fg["month_num"] / 12)
    fg["month_cos"] = np.cos(2 * np.pi * fg["month_num"] / 12)

    grp = fg.groupby("fg_code")["demand_units"]
    for lag in LAG_PERIODS:
        fg[f"lag_{lag}"] = grp.shift(lag)

    for window in ROLL_WINDOWS:
        fg[f"roll_mean_{window}"] = grp.transform(
            lambda x, w=window: x.shift(1).rolling(w, min_periods=1).mean()
        )
        fg[f"roll_std_{window}"] = grp.transform(
            lambda x, w=window: x.shift(1).rolling(w, min_periods=2).std()
        )

    for col in ["promotion_flag", "holiday_flag", "on_hand_inventory", "lead_time_days", "supplier_otif", "price_per_unit"]:
        if col not in fg.columns:
            fg[col] = 0.0

    encoders: dict = {}
    if "fg_category" in fg.columns:
        le_cat = LabelEncoder()
        fg["fg_category_enc"] = le_cat.fit_transform(fg["fg_category"].astype(str))
        encoders["fg_category"] = {str(c): int(i) for i, c in enumerate(le_cat.classes_)}
    if "fg_code" in fg.columns:
        le_sku = LabelEncoder()
        fg["fg_code_enc"] = le_sku.fit_transform(fg["fg_code"].astype(str))
        encoders["fg_code"] = {str(c): int(i) for i, c in enumerate(le_sku.classes_)}

    available = [c for c in SERVICE_FEATURE_COLS if c in fg.columns]
    fg_model = fg.dropna(subset=["lag_12"]).copy()

    if save_path:
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fg_model.to_csv(save_path, index=False)

    return fg_model, available, encoders


def temporal_split(fg: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    months = sorted(fg["month"].unique())
    n = len(months)
    train_end = months[min(23, n - 7)]
    val_end = months[min(29, n - 1)]
    train_df = fg[fg["month"] <= train_end].copy()
    val_df = fg[(fg["month"] > train_end) & (fg["month"] <= val_end)].copy()
    test_df = fg[fg["month"] > val_end].copy()
    return train_df, val_df, test_df, train_end, val_end


def add_horizon_target(df: pd.DataFrame, horizon: int, target_col: str = "demand_units") -> pd.DataFrame:
    out = df.copy()
    out[f"target_h{horizon}"] = out.groupby("fg_code")[target_col].shift(-horizon)
    return out.dropna(subset=[f"target_h{horizon}"])
