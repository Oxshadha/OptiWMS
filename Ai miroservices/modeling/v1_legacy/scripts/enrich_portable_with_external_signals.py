#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from datetime import timezone, datetime
from pathlib import Path

import numpy as np
import pandas as pd


DEFAULT_INPUT = Path(
    "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv"
)
DEFAULT_OUTPUT = Path(
    "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/p_v2_portable_monthly.csv"
)
DEFAULT_REPORT = Path(
    "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/external_signals_enrichment_report.json"
)


@dataclass
class CategoryProfile:
    lead_time_base: float
    otif_base: float
    returns_rate: float
    promo_boost: float


CATEGORY_PROFILES: dict[str, CategoryProfile] = {
    "soap": CategoryProfile(32.0, 0.94, 0.012, 0.16),
    "shampoo": CategoryProfile(28.0, 0.95, 0.018, 0.14),
    "diaper": CategoryProfile(35.0, 0.92, 0.010, 0.12),
    "sanitary": CategoryProfile(31.0, 0.93, 0.009, 0.11),
    "detergent": CategoryProfile(33.0, 0.92, 0.011, 0.13),
}
DEFAULT_PROFILE = CategoryProfile(30.0, 0.93, 0.014, 0.10)


def _stable_u01(key: str) -> float:
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _norm_category(text: object) -> str:
    c = str(text or "").strip().lower()
    if "soap" in c:
        return "soap"
    if "shampoo" in c or "hair" in c:
        return "shampoo"
    if "diaper" in c or "baby" in c:
        return "diaper"
    if "sanitary" in c or "napkin" in c:
        return "sanitary"
    if "detergent" in c or "powder" in c or "wash" in c:
        return "detergent"
    return "default"


def _parse_month_col(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["month"] = pd.to_datetime(out["month"], errors="coerce").dt.to_period("M").dt.to_timestamp()
    out = out[out["month"].notna()].copy()
    return out


def _load_commodity_index(
    months: pd.Series,
    commodity_csv: Path | None,
    commodity_url: str | None,
    seed: int,
) -> pd.DataFrame:
    idx = pd.DataFrame({"month": pd.to_datetime(months).sort_values().unique()})
    idx["commodity_index"] = np.nan

    raw: pd.DataFrame | None = None
    if commodity_csv and commodity_csv.exists():
        raw = pd.read_csv(commodity_csv)
    elif commodity_url:
        try:
            raw = pd.read_csv(commodity_url)
        except Exception:
            raw = None

    if raw is not None and not raw.empty:
        cols = {c.lower().strip(): c for c in raw.columns}
        month_col = cols.get("month") or cols.get("date")
        value_col = cols.get("value") or cols.get("price") or cols.get("commodity_index")
        if month_col and value_col:
            temp = raw[[month_col, value_col]].copy()
            temp.columns = ["month", "value"]
            temp["month"] = pd.to_datetime(temp["month"], errors="coerce").dt.to_period("M").dt.to_timestamp()
            temp["value"] = pd.to_numeric(temp["value"], errors="coerce")
            temp = temp.dropna(subset=["month", "value"]).sort_values("month")
            if not temp.empty:
                v = temp["value"].astype(float)
                v = v / max(float(v.mean()), 1e-9)
                temp["commodity_index"] = v.clip(lower=0.7, upper=1.5)
                idx = idx.merge(temp[["month", "commodity_index"]], on="month", how="left", suffixes=("", "_src"))
                idx["commodity_index"] = idx["commodity_index_src"].combine_first(idx["commodity_index"])
                idx = idx.drop(columns=["commodity_index_src"])

    if idx["commodity_index"].isna().all():
        # Deterministic fallback index with mild seasonality + regime shifts.
        rng = np.random.default_rng(seed)
        n = len(idx)
        t = np.arange(n)
        base = 1.0 + 0.06 * np.sin(2 * np.pi * (t % 12) / 12.0) + 0.03 * np.cos(2 * np.pi * (t % 6) / 6.0)
        regime = np.ones(n)
        if n >= 18:
            cp = int(n * (0.45 + 0.1 * rng.random()))
            regime[cp:] *= float(1.0 + 0.08 * (rng.random() - 0.4))
        idx["commodity_index"] = np.clip(base * regime, 0.75, 1.4)
    else:
        idx["commodity_index"] = idx["commodity_index"].interpolate(limit_direction="both").fillna(method="bfill").fillna(method="ffill")
        idx["commodity_index"] = idx["commodity_index"].clip(lower=0.7, upper=1.5)

    return idx


def enrich(
    input_csv: Path,
    output_csv: Path,
    report_json: Path | None,
    commodity_csv: Path | None,
    commodity_url: str | None,
    seed: int,
) -> dict:
    if not input_csv.exists():
        raise FileNotFoundError(f"Input dataset not found: {input_csv}")

    df = pd.read_csv(input_csv)
    required = {"month", "fg_code", "fg_category", "demand_units"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Input dataset missing columns: {missing}")

    df = _parse_month_col(df)
    df["fg_code"] = df["fg_code"].astype(str).str.strip()
    df["fg_category"] = df["fg_category"].astype(str).str.strip()
    df["demand_units"] = pd.to_numeric(df["demand_units"], errors="coerce").fillna(0.0).clip(lower=0.0)
    df = df.sort_values(["fg_code", "month"]).reset_index(drop=True)

    month_idx = _load_commodity_index(df["month"], commodity_csv=commodity_csv, commodity_url=commodity_url, seed=seed)
    df = df.merge(month_idx, on="month", how="left")

    m = df["month"].dt.month
    q = df["month"].dt.quarter
    seasonal_peak = m.isin([4, 8, 12]).astype(int)
    holiday_month = m.isin([1, 4, 12]).astype(int)
    df["holiday_flag"] = holiday_month

    cat_key = df["fg_category"].map(_norm_category)

    promo_noise = np.array([_stable_u01(f"promo|{sku}|{mm}") for sku, mm in zip(df["fg_code"], df["month"].astype(str))])
    promo_prob = np.where(seasonal_peak > 0, 0.42, 0.12)
    promo_prob = np.where(cat_key.eq("soap"), promo_prob + 0.04, promo_prob)
    promo_prob = np.where(cat_key.eq("detergent"), promo_prob + 0.03, promo_prob)
    df["promotion_flag"] = (promo_noise < promo_prob).astype(int)

    # price_or_discount: lower value implies discount pressure, higher implies cost pressure.
    discount_factor = 1.0 - 0.06 * df["promotion_flag"]
    sku_price_noise = np.array([_stable_u01(f"price|{sku}") for sku in df["fg_code"]])
    df["price_or_discount"] = (df["commodity_index"] * discount_factor * (0.97 + 0.06 * sku_price_noise)).round(4)

    # Group-level baseline demand stats.
    grp = df.groupby("fg_code", as_index=False)["demand_units"].agg(demand_mean="mean", demand_std="std")
    grp["demand_std"] = grp["demand_std"].fillna(0.0)
    df = df.merge(grp, on="fg_code", how="left")

    lead_time_days = []
    supplier_otif = []
    returns_qty = []
    open_sales_orders = []
    inbound_po_qty = []
    stockout_days = []
    on_hand_inventory = []

    for row in df.itertuples(index=False):
        profile = CATEGORY_PROFILES.get(_norm_category(row.fg_category), DEFAULT_PROFILE)
        sku_jitter = 0.94 + 0.14 * _stable_u01(f"lead|{row.fg_code}")
        lead = profile.lead_time_base * sku_jitter * (1.0 + 0.65 * (float(row.commodity_index) - 1.0))
        lead = max(5.0, min(65.0, lead))

        otif = profile.otif_base - 0.06 * max(0.0, float(row.commodity_index) - 1.0) - 0.02 * row.promotion_flag
        otif += (_stable_u01(f"otif|{row.fg_code}|{row.month}") - 0.5) * 0.03
        otif = float(np.clip(otif, 0.75, 0.99))

        returns = max(0.0, float(row.demand_units) * (profile.returns_rate + 0.003 * row.promotion_flag))
        open_so = max(0.0, float(row.demand_units) * (0.19 + (1.0 - otif) * 0.22))
        inbound = max(0.0, float(row.demand_units) * (1.05 + 0.06 * row.promotion_flag))
        stockout = max(0.0, (lead / 30.0) * (float(row.demand_std) / max(float(row.demand_mean), 1.0)) * 8.0)
        stockout = min(24.0, stockout)
        on_hand = max(0.0, float(row.demand_mean) * (1.35 - 0.20 * row.promotion_flag) * (1.02 - stockout / 120.0))

        lead_time_days.append(int(round(lead)))
        supplier_otif.append(round(otif, 4))
        returns_qty.append(round(returns, 3))
        open_sales_orders.append(round(open_so, 3))
        inbound_po_qty.append(round(inbound, 3))
        stockout_days.append(round(stockout, 3))
        on_hand_inventory.append(round(on_hand, 3))

    df["lead_time_days"] = lead_time_days
    df["supplier_otif"] = supplier_otif
    df["returns_qty"] = returns_qty
    df["open_sales_orders"] = open_sales_orders
    df["inbound_po_qty"] = inbound_po_qty
    df["stockout_days"] = stockout_days
    df["on_hand_inventory"] = on_hand_inventory

    # Keep output shape stable for existing training scripts.
    if "fg_name" not in df.columns:
        df["fg_name"] = ""
    keep_cols = [
        "month",
        "fg_code",
        "fg_name",
        "fg_category",
        "demand_units",
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
    out = df[keep_cols].copy()
    out["month"] = pd.to_datetime(out["month"]).dt.strftime("%Y-%m-%d")

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_csv, index=False)

    report = {
        "status": "ok",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "input_csv": str(input_csv.resolve()),
        "output_csv": str(output_csv.resolve()),
        "rows": int(len(out)),
        "sku_count": int(out["fg_code"].nunique()) if not out.empty else 0,
        "month_count": int(out["month"].nunique()) if not out.empty else 0,
        "commodity_source": str(commodity_csv.resolve()) if commodity_csv and commodity_csv.exists() else (commodity_url or "deterministic_fallback"),
        "columns_added": [
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
        ],
    }

    if report_json:
        report_json.parent.mkdir(parents=True, exist_ok=True)
        report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Enrich portable monthly dataset with external/calendar signals for fair-play forecasting runs."
    )
    parser.add_argument("--input-csv", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--report-json", default=str(DEFAULT_REPORT))
    parser.add_argument("--commodity-csv", default=None, help="Optional monthly commodity index CSV with columns: month,value")
    parser.add_argument("--commodity-url", default=None, help="Optional public CSV URL for commodity index (month,value).")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    enrich(
        input_csv=Path(args.input_csv),
        output_csv=Path(args.output_csv),
        report_json=Path(args.report_json) if args.report_json else None,
        commodity_csv=Path(args.commodity_csv) if args.commodity_csv else None,
        commodity_url=args.commodity_url,
        seed=args.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

