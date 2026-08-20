from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SimulationConfig:
    seed: int = 20260711
    months: int = 72
    fg_count: int = 24
    rm_count: int = 90
    pm_count: int = 30
    start_month: str = "2020-01-01"


def _seasonal_profile(rng: np.random.Generator) -> np.ndarray:
    amplitude = rng.uniform(0.05, 0.28)
    phase = rng.uniform(0, 2 * np.pi)
    months = np.arange(12)
    profile = 1 + amplitude * np.sin(2 * np.pi * months / 12 + phase)
    return profile / profile.mean()


def generate_controlled_dataset(output_dir: Path, cfg: SimulationConfig = SimulationConfig()) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(cfg.seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    months = pd.date_range(cfg.start_month, periods=cfg.months, freq="MS")

    material_rows = []
    total_materials = cfg.rm_count + cfg.pm_count
    for idx in range(total_materials):
        material_type = "raw_material" if idx < cfg.rm_count else "packaging_material"
        code = f"RM-{idx + 1:04d}" if material_type == "raw_material" else f"PM-{idx - cfg.rm_count + 1:04d}"
        order_multiple = int(rng.choice([10, 20, 25, 50, 100, 200]))
        moq = int(order_multiple * rng.integers(2, 11))
        lead_time = int(rng.integers(5, 46))
        material_rows.append(
            {
                "material_id": idx + 1,
                "material_code": code,
                "material_type": material_type,
                "description": f"Controlled {material_type.replace('_', ' ')} {idx + 1:03d}",
                "moq": moq,
                "order_multiple": order_multiple,
                "lead_time_days": lead_time,
                "unit_cost": round(float(rng.lognormal(2.5, 0.65)), 2),
                "service_level": float(rng.choice([0.90, 0.95, 0.975, 0.99])),
                "data_quality_tier": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
            }
        )
    materials = pd.DataFrame(material_rows)

    fg_rows = []
    profiles: dict[int, np.ndarray] = {}
    for fg_id in range(1, cfg.fg_count + 1):
        profiles[fg_id] = _seasonal_profile(rng)
        fg_rows.append(
            {
                "fg_id": fg_id,
                "fg_code": f"FG-{fg_id:04d}",
                "base_monthly_units": int(rng.integers(800, 9000)),
                "trend_rate_annual": float(rng.uniform(-0.04, 0.12)),
                "volatility": float(rng.uniform(0.04, 0.18)),
            }
        )
    finished_goods = pd.DataFrame(fg_rows)

    bom_rows = []
    for fg_id in finished_goods["fg_id"]:
        rm_ids = rng.choice(np.arange(1, cfg.rm_count + 1), size=int(rng.integers(4, 9)), replace=False)
        pm_ids = rng.choice(np.arange(cfg.rm_count + 1, total_materials + 1), size=int(rng.integers(1, 4)), replace=False)
        for material_id in np.concatenate([rm_ids, pm_ids]):
            is_pm = material_id > cfg.rm_count
            quantity = rng.uniform(0.02, 0.8) if is_pm else rng.lognormal(-0.4, 0.8)
            bom_rows.append(
                {
                    "bom_version": "V1_VALIDATED_CONTROL",
                    "fg_id": int(fg_id),
                    "material_id": int(material_id),
                    "quantity_per_fg": round(float(quantity), 6),
                    "yield_rate": round(float(rng.uniform(0.94, 0.995)), 5),
                    "scrap_rate": round(float(rng.uniform(0.005, 0.06)), 5),
                    "effective_from": months.min().date().isoformat(),
                    "effective_to": None,
                    "provenance": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
                }
            )
    used_materials = {row["material_id"] for row in bom_rows}
    for material_id in sorted(set(materials["material_id"]) - used_materials):
        fg_id = int(rng.choice(finished_goods["fg_id"]))
        is_pm = material_id > cfg.rm_count
        quantity = rng.uniform(0.02, 0.8) if is_pm else rng.lognormal(-0.4, 0.8)
        bom_rows.append(
            {
                "bom_version": "V1_VALIDATED_CONTROL",
                "fg_id": fg_id,
                "material_id": int(material_id),
                "quantity_per_fg": round(float(quantity), 6),
                "yield_rate": round(float(rng.uniform(0.94, 0.995)), 5),
                "scrap_rate": round(float(rng.uniform(0.005, 0.06)), 5),
                "effective_from": months.min().date().isoformat(),
                "effective_to": None,
                "provenance": "CONTROLLED_SYNTHETIC_GROUND_TRUTH",
            }
        )
    bom = pd.DataFrame(bom_rows)

    production_rows = []
    holiday_months = {1, 4, 12}
    for fg in finished_goods.itertuples(index=False):
        previous = float(fg.base_monthly_units)
        structural_shift = float(rng.uniform(0.78, 1.30))
        shift_start = int(rng.integers(42, 58))
        for t, month in enumerate(months):
            promo = bool(rng.random() < 0.11)
            holiday = month.month in holiday_months
            trend = (1 + fg.trend_rate_annual) ** (t / 12)
            planned = fg.base_monthly_units * trend * profiles[fg.fg_id][month.month - 1]
            planned *= 1.18 if promo else 1.0
            planned *= 0.88 if holiday else 1.0
            if t >= shift_start:
                planned *= structural_shift
            planned *= float(rng.lognormal(0, fg.volatility * 0.35))
            shock = 1.0
            shock_type = "none"
            if rng.random() < 0.035:
                shock = float(rng.choice([0.45, 0.60, 1.55, 1.90]))
                shock_type = "disruption" if shock < 1 else "surge"
            actual = 0.55 * planned + 0.25 * previous + 0.20 * planned * shock
            actual *= float(rng.lognormal(0, fg.volatility))
            actual = max(0.0, actual)
            previous = actual
            production_rows.append(
                {
                    "month": month,
                    "fg_id": fg.fg_id,
                    "planned_fg_units": round(float(planned), 3),
                    "actual_fg_units": round(float(actual), 3),
                    "promotion_flag": promo,
                    "holiday_flag": holiday,
                    "shock_type": shock_type,
                    "structural_shift_active": t >= shift_start,
                }
            )
    production = pd.DataFrame(production_rows)

    exploded = production.merge(bom, on="fg_id", how="inner")
    exploded["planned_bom_requirement"] = (
        exploded["planned_fg_units"]
        * exploded["quantity_per_fg"]
        * (1 + exploded["scrap_rate"])
        / exploded["yield_rate"]
    )
    exploded["actual_bom_requirement"] = (
        exploded["actual_fg_units"]
        * exploded["quantity_per_fg"]
        * (1 + exploded["scrap_rate"])
        / exploded["yield_rate"]
    )
    material_month = exploded.groupby(["month", "material_id"], as_index=False).agg(
        planned_bom_requirement=("planned_bom_requirement", "sum"),
        actual_bom_requirement=("actual_bom_requirement", "sum"),
        promotion_flag=("promotion_flag", "max"),
        holiday_flag=("holiday_flag", "max"),
        shock_flag=("shock_type", lambda s: bool((s != "none").any())),
        active_fg_count=("fg_id", "nunique"),
    )

    full_index = pd.MultiIndex.from_product(
        [months, materials["material_id"]], names=["month", "material_id"]
    ).to_frame(index=False)
    demand = full_index.merge(material_month, on=["month", "material_id"], how="left")
    demand = demand.merge(materials, on="material_id", how="left")
    for col in ["planned_bom_requirement", "actual_bom_requirement", "active_fg_count"]:
        demand[col] = demand[col].fillna(0.0)
    for col in ["promotion_flag", "holiday_flag", "shock_flag"]:
        demand[col] = demand[col].fillna(False).astype(bool)

    base_noise = rng.normal(0, 1, len(demand))
    scale_noise = rng.normal(0, 0.08, len(demand)) * np.sqrt(demand["actual_bom_requirement"].clip(lower=1))
    adjustments = base_noise * np.maximum(1.0, 0.03 * demand["actual_bom_requirement"]) + scale_noise
    demand["demand_units"] = (demand["actual_bom_requirement"] + adjustments).clip(lower=0.0)
    inactive = demand["active_fg_count"].eq(0)
    demand.loc[inactive & (rng.random(len(demand)) < 0.92), "demand_units"] = 0.0
    demand["demand_units"] = demand["demand_units"].round(3)
    demand["source"] = "CONTROLLED_SYNTHETIC_GROUND_TRUTH"

    initial_inventory = materials[["material_id", "moq", "order_multiple", "lead_time_days", "unit_cost"]].copy()
    avg = demand.groupby("material_id")["demand_units"].mean()
    initial_inventory["initial_on_hand"] = initial_inventory["material_id"].map(avg).fillna(0) * rng.uniform(1.2, 3.5, len(initial_inventory))
    initial_inventory["initial_on_hand"] = initial_inventory["initial_on_hand"].round(2)

    tables = {
        "materials": materials,
        "finished_goods": finished_goods,
        "bom_components": bom,
        "production_plan_actuals": production,
        "material_demand": demand,
        "initial_inventory": initial_inventory,
    }
    for name, frame in tables.items():
        frame.to_csv(output_dir / f"{name}.csv", index=False)
    return tables
