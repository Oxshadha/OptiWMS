from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from common import DATASETS, OUT_DIR


CLEAN_DIR = OUT_DIR / "cleaned"
AUDIT_DIR = OUT_DIR / "audit"

EXOG_NON_NEGATIVE_COLS = [
    "on_hand_inventory",
    "stockout_days",
    "promotion_flag",
    "lead_time_days",
    "inbound_po_qty",
    "open_sales_orders",
    "returns_qty",
    "holiday_flag",
]

EXOG_BOUNDED_COLS = {
    "supplier_otif": (0.0, 1.0),
}


@dataclass
class CleaningConfig:
    use_scenario_clean_target: bool = True
    clip_negative_demand: bool = True
    cap_outliers_for_ab: bool = False
    outlier_iqr_k: float = 3.0


def ensure_dirs() -> None:
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def load_raw_dataset(dataset: str) -> pd.DataFrame:
    cfg = DATASETS[dataset]
    path = Path(cfg["path"])
    if str(path).endswith(".csv"):
        df = pd.read_csv(path)
    else:
        df = pd.read_excel(path, sheet_name=cfg["sheet"])
    return df


def add_standard_columns(df: pd.DataFrame, dataset: str) -> pd.DataFrame:
    out = df.copy()
    out["dataset"] = dataset
    out["month"] = pd.to_datetime(out["month"])

    if "fg_name" not in out.columns:
        out["fg_name"] = ""
    if "fg_category" not in out.columns:
        out["fg_category"] = "UNKNOWN"

    if "scenario_id" not in out.columns:
        out["scenario_id"] = -1
    if "scenario_split" not in out.columns:
        out["scenario_split"] = "all"

    if "c_is_outlier" not in out.columns:
        out["c_is_outlier"] = 0

    out["demand_units_raw"] = pd.to_numeric(out["demand_units"], errors="coerce")
    if "demand_units_clean" in out.columns:
        out["demand_units_clean_source"] = pd.to_numeric(out["demand_units_clean"], errors="coerce")
    else:
        out["demand_units_clean_source"] = out["demand_units_raw"]

    if dataset == "C":
        out["series_id"] = out["scenario_id"].astype(str) + "__" + out["fg_code"].astype(str)
    else:
        out["series_id"] = out["fg_code"].astype(str)

    return out


def clip_group_iqr(series: pd.Series, k: float) -> pd.Series:
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if pd.isna(iqr) or iqr == 0:
        return series
    low = q1 - k * iqr
    high = q3 + k * iqr
    return series.clip(lower=low, upper=high)


def clean_dataset(dataset: str, config: CleaningConfig | None = None) -> pd.DataFrame:
    config = config or CleaningConfig()
    raw = load_raw_dataset(dataset)
    df = add_standard_columns(raw, dataset)

    subset = ["month", "fg_code", "scenario_id"] if dataset == "C" else ["month", "fg_code"]
    df = df.drop_duplicates(subset=subset).copy()

    if config.use_scenario_clean_target and dataset == "C":
        df["demand_units"] = df["demand_units_clean_source"]
    else:
        df["demand_units"] = df["demand_units_raw"]

    if config.clip_negative_demand:
        df["demand_units"] = df["demand_units"].clip(lower=0)

    if config.cap_outliers_for_ab and dataset in {"A", "B"}:
        df["demand_units"] = (
            df.groupby("fg_code", group_keys=False)["demand_units"]
            .apply(lambda s: clip_group_iqr(s, config.outlier_iqr_k))
        )

    for col in EXOG_NON_NEGATIVE_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").clip(lower=0)

    for col, (low, high) in EXOG_BOUNDED_COLS.items():
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").clip(lower=low, upper=high)

    keep_cols = [
        "dataset",
        "month",
        "fg_code",
        "fg_name",
        "fg_category",
        "series_id",
        "demand_units",
        "demand_units_raw",
        "demand_units_clean_source",
        "scenario_id",
        "scenario_split",
        "c_is_outlier",
        "c_outlier_low",
        "c_outlier_high",
        "on_hand_inventory",
        "stockout_days",
        "promotion_flag",
        "price_or_discount",
        "lead_time_days",
        "supplier_otif",
        "inbound_po_qty",
        "open_sales_orders",
        "returns_qty",
        "holiday_flag",
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    df = df[keep_cols].sort_values(["series_id", "month"]).reset_index(drop=True)
    return df


def build_audit_summary(df: pd.DataFrame, dataset: str) -> dict[str, Any]:
    key_cols = ["month", "fg_code", "scenario_id"] if dataset == "C" else ["month", "fg_code"]
    month_counts = (
        df.groupby("series_id")["month"].nunique().describe().to_dict()
        if "series_id" in df.columns
        else {}
    )
    summary: dict[str, Any] = {
        "dataset": dataset,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "n_series": int(df["series_id"].nunique()) if "series_id" in df.columns else None,
        "n_fg_code": int(df["fg_code"].nunique()) if "fg_code" in df.columns else None,
        "month_min": str(df["month"].min()) if "month" in df.columns else None,
        "month_max": str(df["month"].max()) if "month" in df.columns else None,
        "n_months": int(df["month"].nunique()) if "month" in df.columns else None,
        "duplicate_rows": int(df.duplicated().sum()),
        "duplicate_key_rows": int(df.duplicated(subset=key_cols).sum()),
        "null_counts_top10": {
            str(k): int(v) for k, v in df.isna().sum().sort_values(ascending=False).head(10).items()
        },
        "month_count_stats_per_series": {k: float(v) for k, v in month_counts.items()},
    }
    if "scenario_split" in df.columns:
        summary["scenario_split_counts"] = {str(k): int(v) for k, v in df["scenario_split"].value_counts().items()}
    if "scenario_id" in df.columns:
        summary["n_scenarios"] = int(df["scenario_id"].nunique())
    if "c_is_outlier" in df.columns:
        summary["c_is_outlier_rate"] = float(pd.to_numeric(df["c_is_outlier"], errors="coerce").fillna(0).mean())
    return summary


def export_clean_dataset(df: pd.DataFrame, dataset: str) -> Path:
    ensure_dirs()
    path = CLEAN_DIR / f"dataset_{dataset.lower()}_clean.csv"
    df.to_csv(path, index=False)
    return path


def export_audit_summary(summary: dict[str, Any], dataset: str) -> Path:
    ensure_dirs()
    path = AUDIT_DIR / f"dataset_{dataset.lower()}_audit_summary.json"
    path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return path


def split_summary(df: pd.DataFrame) -> pd.DataFrame:
    months = np.sort(df["month"].dropna().unique())
    val_months = 6
    test_months = 12
    train_end = pd.Timestamp(months[-(val_months + test_months + 1)])
    val_end = pd.Timestamp(months[-(test_months + 1)])

    out = df[["series_id", "month"]].drop_duplicates().copy()
    out["split"] = np.where(
        out["month"] <= train_end,
        "train",
        np.where(out["month"] <= val_end, "val", "test"),
    )
    return out


def export_split_summary(df: pd.DataFrame, dataset: str) -> Path:
    ensure_dirs()
    summary = split_summary(df)
    path = AUDIT_DIR / f"dataset_{dataset.lower()}_split_summary.csv"
    summary.to_csv(path, index=False)
    return path


def run_preprocessing_for_all(config: CleaningConfig | None = None) -> dict[str, dict[str, str]]:
    results: dict[str, dict[str, str]] = {}
    for dataset in ["A", "B", "C"]:
        cleaned = clean_dataset(dataset, config)
        audit = build_audit_summary(cleaned, dataset)
        clean_path = export_clean_dataset(cleaned, dataset)
        audit_path = export_audit_summary(audit, dataset)
        split_path = export_split_summary(cleaned, dataset)
        results[dataset] = {
            "clean_path": str(clean_path),
            "audit_path": str(audit_path),
            "split_path": str(split_path),
        }
    return results
