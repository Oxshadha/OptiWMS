from __future__ import annotations

import hashlib
import heapq
import json
import math
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.catalogs import FG_CATALOG, PM_CATALOG, RM_CATALOG, ROLE_WEIGHT


DATASET_VERSION = "PROJECT_OPERATIONAL_BASELINE_V3"
QUALITY_TIER = "GENERATED_OPERATIONAL_BASELINE"
LAYOUT_VERSION = "CMB_METRIC_AISLE_V3"
NAMESPACE = uuid.UUID("40a266a7-b186-4da8-b9f2-89e8508c294a")


@dataclass(frozen=True)
class BaselineConfig:
    seed: int = 20260715
    history_months: int = 72
    operational_months: int = 18
    fg_count: int = 16
    rm_count: int = 48
    pm_count: int = 32
    location_count: int = 600
    supplier_count: int = 16
    customer_count: int = 48
    worker_count: int = 24
    order_count: int = 5000
    order_line_count: int = 15000
    stock_movement_count: int = 30000
    task_count: int = 30000
    start_month: str = "2020-01-01"


RM_SUBTYPES = ("DRUM", "BAG", "REEL", "BOTTLE", "BOX", "BUCKET", "CAN", "IBC")
PM_SUBTYPES = (
    "CORR_BOX", "BAG", "CAP", "CARTON", "CONTAINER", "DIVIDER", "GLASS_BOTTLE",
    "INNER_LINER", "INSERT", "JAR", "NECK_TAG", "POUCH", "SACHET", "TUBE", "WRAPPER",
)
FG_FAMILIES = ("PERSONAL_CARE", "HOME_CARE", "PERSONAL_WASH", "SKIN_CARE", "ORAL_CARE")

HANDLING = {
    "DRUM": ("DRUM", 180, 62, 62, 92, 195.0),
    "BAG": ("BAG", 25, 50, 35, 15, 25.5),
    "REEL": ("ROLL", 5000, 95, 95, 55, 220.0),
    "BOTTLE": ("CARTON", 600, 48, 38, 32, 18.0),
    "BOX": ("CARTON", 200, 70, 50, 40, 15.0),
    "BUCKET": ("BUCKET", 20, 38, 38, 42, 22.0),
    "CAN": ("CARTON", 48, 55, 42, 33, 19.0),
    "IBC": ("IBC", 1000, 120, 100, 116, 1080.0),
    "CORR_BOX": ("BUNDLE", 100, 110, 90, 65, 42.0),
    "CAP": ("CARTON", 5000, 55, 45, 38, 24.0),
    "CARTON": ("BUNDLE", 250, 105, 85, 70, 48.0),
    "CONTAINER": ("CARTON", 1200, 75, 55, 50, 35.0),
    "DIVIDER": ("BUNDLE", 500, 90, 70, 45, 30.0),
    "GLASS_BOTTLE": ("PALLET", 800, 120, 100, 125, 720.0),
    "INNER_LINER": ("ROLL", 5000, 90, 90, 60, 180.0),
    "INSERT": ("CARTON", 5000, 60, 45, 35, 28.0),
    "JAR": ("CARTON", 1000, 72, 52, 48, 32.0),
    "NECK_TAG": ("CARTON", 8000, 60, 45, 35, 22.0),
    "POUCH": ("CARTON", 4000, 70, 50, 40, 35.0),
    "SACHET": ("CARTON", 10000, 70, 50, 40, 32.0),
    "TUBE": ("CARTON", 1200, 70, 50, 45, 30.0),
    "WRAPPER": ("ROLL", 5000, 100, 100, 70, 250.0),
}


def stable_uuid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{DATASET_VERSION}:{kind}:{key}"))


def _write(frame: pd.DataFrame, output: Path, name: str) -> Path:
    path = output / f"{name}.csv.gz"
    frame.to_csv(path, index=False, compression={"method": "gzip", "mtime": 0})
    return path


def _seasonality(rng: np.random.Generator) -> np.ndarray:
    month = np.arange(12)
    amplitude = rng.uniform(0.05, 0.30)
    phase = rng.uniform(0, 2 * np.pi)
    profile = 1 + amplitude * np.sin((2 * np.pi * month / 12) + phase)
    profile *= np.where(np.isin(month + 1, [4, 12]), rng.uniform(1.02, 1.18), 1.0)
    return profile / profile.mean()


def _material_master(cfg: BaselineConfig, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    if cfg.rm_count > len(RM_CATALOG) or cfg.pm_count > len(PM_CATALOG) or cfg.fg_count > len(FG_CATALOG):
        raise ValueError("Requested baseline scale exceeds the curated operational catalog")
    rows: list[dict] = []
    material_id = 0
    specs = (
        ("raw_material", RM_CATALOG[:cfg.rm_count], "RM"),
        ("packaging_material", PM_CATALOG[:cfg.pm_count], "PM"),
    )
    for material_type, catalog, prefix in specs:
        for index, catalog_item in enumerate(catalog, start=1):
            material_id += 1
            if material_type == "raw_material":
                source_code, description, subtype, formula_role, recipe_groups = catalog_item
                target_fg_indexes = ()
            else:
                source_code, description, subtype, formula_role, target_fg_indexes = catalog_item
                recipe_groups = ()
            hu, units, length, width, height, hu_weight = HANDLING[subtype]
            if material_type == "packaging_material" and subtype == "BAG":
                units, hu_weight = 2500, 32.0
            units = max(1, int(round(units * rng.lognormal(0, 0.12))))
            default_pallet_factor = {"DRUM": 4, "BAG": 40, "ROLL": 1, "BUCKET": 24, "IBC": 1, "PALLET": 1, "CARTON": 30, "BUNDLE": 20}.get(hu, 1)
            handling_unit_volume = length * width * height
            pallet_factor = max(1, min(
                default_pallet_factor,
                max(1, int(1_500_000 // handling_unit_volume)),
                max(1, int(1_200 // hu_weight)),
            ))
            units_per_pallet = units * pallet_factor
            pallet_weight = hu_weight * pallet_factor
            multiple = units
            moq = multiple * int(rng.integers(1, 7))
            unit_weight = hu_weight / units
            volume_cm3 = length * width * height / units
            code = f"{prefix}-{index:04d}"
            hazardous = material_type == "raw_material" and formula_role in {"ALKALI", "SOLVENT"}
            temperature = material_type == "raw_material" and formula_role in {"OIL", "BOTANICAL"}
            rows.append({
                "material_id": stable_uuid("material", code), "material_code": code,
                "description": description, "source_item_code": source_code,
                "source_record_type": "SUPPLIED_ITEM_MASTER" if source_code.isdigit() else "GENERATED_PACK_SPEC",
                "material_type": material_type, "category": subtype, "unit_type": "KG" if prefix == "RM" else "EA",
                "formula_role": formula_role, "recipe_groups": "|".join(recipe_groups),
                "target_fg_indexes": "|".join(str(value) for value in target_fg_indexes),
                "storage_type": hu, "handling_unit_type": hu, "units_per_handling_unit": units,
                "order_multiple": multiple, "min_order_quantity": moq,
                "lead_time_days": int(rng.integers(5, 46)), "unit_cost": round(float(rng.lognormal(2.8, 0.9)), 2),
                "length_cm": length, "width_cm": width, "height_cm": height,
                # PostgreSQL stores material weight at scale=2; keep lightweight PM units positive after persistence.
                "weight_kg": max(0.01, round(unit_weight, 4)), "volume_cm3": round(volume_cm3, 2),
                "handling_units_per_pallet": pallet_factor,
                "units_per_pallet": units_per_pallet, "pallet_spaces": 1,
                "max_pallet_weight_kg": round(pallet_weight, 2), "stackable": not hazardous,
                "max_stack_height": 1 if hazardous else int(rng.integers(2, 5)),
                "temperature_controlled": temperature, "hazardous": hazardous,
                "fragile": subtype in {"BOTTLE", "GLASS_BOTTLE"},
                "shelf_life_days": int(rng.choice([365, 540, 730, 1095])),
                "data_quality_tier": QUALITY_TIER,
            })
    materials = pd.DataFrame(rows)

    fg_rows = []
    for index, (description, family, fill_weight_kg, units_per_carton) in enumerate(FG_CATALOG[:cfg.fg_count], start=1):
        code = f"FG-{index:04d}"
        units_per_pallet = units_per_carton * int(rng.choice([32, 40, 48]))
        pallet_weight = min(1180.0, units_per_pallet * fill_weight_kg * 1.18)
        fg_rows.append({
            "material_id": stable_uuid("material", code), "fg_id": stable_uuid("fg", code), "material_code": code,
            "description": description, "source_item_code": f"FORMULA-{index:03d}",
            "source_record_type": "GENERATED_PRODUCT_FORMULA", "material_type": "product",
            "category": family, "recipe_group": family, "fill_weight_kg": fill_weight_kg, "unit_type": "EA",
            "storage_type": "PALLET", "handling_unit_type": "CARTON",
            "units_per_handling_unit": units_per_carton, "order_multiple": 1,
            "min_order_quantity": 1, "lead_time_days": 1, "unit_cost": round(float(rng.lognormal(3.5, 0.5)), 2),
            "length_cm": 40, "width_cm": 30, "height_cm": 25,
            "weight_kg": round(fill_weight_kg * 1.18, 4),
            "volume_cm3": round((40 * 30 * 25) / units_per_carton, 2),
            "handling_units_per_pallet": units_per_pallet // units_per_carton,
            "units_per_pallet": units_per_pallet, "pallet_spaces": 1,
            "max_pallet_weight_kg": round(pallet_weight, 2),
            "stackable": True, "max_stack_height": 4, "temperature_controlled": False,
            "hazardous": False, "fragile": False, "shelf_life_days": 730,
            "base_monthly_units": int(rng.integers(100, 2000)), "trend_rate_annual": rng.uniform(-0.04, 0.12),
            "volatility": rng.uniform(0.05, 0.20), "data_quality_tier": QUALITY_TIER,
        })
    return materials, pd.DataFrame(fg_rows)


def _bom(materials: pd.DataFrame, fg: pd.DataFrame, cfg: BaselineConfig, rng: np.random.Generator) -> pd.DataFrame:
    rm = materials[materials.material_type.eq("raw_material")]
    pm = materials[materials.material_type.eq("packaging_material")]
    rows: list[dict] = []
    parents = list(fg.itertuples(index=False))
    assigned_rm: dict[str, set[str]] = {parent.material_code: set() for parent in parents}
    product_roles = {
        1: {"ALKALI", "SURFACTANT", "OIL", "EMOLLIENT", "HUMECTANT", "FRAGRANCE", "COLORANT", "ACTIVE"},
        2: {"ALKALI", "SURFACTANT", "OIL", "EMOLLIENT", "HUMECTANT", "FRAGRANCE", "COLORANT", "ACTIVE"},
        3: {"ALKALI", "SURFACTANT", "OIL", "EMOLLIENT", "HUMECTANT", "FRAGRANCE", "COLORANT", "ACTIVE"},
        4: {"SURFACTANT", "HUMECTANT", "THICKENER", "PRESERVATIVE", "PH_ADJUSTER", "FRAGRANCE", "CHELATOR", "BOTANICAL", "ACTIVE", "SOLUBILIZER", "SOLVENT"},
        5: {"SURFACTANT", "HUMECTANT", "THICKENER", "PRESERVATIVE", "PH_ADJUSTER", "FRAGRANCE", "CHELATOR", "BOTANICAL", "ACTIVE", "SOLUBILIZER", "SOLVENT"},
        6: {"SURFACTANT", "HUMECTANT", "THICKENER", "PRESERVATIVE", "PH_ADJUSTER", "FRAGRANCE", "CHELATOR", "BOTANICAL", "ACTIVE", "SOLUBILIZER", "SOLVENT"},
        7: {"SURFACTANT", "HUMECTANT", "THICKENER", "PRESERVATIVE", "PH_ADJUSTER", "CHELATOR", "OIL", "FRAGRANCE"},
        8: {"EMOLLIENT", "HUMECTANT", "OIL", "PRESERVATIVE", "PH_ADJUSTER", "THICKENER", "ACTIVE", "FRAGRANCE"},
        9: {"OIL", "EMOLLIENT", "ACTIVE", "FRAGRANCE", "PRESERVATIVE"},
        10: {"HUMECTANT", "EMOLLIENT", "OIL", "PRESERVATIVE", "ACTIVE", "THICKENER", "SOLUBILIZER", "BOTANICAL", "COLORANT", "FILLER"},
        11: {"HUMECTANT", "EMOLLIENT", "OIL", "PRESERVATIVE", "ACTIVE", "THICKENER", "SOLUBILIZER", "BOTANICAL", "COLORANT", "FILLER"},
        12: {"HUMECTANT", "EMOLLIENT", "OIL", "PRESERVATIVE", "ACTIVE", "THICKENER", "SOLUBILIZER", "BOTANICAL", "COLORANT", "FILLER"},
        13: {"FILLER", "HUMECTANT", "THICKENER", "ACTIVE", "PRESERVATIVE", "FRAGRANCE", "SURFACTANT"},
        14: {"FILLER", "HUMECTANT", "THICKENER", "ACTIVE", "PRESERVATIVE", "FRAGRANCE", "SURFACTANT"},
        15: {"SURFACTANT", "BUILDER", "CHELATOR", "PH_ADJUSTER", "FRAGRANCE", "THICKENER", "PRESERVATIVE", "SOLVENT"},
        16: {"SURFACTANT", "BUILDER", "CHELATOR", "PH_ADJUSTER", "FRAGRANCE", "THICKENER", "PRESERVATIVE", "SOLVENT"},
    }

    for component_index, component in enumerate(rm.itertuples(index=False)):
        compatible = [
            parent for parent in parents
            if parent.recipe_group in component.recipe_groups.split("|")
            and component.formula_role in product_roles[int(parent.material_code.split("-")[-1])]
        ]
        if not compatible:
            # Reduced test profiles may omit an entire recipe family. Canonical V3 includes all families.
            compatible = parents
        owner = compatible[component_index % len(compatible)]
        assigned_rm[owner.material_code].add(component.material_id)

    for parent in parents:
        parent_index = int(parent.material_code.split("-")[-1])
        eligible = rm[rm.recipe_groups.str.split("|").apply(lambda groups: parent.recipe_group in groups)]
        eligible = eligible[eligible.formula_role.isin(product_roles[parent_index])]
        for role in product_roles[parent_index]:
            matching = eligible[eligible.formula_role.eq(role)]
            if not matching.empty:
                assigned_rm[parent.material_code].add(matching.iloc[(int(parent.material_code[-2:]) - 1) % len(matching)].material_id)

        selected_rm = rm[rm.material_id.isin(assigned_rm[parent.material_code])]
        recipe_weights = selected_rm.formula_role.map(ROLE_WEIGHT).fillna(0.01)
        recipe_total = float(recipe_weights.sum())
        for component, role_weight in zip(selected_rm.itertuples(index=False), recipe_weights):
            qty = parent.fill_weight_kg * 0.96 * float(role_weight) / recipe_total
            rows.append({
                "bom_id": stable_uuid("bom", f"{parent.material_code}:V1"), "bom_version": "V1",
                "parent_material_id": parent.material_id, "parent_code": parent.material_code,
                "component_material_id": component.material_id, "component_code": component.material_code,
                "component_type": component.material_type, "quantity_per_fg": round(float(qty), 6),
                "yield_rate": round(float(rng.uniform(0.975, 0.995)), 5),
                "scrap_rate": round(float(rng.uniform(0.005, 0.025)), 5),
                "uom": component.unit_type, "effective_from": cfg.start_month, "effective_to": "",
            })

        selected_pm = pm[pm.target_fg_indexes.str.split("|").apply(lambda values: str(parent_index) in values)]
        for component in selected_pm.itertuples(index=False):
            qty = 1.0
            if component.formula_role in {"SHIPPER", "TRANSIT_LINER", "TRANSIT_SEAL"}:
                qty = 1.0 / parent.units_per_handling_unit
            elif component.formula_role == "CODING":
                qty = 1.0 / 5000.0
            rows.append({
                "bom_id": stable_uuid("bom", f"{parent.material_code}:V1"), "bom_version": "V1",
                "parent_material_id": parent.material_id, "parent_code": parent.material_code,
                "component_material_id": component.material_id, "component_code": component.material_code,
                "component_type": component.material_type, "quantity_per_fg": round(qty, 6),
                "yield_rate": 0.995, "scrap_rate": 0.005, "uom": component.unit_type,
                "effective_from": cfg.start_month, "effective_to": "",
            })
    used_component_ids = {row["component_material_id"] for row in rows}
    for component_index, component in enumerate(materials[~materials.material_id.isin(used_component_ids)].itertuples(index=False)):
        parent = parents[component_index % len(parents)]
        qty = 1.0 / parent.units_per_handling_unit if component.material_type == "packaging_material" else 0.001
        rows.append({
            "bom_id": stable_uuid("bom", f"{parent.material_code}:V1"), "bom_version": "V1",
            "parent_material_id": parent.material_id, "parent_code": parent.material_code,
            "component_material_id": component.material_id, "component_code": component.material_code,
            "component_type": component.material_type, "quantity_per_fg": round(qty, 6),
            "yield_rate": 0.995, "scrap_rate": 0.005, "uom": component.unit_type,
            "effective_from": cfg.start_month, "effective_to": "",
        })
    return pd.DataFrame(rows).drop_duplicates(["parent_material_id", "component_material_id"])


def _demand(materials: pd.DataFrame, fg: pd.DataFrame, bom: pd.DataFrame, cfg: BaselineConfig, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    months = pd.date_range(cfg.start_month, periods=cfg.history_months, freq="MS")
    production_rows = []
    for parent in fg.itertuples(index=False):
        seasonal = _seasonality(rng)
        previous = float(parent.base_monthly_units)
        shift_month = int(rng.integers(30, 60))
        shift_factor = rng.uniform(0.75, 1.35)
        for offset, month in enumerate(months):
            promotion = rng.random() < 0.11
            shutdown = rng.random() < 0.025
            supplier_disruption = rng.random() < 0.035
            market_shock = rng.choice([0.55, 0.72, 1.0, 1.0, 1.0, 1.35, 1.65]) if rng.random() < 0.08 else 1.0
            level = parent.base_monthly_units * ((1 + parent.trend_rate_annual) ** (offset / 12))
            planned = level * seasonal[month.month - 1] * (1.18 if promotion else 1.0)
            planned *= 0.25 if shutdown else 1.0
            planned *= shift_factor if offset >= shift_month else 1.0
            actual = 0.58 * planned + 0.27 * previous + 0.15 * planned * market_shock
            actual *= rng.lognormal(0, parent.volatility)
            if supplier_disruption:
                actual *= rng.uniform(0.55, 0.88)
            actual = max(0.0, actual)
            previous = actual
            production_rows.append({
                "month": month.date().isoformat(), "parent_material_id": parent.material_id,
                "parent_code": parent.material_code, "planned_fg_units": round(planned, 3),
                "actual_fg_units": round(actual, 3), "promotion_flag": promotion,
                "shutdown_flag": shutdown, "supplier_disruption_flag": supplier_disruption,
                "market_shock_factor": float(market_shock), "structural_shift_active": offset >= shift_month,
            })
    production = pd.DataFrame(production_rows)
    exploded = production.merge(bom, on="parent_material_id", how="inner")
    factor = exploded.quantity_per_fg * (1 + exploded.scrap_rate) / exploded.yield_rate
    exploded["planned_bom_requirement"] = exploded.planned_fg_units * factor
    exploded["actual_bom_requirement"] = exploded.actual_fg_units * factor
    grouped = exploded.groupby(["month", "component_material_id"], as_index=False).agg(
        planned_bom_requirement=("planned_bom_requirement", "sum"),
        actual_bom_requirement=("actual_bom_requirement", "sum"), promotion_flag=("promotion_flag", "max"),
        shutdown_flag=("shutdown_flag", "max"), supplier_disruption_flag=("supplier_disruption_flag", "max"),
        active_fg_count=("parent_material_id", "nunique"),
    ).rename(columns={"component_material_id": "material_id"})
    full = pd.MultiIndex.from_product([months.date.astype(str), materials.material_id], names=["month", "material_id"]).to_frame(index=False)
    demand = full.merge(grouped, on=["month", "material_id"], how="left").merge(
        materials[["material_id", "material_code", "material_type", "category", "lead_time_days"]], on="material_id", how="left"
    )
    numeric = ["planned_bom_requirement", "actual_bom_requirement", "active_fg_count"]
    demand[numeric] = demand[numeric].fillna(0)
    for flag in ["promotion_flag", "shutdown_flag", "supplier_disruption_flag"]:
        demand[flag] = demand[flag].fillna(False).astype(bool)
    latent = rng.normal(0, 1, len(demand))
    scale = np.sqrt(demand.actual_bom_requirement.clip(lower=1)) * rng.uniform(0.8, 1.4, len(demand))
    demand["demand_units"] = (demand.actual_bom_requirement + latent * scale).clip(lower=0)
    intermittent = demand.active_fg_count.eq(0) | ((demand.material_type.eq("packaging_material")) & (rng.random(len(demand)) < 0.03))
    demand.loc[intermittent & (rng.random(len(demand)) < 0.75), "demand_units"] = 0
    demand["demand_units"] = demand.demand_units.round(3)
    demand["source"] = DATASET_VERSION
    return production, demand


def _natural_breaks(values: np.ndarray) -> tuple[float, float]:
    positive = np.sort(values[values > 0].astype(float))
    if len(positive) < 9:
        return tuple(np.quantile(positive, [1 / 3, 2 / 3])) if len(positive) else (0.0, 0.0)
    logged = np.log1p(positive)
    centers = np.quantile(logged, [0.2, 0.55, 0.85])
    for _ in range(50):
        labels = np.argmin(np.abs(logged[:, None] - centers[None, :]), axis=1)
        updated = np.array([logged[labels == i].mean() if np.any(labels == i) else centers[i] for i in range(3)])
        if np.allclose(updated, centers):
            break
        centers = updated
    centers.sort()
    return float(np.expm1((centers[0] + centers[1]) / 2)), float(np.expm1((centers[1] + centers[2]) / 2))


def _classifications(demand: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    recent_months = sorted(demand.month.unique())[-12:]
    recent = demand[demand.month.isin(recent_months)].copy()
    summary = recent.groupby(["material_id", "material_code", "material_type", "category"], as_index=False).agg(
        issue_volume_12m=("demand_units", "sum"), issue_count_12m=("demand_units", lambda s: int((s > 0).sum()))
    )
    threshold_rows = []
    classified = []
    for (material_type, category), group in summary.groupby(["material_type", "category"], sort=True):
        group = group.sort_values(["issue_volume_12m", "material_code"], ascending=[False, True]).copy()
        total = group.issue_volume_12m.sum()
        group["cumulative_usage_share"] = group.issue_volume_12m.cumsum() / total if total else 1.0
        group["abc_class"] = np.select(
            [group.cumulative_usage_share.le(0.80), group.cumulative_usage_share.le(0.95)], ["A", "B"], default="C"
        )
        slow_cut, fast_cut = _natural_breaks(group.issue_count_12m.to_numpy())
        group["fms_class"] = np.select(
            [group.issue_count_12m.eq(0), group.issue_count_12m.ge(fast_cut), group.issue_count_12m.ge(slow_cut)],
            ["N", "F", "M"], default="S",
        )
        group["amalgamated_class"] = group.abc_class + group.fms_class
        group["observation_start"] = recent_months[0]
        group["observation_end"] = recent_months[-1]
        classified.append(group)
        threshold_rows.append({
            "material_type": material_type, "category": category, "abc_a_cumulative_max": 0.80,
            "abc_b_cumulative_max": 0.95, "fms_slow_upper": round(slow_cut, 4),
            "fms_fast_lower": round(fast_cut, 4), "method": "ABC_CUMULATIVE_USAGE_AND_1D_NATURAL_BREAKS",
            "observation_start": recent_months[0], "observation_end": recent_months[-1], "source_rows": len(group),
        })
    return pd.concat(classified, ignore_index=True), pd.DataFrame(threshold_rows)


def _policy(materials: pd.DataFrame, demand: pd.DataFrame, classes: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    for material in materials.itertuples(index=False):
        series = demand[demand.material_id.eq(material.material_id)].sort_values("month").demand_units.to_numpy()
        recent = series[-24:] if len(series) >= 24 else series
        monthly_mean = float(np.mean(recent))
        residuals = recent[1:] - recent[:-1] if len(recent) > 1 else np.array([0.0])
        lead_months = max(material.lead_time_days / 30.0, 1 / 30)
        class_row = classes[classes.material_id.eq(material.material_id)].iloc[0]
        amalgamated = class_row.amalgamated_class
        if amalgamated in {"AF", "AM", "BF"}:
            service = 0.98
        elif class_row.abc_class == "A":
            service = 0.97
        elif class_row.abc_class == "B":
            service = 0.95
        else:
            service = 0.92
        samples = []
        for _ in range(1000):
            base = rng.choice(recent, size=max(1, int(math.ceil(lead_months))), replace=True).sum() * min(1.0, lead_months)
            error = rng.choice(residuals, replace=True) * math.sqrt(lead_months)
            samples.append(max(0.0, base + error))
        rop = float(np.quantile(samples, service))
        cycle = monthly_mean * max(1.0, math.sqrt(max(material.min_order_quantity, 1) / max(monthly_mean, 1)))
        order_qty = max(material.min_order_quantity, math.ceil(cycle / material.order_multiple) * material.order_multiple)
        maximum = rop + order_qty
        current_on_hand = monthly_mean * rng.uniform(0.8, 3.0)
        expected_shortage = float(np.mean(np.maximum(np.asarray(samples) - rop, 0)))
        holding_cost = maximum / 2 * material.unit_cost * 0.18
        shortage_cost = expected_shortage * material.unit_cost * 3.0
        proposed_cost = holding_cost + shortage_cost
        current_cost = proposed_cost * rng.uniform(1.08, 1.32)
        rows.append({
            "material_id": material.material_id, "material_code": material.material_code,
            "abc_class": class_row.abc_class, "fms_class": class_row.fms_class,
            "amalgamated_class": amalgamated, "target_service_level": service,
            "current_on_hand": round(current_on_hand, 2), "reorder_point": round(rop, 2),
            "min_stock": round(rop, 2), "max_stock": round(maximum, 2),
            "order_quantity": round(order_qty, 2), "safety_stock": round(max(0, rop - monthly_mean * lead_months), 2),
            "expected_holding_cost": round(holding_cost, 2), "expected_shortage_cost": round(shortage_cost, 2),
            "current_expected_total_cost": round(current_cost, 2),
            "proposed_expected_total_cost": round(proposed_cost, 2),
            "expected_cost_delta": round(proposed_cost - current_cost, 2),
            "simulated_fill_rate": round(min(0.999, service + rng.uniform(0.001, 0.012)), 5),
            "stockout_days_current": int(rng.integers(3, 25)),
            "stockout_days_proposed": int(rng.integers(0, 3)),
            "capacity_feasible": True,
            "units_per_handling_unit": material.units_per_handling_unit,
            "required_handling_units": int(math.ceil(maximum / material.units_per_handling_unit)),
            "required_pallet_positions": int(math.ceil(maximum / material.units_per_pallet)),
            "policy_method": "EMPIRICAL_LEAD_TIME_DEMAND_S_S",
        })
    return pd.DataFrame(rows)


def _inventory(
    materials: pd.DataFrame, finished_goods: pd.DataFrame, policy: pd.DataFrame, classes: pd.DataFrame,
    locations: pd.DataFrame, warehouse_id: str, rng: np.random.Generator,
    fg_rng: np.random.Generator,
) -> pd.DataFrame:
    storage_pool = locations[locations.zone_type.isin(["PICK_FACE", "RESERVE"])].copy()
    class_map = classes.set_index("material_id")
    material_map = materials.set_index("material_id")
    used_locations: set[str] = set()
    class_rank = {"A": 0, "B": 1, "C": 2, "F": 0, "M": 1, "S": 2}

    def allocate_positions(count: int, material: pd.Series, desired_class: str) -> list[pd.Series]:
        assigned: list[pd.Series] = []
        for position_index in range(count):
            candidates = storage_pool[~storage_pool.location_code.isin(used_locations)].copy()
            if bool(material.hazardous):
                candidates = candidates[candidates.hazard_allowed]
            else:
                candidates = candidates[~candidates.hazard_allowed]
            if bool(material.temperature_controlled):
                candidates = candidates[candidates.temperature_zone.eq("CONTROLLED")]
            else:
                candidates = candidates[candidates.temperature_zone.eq("AMBIENT")]
            candidates = candidates[
                candidates.max_weight_kg.ge(float(material.max_pallet_weight_kg))
                & candidates.max_volume_cm3.ge(float(material.volume_cm3 * material.units_per_pallet))
            ]
            if candidates.empty:
                raise RuntimeError(f"No compatible location remains for {material.material_code}")
            candidates["class_penalty"] = candidates.physical_class.map(
                lambda value: abs(class_rank[value[0]] - class_rank[desired_class[0]])
                + abs(class_rank[value[1]] - class_rank[desired_class[1]])
            )
            desired_zone = "PICK_FACE" if position_index == 0 else "RESERVE"
            candidates["role_penalty"] = candidates.zone_type.ne(desired_zone).astype(int) * 4
            candidates["score"] = (
                candidates.class_penalty * 20
                + candidates.role_penalty
                + candidates.travel_distance_m
                + candidates.level_number * (3 if desired_class.endswith("F") else 1)
            )
            location = candidates.sort_values(["score", "location_code"]).iloc[0]
            used_locations.add(location.location_code)
            assigned.append(location)
        return assigned

    rows = []
    class_priority = {"AF": 1, "AM": 2, "AS": 3, "BF": 4, "BM": 5, "BS": 6, "CF": 7, "CM": 8, "CS": 9}
    ordered_policy = policy.copy()
    ordered_policy["slotting_priority"] = (
        ordered_policy.abc_class.astype(str) + ordered_policy.fms_class.astype(str)
    ).map(class_priority).fillna(99)
    for item in ordered_policy.sort_values(["slotting_priority", "material_code"]).itertuples(index=False):
        material = material_map.loc[item.material_id]
        current_positions = max(1, int(math.ceil(item.current_on_hand / max(material.units_per_pallet, 1))))
        assigned_locations = allocate_positions(current_positions, material, item.amalgamated_class)
        remaining = int(round(item.current_on_hand))
        per_position = max(1, int(math.ceil(remaining / current_positions)))
        for position, location in enumerate(assigned_locations):
            quantity = remaining if position == current_positions - 1 else min(remaining, per_position)
            remaining -= quantity
            batch = f"B-{item.material_code}-{position + 1:03d}"
            expiry = pd.Timestamp("2026-06-30") + pd.Timedelta(days=int(material.shelf_life_days * rng.uniform(0.35, 0.95)))
            current_factor = float(rng.uniform(0.78, 1.30))
            rows.append({
                "inventory_id": stable_uuid("inventory", f"{item.material_code}:{location.location_code}:{batch}"),
                "material_id": item.material_id, "material_code": item.material_code,
                "material_type": material.material_type,
                "warehouse_id": warehouse_id, "location_code": location.location_code,
                "batch_number": batch, "expiry_date": expiry.date().isoformat(),
                "quantity": max(0, quantity), "available_quantity": max(0, quantity), "reserved_quantity": 0,
                "buffer_stock": round(item.safety_stock * current_factor, 2),
                "min_stock": round(item.min_stock * current_factor, 2),
                "max_stock": round(item.max_stock * current_factor, 2),
                "reorder_point": round(item.reorder_point * current_factor, 2), "moq": material.min_order_quantity,
                "lead_time_days": material.lead_time_days, "order_quantity": item.order_quantity,
                "pallet_requirement": item.required_pallet_positions, "status": "active",
                "stacking_quantity": int(material.max_stack_height),
                "abc_class": class_map.loc[item.material_id].abc_class,
                "fms_class": class_map.loc[item.material_id].fms_class,
            })

    fg_usage = finished_goods.sort_values("base_monthly_units", ascending=False).copy()
    annual_total = float((fg_usage.base_monthly_units * 12).sum())
    fg_usage["cumulative_share"] = (fg_usage.base_monthly_units * 12).cumsum() / annual_total
    fg_usage["abc_class"] = np.where(
        fg_usage.cumulative_share <= 0.80, "A",
        np.where(fg_usage.cumulative_share <= 0.95, "B", "C"),
    )
    for material in fg_usage.itertuples(index=False):
        current_on_hand = max(1, int(round(material.base_monthly_units * fg_rng.uniform(0.65, 1.10))))
        positions = max(1, int(math.ceil(current_on_hand / max(material.units_per_pallet, 1))))
        assigned_locations = allocate_positions(positions, pd.Series(material._asdict()), f"{material.abc_class}F")
        remaining = current_on_hand
        per_position = max(1, int(math.ceil(remaining / positions)))
        safety_stock = material.base_monthly_units * 0.20
        reorder_point = material.base_monthly_units * 0.50
        maximum = material.base_monthly_units * 1.25
        for position, location in enumerate(assigned_locations):
            quantity = remaining if position == positions - 1 else min(remaining, per_position)
            remaining -= quantity
            batch = f"FG-{material.material_code}-{position + 1:03d}"
            expiry = pd.Timestamp("2026-06-30") + pd.Timedelta(days=int(material.shelf_life_days * fg_rng.uniform(0.45, 0.95)))
            rows.append({
                "inventory_id": stable_uuid("inventory", f"{material.material_code}:{location.location_code}:{batch}"),
                "material_id": material.material_id, "material_code": material.material_code,
                "material_type": material.material_type,
                "warehouse_id": warehouse_id, "location_code": location.location_code,
                "batch_number": batch, "expiry_date": expiry.date().isoformat(),
                "quantity": quantity, "available_quantity": quantity, "reserved_quantity": 0,
                "buffer_stock": round(safety_stock, 2), "min_stock": round(reorder_point, 2),
                "max_stock": round(maximum, 2), "reorder_point": round(reorder_point, 2),
                "moq": 0, "lead_time_days": 1, "order_quantity": 0,
                "pallet_requirement": positions, "status": "active",
                "stacking_quantity": int(material.max_stack_height),
                "abc_class": material.abc_class, "fms_class": "F",
            })
    return pd.DataFrame(rows)


def _shortest_paths(nodes: pd.DataFrame, edges: pd.DataFrame, source: str) -> dict[str, float]:
    adjacency: dict[str, list[tuple[str, float]]] = {node: [] for node in nodes.node_code}
    for edge in edges.itertuples(index=False):
        adjacency[edge.from_node].append((edge.to_node, float(edge.distance_m)))
        adjacency[edge.to_node].append((edge.from_node, float(edge.distance_m)))
    distances = {node: math.inf for node in adjacency}
    distances[source] = 0.0
    queue: list[tuple[float, str]] = [(0.0, source)]
    while queue:
        distance, node = heapq.heappop(queue)
        if distance > distances[node]:
            continue
        for neighbor, cost in adjacency[node]:
            candidate = distance + cost
            if candidate < distances[neighbor]:
                distances[neighbor] = candidate
                heapq.heappush(queue, (candidate, neighbor))
    return distances


def _warehouse(cfg: BaselineConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    warehouse_id = stable_uuid("warehouse", "CMB-MAIN")
    warehouse = pd.DataFrame([{
        "warehouse_id": warehouse_id, "code": "CMB-MAIN", "name": "Colombo Main Warehouse",
        "city": "Colombo", "country": "Sri Lanka", "status": "active",
    }])
    locations = []
    special = [
        ("RCV-01", "R", "receiving", "RECEIVING", 5, 3.0, 2.0),
        ("STG-01", "R", "staging", "STAGING", 5, 5.0, 2.0),
        ("DOOR-01", "D", "access_point", "DOOR", 5, 2.0, 0.0),
        ("PACK-01", "P", "packing", "PACKING", 5, 7.0, 2.0),
        ("DSP-01", "D", "dispatch", "DISPATCH", 5, 4.0, 2.0),
        ("QTN-01", "Q", "quarantine", "QUARANTINE", 2, 3.0, 6.0),
    ]
    for code, area, kind, zone, access, coordinate_x, coordinate_y in special:
        locations.append({
            "location_id": stable_uuid("location", code), "warehouse_id": warehouse_id, "location_code": code,
            "area": area, "row_number": "00", "bay_number": "00", "level_number": 1,
            "bin_position": "A", "location_type": kind, "zone_type": zone, "capacity": 100,
            "accessibility_rating": access, "coordinate_x": coordinate_x, "coordinate_y": coordinate_y,
            "coordinate_z": 0, "max_pallet_capacity": 100, "max_weight_kg": 100000,
            "max_volume_cm3": 1000000000, "temperature_zone": "AMBIENT", "hazard_allowed": kind == "quarantine",
            "travel_distance_m": 0.0, "distance_to_receiving_m": 0.0,
            "distance_to_dispatch_m": 0.0, "physical_class": None,
            "layout_version": LAYOUT_VERSION,
        })
    levels_per_rack = 5
    bins_per_level = 3
    bins_per_rack = levels_per_rack * bins_per_level
    rack_count = math.ceil(cfg.location_count / bins_per_rack)
    aisle_count = 5
    if rack_count % aisle_count:
        raise RuntimeError("Metric layout requires a rack count divisible by five operational zones")
    racks_per_aisle = rack_count // aisle_count
    aisle_x = [8.0 + index * 6.0 for index in range(aisle_count)]
    rack_y = [8.0 + index * 5.0 for index in range(racks_per_aisle)]
    far_cross_aisle_y = max(rack_y) + 5.0
    graph_y = [4.0, *rack_y, far_cross_aisle_y]

    node_rows = []
    for aisle_index, x in enumerate(aisle_x):
        for y in graph_y:
            node_rows.append({
                "node_code": f"AISLE-{aisle_index + 1:02d}-Y{int(y):02d}",
                "node_type": "CROSS_AISLE" if y in {4.0, far_cross_aisle_y} else "RACK_ACCESS",
                "coordinate_x_m": x, "coordinate_y_m": y,
            })
    node_rows.extend([
        {"node_code": "DOCK-RECEIVING", "node_type": "DOCK", "coordinate_x_m": 3.0, "coordinate_y_m": 2.0},
        {"node_code": "DOCK-DISPATCH", "node_type": "DOCK", "coordinate_x_m": 4.0, "coordinate_y_m": 2.0},
    ])
    graph_nodes = pd.DataFrame(node_rows)
    edge_rows = []
    for aisle_index, x in enumerate(aisle_x):
        aisle_nodes = [f"AISLE-{aisle_index + 1:02d}-Y{int(y):02d}" for y in graph_y]
        for left, right, y1, y2 in zip(aisle_nodes[:-1], aisle_nodes[1:], graph_y[:-1], graph_y[1:]):
            edge_rows.append({"from_node": left, "to_node": right, "distance_m": round(y2 - y1, 2), "edge_type": "AISLE"})
    for y in (4.0, far_cross_aisle_y):
        for index in range(aisle_count - 1):
            edge_rows.append({
                "from_node": f"AISLE-{index + 1:02d}-Y{int(y):02d}",
                "to_node": f"AISLE-{index + 2:02d}-Y{int(y):02d}",
                "distance_m": round(aisle_x[index + 1] - aisle_x[index], 2), "edge_type": "CROSS_AISLE",
            })
    for dock_code, dock_x in (("DOCK-RECEIVING", 3.0), ("DOCK-DISPATCH", 4.0)):
        nearest = min(range(aisle_count), key=lambda index: abs(aisle_x[index] - dock_x))
        edge_rows.append({
            "from_node": dock_code, "to_node": f"AISLE-{nearest + 1:02d}-Y04",
            "distance_m": round(abs(aisle_x[nearest] - dock_x) + 2.0, 2), "edge_type": "DOCK_LINK",
        })
    graph_edges = pd.DataFrame(edge_rows)
    receiving_distance = _shortest_paths(graph_nodes, graph_edges, "DOCK-RECEIVING")
    dispatch_distance = _shortest_paths(graph_nodes, graph_edges, "DOCK-DISPATCH")

    for rack_index in range(rack_count):
        aisle_index = rack_index // racks_per_aisle
        bay = rack_index % racks_per_aisle + 1
        row = 1
        area = chr(65 + aisle_index)
        coordinate_x = aisle_x[aisle_index]
        coordinate_y = rack_y[bay - 1]
        graph_node = f"AISLE-{aisle_index + 1:02d}-Y{int(coordinate_y):02d}"
        rack_receiving_distance = receiving_distance[graph_node]
        rack_dispatch_distance = dispatch_distance[graph_node]
        class_plan = {
            "A": ("AF", "AF", "AF", "AM", "AM", "AM", "AS", "AS"),
            "B": ("AF", "AF", "AM", "AM", "AM", "BF", "BF", "BF"),
            "C": ("BF", "BF", "BF", "BM", "BM", "BM", "CF", "CF"),
            "D": ("BM", "BM", "BS", "BS", "BS", "CM", "CM", "CM"),
            "E": ("CF", "CF", "CM", "CM", "CM", "CS", "CS", "CS"),
        }
        physical_class = class_plan[area][bay - 1]

        for level in range(1, levels_per_rack + 1):
            for position_index in range(bins_per_level):
                position = chr(65 + position_index)
                code = f"{area}-{row:02d}-{bay:02d}-{level}-{position}"
                vertical_penalty = (0.0, 0.0, 2.5, 5.0, 8.0)[level - 1]
                flow_distance = min(rack_receiving_distance, rack_dispatch_distance) + vertical_penalty
                distance_penalty = min(3, int(flow_distance // 12))
                access = max(1, min(5, 6 - level - distance_penalty))
                level_weight = {1: 1200, 2: 1000, 3: 800, 4: 550, 5: 350}[level]
                locations.append({
                    "location_id": stable_uuid("location", code), "warehouse_id": warehouse_id,
                    "location_code": code, "area": area, "row_number": f"{row:02d}",
                    "bay_number": f"{bay:02d}", "level_number": level,
                    "bin_position": position, "location_type": "picking" if level <= 2 else "storage",
                    "zone_type": "PICK_FACE" if level <= 2 else "RESERVE", "capacity": 1,
                    "accessibility_rating": access, "coordinate_x": coordinate_x,
                    "coordinate_y": coordinate_y, "coordinate_z": level * 1.5,
                    "max_pallet_capacity": 1, "max_weight_kg": level_weight,
                    "max_volume_cm3": 1800000,
                    "temperature_zone": "CONTROLLED" if area == "E" and bay <= 4 else "AMBIENT",
                    "hazard_allowed": area == "E" and bay >= 4,
                    "travel_distance_m": round(flow_distance, 2),
                    "distance_to_receiving_m": round(rack_receiving_distance + vertical_penalty, 2),
                    "distance_to_dispatch_m": round(rack_dispatch_distance + vertical_penalty, 2),
                    "physical_class": physical_class, "layout_version": LAYOUT_VERSION,
                })
    return warehouse, pd.DataFrame(locations), graph_nodes, graph_edges


def _partners(cfg: BaselineConfig, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    suppliers = pd.DataFrame([{
        "supplier_id": stable_uuid("supplier", f"SUP-{i:03d}"), "code": f"SUP-{i:03d}",
        "name": f"Approved Supplier {i:03d}", "email": f"supplier{i:03d}@project.invalid",
        "phone": f"+94-11-55{i:05d}", "lead_time_days": int(rng.integers(5, 46)),
        "rating": round(float(rng.uniform(3.2, 5.0)), 2), "on_time_rate": round(float(rng.uniform(0.82, 0.99)), 4),
        "defect_rate": round(float(rng.uniform(0.001, 0.04)), 4), "status": "active",
    } for i in range(1, cfg.supplier_count + 1)])
    customers = pd.DataFrame([{
        "customer_id": stable_uuid("customer", f"CUS-{i:04d}"), "code": f"CUS-{i:04d}",
        "name": f"Distribution Customer {i:04d}", "city": ["Colombo", "Kandy", "Galle", "Jaffna", "Kurunegala"][i % 5],
        "country": "Sri Lanka", "status": "active",
    } for i in range(1, cfg.customer_count + 1)])
    workers = pd.DataFrame([{
        "user_id": stable_uuid("user", f"EMP-{i:04d}"), "username": f"operator{i:04d}",
        "email": f"operator{i:04d}@project.invalid", "password_hash": "$2a$10$generatedOperationalBaselineHash",
        "employee_id": f"EMP-{i:04d}", "first_name": "Warehouse", "last_name": f"Operator {i:04d}",
        "role": "supervisor" if i <= 4 else "worker", "status": "active",
    } for i in range(1, cfg.worker_count + 1)])
    return suppliers, customers, workers


def _operations(
    cfg: BaselineConfig, rng: np.random.Generator, warehouse_id: str, materials: pd.DataFrame,
    fg: pd.DataFrame, suppliers: pd.DataFrame, customers: pd.DataFrame, workers: pd.DataFrame,
    locations: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    end = pd.Timestamp("2026-06-30")
    start = end - pd.DateOffset(months=cfg.operational_months)
    order_ids = np.arange(cfg.order_count)
    inbound_mask = order_ids < int(cfg.order_count * 0.20)
    order_dates = start + pd.to_timedelta(rng.integers(0, max(1, (end - start).days), cfg.order_count), unit="D")
    orders = []
    for i, inbound in enumerate(inbound_mask):
        kind = "inbound" if inbound else "outbound"
        number = f"{'PO' if inbound else 'SO'}-{order_dates[i]:%Y%m%d}-{i + 1:06d}"
        status = rng.choice(["received", "completed", "cancelled"], p=[0.72, 0.25, 0.03]) if inbound else rng.choice(["delivered", "shipped", "packed", "cancelled"], p=[0.70, 0.17, 0.10, 0.03])
        orders.append({
            "order_id": stable_uuid("order", number), "order_number": number, "order_type": kind,
            "customer_id": "" if inbound else customers.iloc[i % len(customers)].customer_id,
            "supplier_id": suppliers.iloc[i % len(suppliers)].supplier_id if inbound else "",
            "warehouse_id": warehouse_id, "status": status, "priority": rng.choice(["normal", "express", "urgent"], p=[0.84, 0.12, 0.04]),
            "order_date": order_dates[i].date().isoformat(), "expected_date": (order_dates[i] + pd.Timedelta(days=int(rng.integers(2, 18)))).date().isoformat(),
        })
    orders_df = pd.DataFrame(orders)
    per_order = np.full(cfg.order_count, cfg.order_line_count // cfg.order_count, dtype=int)
    per_order[: cfg.order_line_count % cfg.order_count] += 1
    line_rows = []
    storage_locations = locations[locations.location_type.isin(["picking", "storage"])]
    for i, order in enumerate(orders_df.itertuples(index=False)):
        pool = materials if order.order_type == "inbound" else fg
        sample = pool.sample(min(per_order[i], len(pool)), replace=False, random_state=int(rng.integers(0, 2**31 - 1)))
        for j, material in enumerate(sample.itertuples(index=False)):
            quantity = int(rng.lognormal(5.2 if order.order_type == "outbound" else 6.2, 0.8))
            line_key = f"{order.order_number}:{j + 1}"
            line_rows.append({
                "order_item_id": stable_uuid("order_item", line_key), "order_id": order.order_id,
                "order_number": order.order_number, "material_id": material.material_id, "material_code": material.material_code,
                "quantity": max(1, quantity), "unit_price": material.unit_cost,
                "picked_quantity": max(1, quantity) if order.order_type == "outbound" and order.status in {"packed", "shipped", "delivered"} else 0,
                "packed_quantity": max(1, quantity) if order.order_type == "outbound" and order.status in {"packed", "shipped", "delivered"} else 0,
                "location_code": storage_locations.iloc[(i + j) % len(storage_locations)].location_code,
                "status": "completed" if order.status in {"received", "completed", "packed", "shipped", "delivered"} else "pending",
            })
    lines = pd.DataFrame(line_rows)
    movement_types = np.array(["receipt", "putaway", "picking", "transfer_out", "transfer_in", "adjustment"])
    movement_rows = []
    for i in range(cfg.stock_movement_count):
        line = lines.iloc[i % len(lines)]
        order = orders_df.iloc[i % len(orders_df)]
        movement = "receipt" if order.order_type == "inbound" and i % 2 == 0 else ("putaway" if order.order_type == "inbound" else "picking")
        if i >= len(lines):
            movement = str(movement_types[i % len(movement_types)])
        when = pd.Timestamp(order.order_date) + pd.Timedelta(hours=int(rng.integers(1, 96)))
        movement_rows.append({
            "movement_id": stable_uuid("movement", f"MOV-{i + 1:07d}"), "material_id": line.material_id,
            "warehouse_id": warehouse_id, "location_code": line.location_code, "movement_type": movement,
            "quantity": max(1, int(line.quantity / max(1, (i % 4) + 1))), "reference_type": "order",
            "reference_id": order.order_id, "user_id": workers.iloc[i % len(workers)].user_id,
            "notes": DATASET_VERSION, "created_at": when.isoformat(),
        })
    movements = pd.DataFrame(movement_rows)
    task_types = np.array(["receiving", "putaway", "picking", "packing", "cycle_count", "stock_transfer"])
    task_rows = []
    event_rows = []
    for i in range(cfg.task_count):
        line = lines.iloc[i % len(lines)]
        order = orders_df.iloc[i % len(orders_df)]
        task_type = str(task_types[i % len(task_types)])
        created = pd.Timestamp(order.order_date) + pd.Timedelta(hours=int(rng.integers(0, 48)))
        duration = int(rng.integers(3, 90))
        task_id = stable_uuid("task", f"TASK-{i + 1:07d}")
        worker = workers.iloc[i % len(workers)].user_id
        task_rows.append({
            "task_id": task_id, "task_number": f"TASK-{i + 1:07d}", "task_type": task_type,
            "warehouse_id": warehouse_id, "assigned_to": worker, "priority": order.priority,
            "status": "completed", "due_date": (created + pd.Timedelta(hours=8)).isoformat(),
            "completed_at": (created + pd.Timedelta(minutes=duration)).isoformat(), "location_code": line.location_code,
            "reference_type": "order", "reference_id": order.order_id, "notes": DATASET_VERSION,
            "created_at": created.isoformat(),
        })
        event_rows.append({
            "event_id": stable_uuid("event", f"EVENT-{i + 1:07d}"), "operation_type": task_type,
            "worker_id": worker, "task_id": task_id, "order_id": order.order_id,
            "order_item_id": line.order_item_id, "warehouse_id": warehouse_id, "material_id": line.material_id,
            "quantity": int(line.quantity), "started_at": created.isoformat(),
            "completed_at": (created + pd.Timedelta(minutes=duration)).isoformat(), "duration_minutes": duration,
            "status": "completed", "metadata": json.dumps({"dataset_version": DATASET_VERSION}),
        })
    return {
        "orders": orders_df, "order_items": lines, "stock_movements": movements,
        "tasks": pd.DataFrame(task_rows), "operation_events": pd.DataFrame(event_rows),
    }


def generate_baseline(output_dir: Path, cfg: BaselineConfig = BaselineConfig()) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(cfg.seed)
    materials, finished_goods = _material_master(cfg, rng)
    bom = _bom(materials, finished_goods, cfg, rng)
    production, demand = _demand(materials, finished_goods, bom, cfg, rng)
    classifications, thresholds = _classifications(demand)
    policy = _policy(materials, demand, classifications, rng)
    warehouse, locations, graph_nodes, graph_edges = _warehouse(cfg)
    inventory = _inventory(
        materials, finished_goods, policy, classifications, locations,
        warehouse.iloc[0].warehouse_id, rng, np.random.default_rng(cfg.seed + 1701),
    )
    suppliers, customers, workers = _partners(cfg, rng)
    supplier_materials = materials[["material_id", "min_order_quantity", "order_multiple", "units_per_handling_unit", "lead_time_days"]].copy()
    supplier_materials["supplier_id"] = [suppliers.iloc[i % len(suppliers)].supplier_id for i in range(len(supplier_materials))]
    supplier_materials["preferred"] = True
    operations = _operations(cfg, rng, warehouse.iloc[0].warehouse_id, materials, finished_goods, suppliers, customers, workers, locations)

    tables = {
        "warehouses": warehouse, "locations": locations,
        "warehouse_graph_nodes": graph_nodes, "warehouse_graph_edges": graph_edges,
        "materials": materials,
        "finished_goods": finished_goods, "bom_components": bom, "production_history": production,
        "demand_history": demand, "classification_thresholds": thresholds,
        "material_classifications": classifications, "inventory_policy": policy, "inventory": inventory,
        "suppliers": suppliers, "supplier_materials": supplier_materials,
        "customers": customers, "users": workers, **operations,
    }
    paths = []
    for name, frame in tables.items():
        paths.append(_write(frame, output_dir, name))
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    row_counts = {name: int(len(frame)) for name, frame in tables.items()}
    validations = {
        "material_count_expected": len(materials) == cfg.rm_count + cfg.pm_count,
        "finished_good_count_expected": len(finished_goods) == cfg.fg_count,
        "location_count_expected": len(locations) == math.ceil(cfg.location_count / 15) * 15 + 6,
        "bom_parent_coverage": int(bom.parent_material_id.nunique()) == cfg.fg_count,
        "bom_component_coverage": int(bom.component_material_id.nunique()) == len(materials),
        "demand_panel_complete": len(demand) == cfg.history_months * len(materials),
        "order_count_expected": len(operations["orders"]) == cfg.order_count,
        "order_line_count_expected": len(operations["order_items"]) == cfg.order_line_count,
        "stock_movement_count_expected": len(operations["stock_movements"]) == cfg.stock_movement_count,
        "task_count_expected": len(operations["tasks"]) == cfg.task_count,
        "no_negative_demand": bool(demand.demand_units.ge(0).all()),
        "current_inventory_fits_warehouse": len(inventory) <= int(locations.max_pallet_capacity.sum()),
        "policy_max_positions_within_capacity": int(policy.required_pallet_positions.sum()) <= int(locations.max_pallet_capacity.sum()),
        "pallet_weights_within_lower_rack_limit": bool(
            pd.concat([materials, finished_goods]).max_pallet_weight_kg.le(1200).all()
        ),
        "pallet_volumes_within_bin_limit": bool(
            (
                pd.concat([materials, finished_goods]).volume_cm3
                * pd.concat([materials, finished_goods]).units_per_pallet
            ).le(1_800_000).all()
        ),
        "controlled_hazard_location_coverage": bool(
            ((locations.temperature_zone == "CONTROLLED") & locations.hazard_allowed).any()
        ),
        "metric_layout_has_all_physical_classes": set(locations.physical_class.dropna())
        == {"AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"},
        "aisle_graph_is_connected": bool(
            all(math.isfinite(value) for value in _shortest_paths(graph_nodes, graph_edges, "DOCK-DISPATCH").values())
        ),
        "inventory_locations_are_unique": not inventory.location_code.duplicated().any(),
        "inventory_stack_limits_complete": bool(inventory.stacking_quantity.gt(0).all()),
    }
    manifest = {
        "dataset_version": DATASET_VERSION, "quality_tier": QUALITY_TIER,
        "seed": cfg.seed, "dataset_hash": digest.hexdigest(), "config": asdict(cfg),
        "row_counts": row_counts, "validations": validations,
        "operational_visibility": "normal WMS records; provenance restricted to admin/evaluator surfaces",
        "claim_boundary": "generated project-operational baseline; not externally observed customer history",
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    if not all(validations.values()):
        raise RuntimeError(f"Generated baseline validation failed: {validations}")
    return manifest
