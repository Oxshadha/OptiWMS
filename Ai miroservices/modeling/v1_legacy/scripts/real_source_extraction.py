from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

from common import DATA_DIR, OUT_DIR


REAL_SOURCE_FILE = DATA_DIR / "RM ROP and Pallet requirement  4- SEP.xlsx"
REAL_SOURCE_SHEET = "Active stock"
REAL_OUT_DIR = OUT_DIR / "real_source"


BASE_RENAME = {
    "Material Code": "material_code",
    "Description": "description",
    "Buffer days": "buffer_days",
    "future average": "future_average",
    "lead time": "lead_time_days",
    "lead time months": "lead_time_months",
    "EX": "expected_consumption",
    "variance (demand)": "demand_variance",
    "Variance lead time demand": "lead_time_demand_variance",
    "ROP": "rop_units",
    "ROP in days": "rop_days",
    "Buffer stock": "buffer_stock",
    "Maximum stock": "maximum_stock",
    "Stacking quantity": "stacking_quantity",
    "MOQ": "moq",
    "Difference": "difference",
    "Order Delivery": "order_delivery",
    "Order Quantity": "order_quantity",
    "MOQ-Order quantity ": "moq_minus_order_quantity",
    "Pallet requirement": "pallet_requirement",
    "Pallet requirement.1": "pallet_requirement_round",
}

SUPPLY_PLAN_MAP = {
    "Supply Plan": "supply_plan_jul",
    "Unnamed: 4": "supply_plan_aug",
    "Unnamed: 5": "supply_plan_sep",
    "Unnamed: 6": "supply_plan_oct",
    "Unnamed: 7": "supply_plan_nov",
}


def ensure_real_out_dir() -> None:
    REAL_OUT_DIR.mkdir(parents=True, exist_ok=True)


def _clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text


def load_active_stock_raw(path: Path = REAL_SOURCE_FILE) -> pd.DataFrame:
    return pd.read_excel(path, sheet_name=REAL_SOURCE_SHEET)


def extract_active_stock_canonical(path: Path = REAL_SOURCE_FILE) -> pd.DataFrame:
    raw = load_active_stock_raw(path)

    # The first row after the header is a sub-header row containing Jul/Aug/Sep labels.
    data = raw.iloc[1:].copy()
    data = data.rename(columns={**BASE_RENAME, **SUPPLY_PLAN_MAP})

    keep_cols = [
        "material_code",
        "description",
        "supply_plan_jul",
        "supply_plan_aug",
        "supply_plan_sep",
        "supply_plan_oct",
        "supply_plan_nov",
        "buffer_days",
        "future_average",
        "lead_time_days",
        "lead_time_months",
        "expected_consumption",
        "demand_variance",
        "lead_time_demand_variance",
        "rop_units",
        "rop_days",
        "buffer_stock",
        "maximum_stock",
        "stacking_quantity",
        "moq",
        "difference",
        "order_delivery",
        "order_quantity",
        "moq_minus_order_quantity",
        "pallet_requirement",
        "pallet_requirement_round",
    ]
    present_cols = [c for c in keep_cols if c in data.columns]
    out = data[present_cols].copy()

    if "material_code" in out.columns:
        out["material_code"] = pd.to_numeric(out["material_code"], errors="coerce").astype("Int64")
    if "description" in out.columns:
        out["description"] = out["description"].map(_clean_text)

    numeric_cols = [c for c in out.columns if c not in {"material_code", "description"}]
    for col in numeric_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out[out["material_code"].notna()].copy()
    out = out[out["description"].astype(str).str.len() > 0].copy()
    out = out.drop_duplicates(subset=["material_code"]).sort_values("material_code").reset_index(drop=True)

    out["source_file"] = path.name
    out["source_sheet"] = REAL_SOURCE_SHEET
    return out


def build_active_stock_summary(df: pd.DataFrame) -> dict[str, object]:
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    return {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "n_materials": int(df["material_code"].nunique()) if "material_code" in df.columns else None,
        "null_counts": {str(k): int(v) for k, v in df.isna().sum().items()},
        "numeric_ranges": {
            col: {
                "min": None if df[col].dropna().empty else float(df[col].min()),
                "max": None if df[col].dropna().empty else float(df[col].max()),
            }
            for col in numeric_cols
        },
    }


def export_active_stock_outputs(df: pd.DataFrame, summary: dict[str, object]) -> tuple[Path, Path]:
    ensure_real_out_dir()
    csv_path = REAL_OUT_DIR / "active_stock_canonical.csv"
    summary_path = REAL_OUT_DIR / "active_stock_summary.json"
    df.to_csv(csv_path, index=False)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return csv_path, summary_path


def main() -> None:
    df = extract_active_stock_canonical()
    summary = build_active_stock_summary(df)
    csv_path, summary_path = export_active_stock_outputs(df, summary)
    print(f"Saved canonical active stock: {csv_path}")
    print(f"Saved active stock summary: {summary_path}")


if __name__ == "__main__":
    main()
