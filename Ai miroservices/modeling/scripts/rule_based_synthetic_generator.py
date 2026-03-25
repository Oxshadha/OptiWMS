from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from common import OUT_DIR
from real_source_extraction import REAL_OUT_DIR, extract_active_stock_canonical


GENERATED_DIR = OUT_DIR / "generated"
CANONICAL_PATH = REAL_OUT_DIR / "active_stock_canonical.csv"
DEFAULT_START = "2023-02-01"
DEFAULT_PERIODS = 36
DEFAULT_SEED = 42


@dataclass
class GenerationConfig:
    start: str = DEFAULT_START
    periods: int = DEFAULT_PERIODS
    seed: int = DEFAULT_SEED


def ensure_dirs() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def load_canonical() -> pd.DataFrame:
    if CANONICAL_PATH.exists():
        return pd.read_csv(CANONICAL_PATH)
    return extract_active_stock_canonical()


def month_stamps(start: str, periods: int) -> pd.DatetimeIndex:
    return pd.date_range(start=start, periods=periods, freq="MS")


def safe_value(value: float | int | None, fallback: float) -> float:
    if value is None or pd.isna(value):
        return float(fallback)
    return float(value)


def clamp(value: float, low: float, high: float) -> float:
    return float(min(max(value, low), high))


def round_to_pack(value: float, pack: float) -> float:
    pack = max(float(pack), 1.0)
    return float(np.ceil(max(value, 0.0) / pack) * pack)


def categorize_material(row: pd.Series) -> str:
    avg = safe_value(row.get("future_average"), 0.0)
    pallet = safe_value(row.get("pallet_requirement"), 0.0)
    if avg >= 1500 or pallet >= 15:
        return "BULK_FAST"
    if avg >= 300:
        return "CORE"
    if avg >= 50:
        return "STANDARD"
    if avg >= 5:
        return "SLOW"
    return "INTERMITTENT"


def build_season_profile(row: pd.Series) -> np.ndarray:
    plan_map = {
        7: safe_value(row.get("supply_plan_jul"), np.nan),
        8: safe_value(row.get("supply_plan_aug"), np.nan),
        9: safe_value(row.get("supply_plan_sep"), np.nan),
        10: safe_value(row.get("supply_plan_oct"), np.nan),
        11: safe_value(row.get("supply_plan_nov"), np.nan),
    }
    base = safe_value(row.get("future_average"), np.nan)
    observed = np.array([v for v in plan_map.values() if not np.isnan(v) and v > 0], dtype=float)
    if np.isnan(base) or base <= 0:
        base = float(np.mean(observed)) if observed.size else 1.0

    seasonal = np.ones(12, dtype=float)
    if observed.size:
        observed_mean = float(np.mean(observed))
        for month_num, value in plan_map.items():
            if not np.isnan(value) and value > 0:
                seasonal[month_num - 1] = clamp(value / max(observed_mean, 1e-6), 0.45, 1.85)

    # Smooth missing months with a low-amplitude sinusoid anchored to observed variation.
    if observed.size >= 2:
        amplitude = clamp(float(np.std(observed) / max(np.mean(observed), 1e-6)), 0.03, 0.22)
    else:
        amplitude = 0.08
    phase_shift = int(safe_value(row.get("material_code"), 0.0)) % 12
    for idx in range(12):
        if seasonal[idx] == 1.0:
            seasonal[idx] = 1.0 + amplitude * np.sin((idx - phase_shift) * 2 * np.pi / 12.0)

    seasonal = seasonal / seasonal.mean()
    return seasonal


def demand_regime_params(row: pd.Series) -> tuple[float, float, float]:
    avg = safe_value(row.get("future_average"), 1.0)
    variance = safe_value(row.get("demand_variance"), avg * 0.2)
    cv = clamp(np.sqrt(max(variance, 0.0)) / max(avg, 1.0), 0.05, 1.2)
    if avg < 5:
        intermittent_prob = 0.55
    elif avg < 25:
        intermittent_prob = 0.25
    else:
        intermittent_prob = 0.05
    trend_pct = clamp(
        (safe_value(row.get("supply_plan_nov"), avg) - safe_value(row.get("supply_plan_jul"), avg))
        / max(avg * 4.0, 1.0),
        -0.12,
        0.12,
    )
    return cv, intermittent_prob, trend_pct


def simulate_demand_history(row: pd.Series, months: pd.DatetimeIndex, seed: int) -> pd.DataFrame:
    material_code = int(row["material_code"])
    rng = np.random.default_rng(seed + material_code)

    fg_code = f"RM{material_code:06d}"
    fg_name = str(row["description"]).strip()
    fg_category = categorize_material(row)
    avg = max(safe_value(row.get("future_average"), 1.0), 0.1)
    seasonality = build_season_profile(row)
    cv, intermittent_prob, trend_pct = demand_regime_params(row)
    promo_rate = 0.04 if avg < 25 else 0.09 if avg < 300 else 0.14
    trend_line = np.linspace(1.0 - trend_pct, 1.0 + trend_pct, len(months))

    shock_months = set(rng.choice(len(months), size=max(1, len(months) // 18), replace=False).tolist())
    rows: list[dict[str, object]] = []
    recent_demands: list[float] = []
    rolling_inventory = max(
        safe_value(row.get("buffer_stock"), avg * 0.4) + safe_value(row.get("order_quantity"), avg * 0.7),
        avg,
    )
    max_stock_anchor = max(
        safe_value(row.get("maximum_stock"), rolling_inventory * 1.2),
        safe_value(row.get("buffer_stock"), avg * 0.8),
        avg,
    )
    rop_anchor = max(safe_value(row.get("rop_units"), avg * 0.8), avg * 0.5)
    pack_size = max(safe_value(row.get("stacking_quantity"), 0.0), safe_value(row.get("moq"), 0.0), 1.0)
    lead_time_base = clamp(safe_value(row.get("lead_time_days"), 30.0), 7.0, 150.0)
    buffer_days = clamp(safe_value(row.get("buffer_days"), 30.0), 5.0, 120.0)

    for idx, month in enumerate(months):
        seasonal = float(seasonality[month.month - 1])
        promotion_flag = int(rng.random() < promo_rate)
        holiday_flag = int(month.month in {4, 11, 12})
        promo_lift = 1.0 + (rng.uniform(0.05, 0.20) if promotion_flag else 0.0)
        holiday_lift = 1.0 + (rng.uniform(0.02, 0.08) if holiday_flag else 0.0)
        shock_multiplier = 1.0
        if idx in shock_months:
            shock_multiplier = rng.choice([rng.uniform(0.55, 0.85), rng.uniform(1.15, 1.45)])

        mean_demand = max(avg * seasonal * trend_line[idx] * promo_lift * holiday_lift * shock_multiplier, 0.05)
        noise = rng.normal(0.0, cv)
        raw_demand = mean_demand * max(0.15, 1.0 + noise)

        if rng.random() < intermittent_prob:
            raw_demand *= rng.uniform(0.0, 0.35)

        demand_units = max(int(round(raw_demand)), 0)
        recent_demands.append(float(demand_units))
        recent_window = recent_demands[-3:] if recent_demands else [avg]
        recent_mean = float(np.mean(recent_window))

        lead_time_days = clamp(lead_time_base + rng.normal(0.0, max(2.0, lead_time_base * 0.08)), 5.0, 180.0)
        supplier_otif = clamp(rng.beta(22, 2.3) - (0.08 if idx in shock_months else 0.0), 0.55, 0.995)
        price_or_discount = round(rng.uniform(0.05, 0.28), 4) if promotion_flag else round(rng.uniform(0.0, 0.03), 4)
        returns_qty = int(round(demand_units * rng.uniform(0.003, 0.025)))
        inbound_target = max(recent_mean * (lead_time_days / 30.0), safe_value(row.get("order_quantity"), avg * 0.4))
        inbound_po_qty = round_to_pack(inbound_target, pack_size)

        cover_target = max((lead_time_days + buffer_days) / 30.0, 1.0)
        target_inventory = max(recent_mean * cover_target, safe_value(row.get("buffer_stock"), avg * 0.6))
        available_before_restock = max(
            rolling_inventory
            + inbound_po_qty * supplier_otif
            - returns_qty
            + rng.normal(0.0, max(avg * 0.03, 1.0)),
            0.0,
        )
        unmet_demand = max(demand_units - available_before_restock, 0.0)
        service_pressure = demand_units / max(available_before_restock, 1.0)
        stockout_score = (
            max(service_pressure - 0.82, 0.0) * 18.0
            + max(0.84 - supplier_otif, 0.0) * 20.0
            + promotion_flag * 0.8
            + holiday_flag * 0.4
            + (1.2 if idx in shock_months else 0.0)
        )
        if stockout_score > 0.7 and rng.random() < clamp(stockout_score / 7.5, 0.08, 0.75):
            stockout_days = int(round(clamp(stockout_score + unmet_demand / max(demand_units / 30.0, 1.0), 1.0, 18.0)))
        else:
            stockout_days = 0
        rolling_inventory = max(available_before_restock - demand_units, 0.0)

        reorder_prob = 0.55 if rolling_inventory < rop_anchor else 0.18 if rolling_inventory < target_inventory else 0.05
        if rng.random() < reorder_prob:
            replenishment = inbound_po_qty * clamp(rng.normal(supplier_otif, 0.08), 0.45, 1.05)
            rolling_inventory += replenishment

        inventory_cap = max(max_stock_anchor * 1.35, target_inventory * 1.8, avg * 2.0)
        rolling_inventory = clamp(rolling_inventory, 0.0, inventory_cap)
        on_hand_inventory = max(int(round(rolling_inventory)), 0)

        open_sales_orders = int(
            round(
                max(
                    demand_units * rng.uniform(0.03, 0.18)
                    + stockout_days * recent_mean * 0.08
                    + (1.0 - supplier_otif) * demand_units * 0.5,
                    0.0,
                )
            )
        )

        rows.append(
            {
                "month": month,
                "fg_code": fg_code,
                "fg_name": fg_name,
                "fg_category": fg_category,
                "demand_units": demand_units,
                "promotion_flag": promotion_flag,
                "price_or_discount": price_or_discount,
                "holiday_flag": holiday_flag,
                "lead_time_days": round(lead_time_days, 2),
                "supplier_otif": round(supplier_otif, 4),
                "inbound_po_qty": inbound_po_qty,
                "on_hand_inventory": on_hand_inventory,
                "stockout_days": stockout_days,
                "open_sales_orders": open_sales_orders,
                "returns_qty": returns_qty,
                "source_material_code": material_code,
                "source_future_average": round(avg, 4),
                "source_moq": safe_value(row.get("moq"), 0.0),
                "source_stack_qty": safe_value(row.get("stacking_quantity"), 0.0),
                "source_buffer_days": buffer_days,
                "source_rop_units": safe_value(row.get("rop_units"), 0.0),
                "source_pallet_requirement": safe_value(row.get("pallet_requirement"), 0.0),
            }
        )

    return pd.DataFrame(rows)


def build_generated_frames(config: GenerationConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    canonical = load_canonical()
    months = month_stamps(config.start, config.periods)
    all_rows = [
        simulate_demand_history(row, months, config.seed)
        for _, row in canonical.iterrows()
    ]
    wms = pd.concat(all_rows, ignore_index=True)
    portable = wms[
        [
            "month",
            "fg_code",
            "fg_name",
            "fg_category",
            "demand_units",
        ]
    ].copy()
    return portable, wms


def build_summary(portable: pd.DataFrame, wms: pd.DataFrame) -> dict[str, object]:
    def frame_summary(df: pd.DataFrame) -> dict[str, object]:
        return {
            "rows": int(len(df)),
            "n_series": int(df["fg_code"].nunique()),
            "month_min": str(pd.to_datetime(df["month"]).min().date()),
            "month_max": str(pd.to_datetime(df["month"]).max().date()),
            "n_months": int(pd.to_datetime(df["month"]).nunique()),
            "demand_mean": float(df["demand_units"].mean()),
            "demand_median": float(df["demand_units"].median()),
            "demand_p95": float(df["demand_units"].quantile(0.95)),
            "zero_demand_rate": float((df["demand_units"] <= 0).mean()),
        }

    return {
        "portable": frame_summary(portable),
        "wms": frame_summary(wms),
        "wms_feature_ranges": {
            col: {
                "min": float(wms[col].min()),
                "max": float(wms[col].max()),
            }
            for col in [
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
        },
        "category_counts": {str(k): int(v) for k, v in wms["fg_category"].value_counts().items()},
    }


def export_outputs(portable: pd.DataFrame, wms: pd.DataFrame, summary: dict[str, object]) -> tuple[Path, Path, Path]:
    ensure_dirs()
    portable_path = GENERATED_DIR / "rule_based_portable_monthly.csv"
    wms_path = GENERATED_DIR / "rule_based_wms_monthly.csv"
    summary_path = GENERATED_DIR / "rule_based_generation_summary.json"
    portable.to_csv(portable_path, index=False)
    wms.to_csv(wms_path, index=False)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return portable_path, wms_path, summary_path


def main() -> None:
    config = GenerationConfig()
    portable, wms = build_generated_frames(config)
    summary = build_summary(portable, wms)
    portable_path, wms_path, summary_path = export_outputs(portable, wms, summary)
    print(f"Saved rule-based portable dataset: {portable_path}")
    print(f"Saved rule-based WMS dataset: {wms_path}")
    print(f"Saved rule-based generation summary: {summary_path}")


if __name__ == "__main__":
    main()
