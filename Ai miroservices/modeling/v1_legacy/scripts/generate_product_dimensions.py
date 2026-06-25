"""
Product Dimensions Generator — Phase 1.2
Generates realistic L/W/H, weight, volume, and storage-type for all 391 SKUs
(103 FG + 288 RM) based on FMCG industry standards.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import OUT_DIR

GENERATED_DIR = OUT_DIR / "generated"
CANONICAL_RM_PATH = OUT_DIR / "real_source" / "active_stock_canonical.csv"
SEED = 42

FG_CATEGORY_PROFILES = {
    "Soap": {
        "storage_type": "CARTON",
        "length_cm": (10, 18), "width_cm": (5, 10), "height_cm": (3, 6),
        "unit_weight_kg": (0.05, 0.15),
        "cases_per_pallet": (60, 150),
    },
    "Shampoo": {
        "storage_type": "CARTON",
        "length_cm": (6, 22), "width_cm": (5, 10), "height_cm": (12, 26),
        "unit_weight_kg": (0.08, 0.50),
        "cases_per_pallet": (40, 120),
    },
    "Liquid Wash": {
        "storage_type": "CARTON",
        "length_cm": (8, 15), "width_cm": (6, 12), "height_cm": (15, 30),
        "unit_weight_kg": (0.20, 1.10),
        "cases_per_pallet": (30, 100),
    },
    "Diaper": {
        "storage_type": "BAG",
        "length_cm": (25, 45), "width_cm": (15, 30), "height_cm": (12, 25),
        "unit_weight_kg": (0.30, 1.20),
        "cases_per_pallet": (20, 60),
    },
    "Sanitary": {
        "storage_type": "CARTON",
        "length_cm": (15, 25), "width_cm": (8, 15), "height_cm": (5, 12),
        "unit_weight_kg": (0.08, 0.35),
        "cases_per_pallet": (50, 140),
    },
    "Lotion/Cream": {
        "storage_type": "CARTON",
        "length_cm": (4, 18), "width_cm": (4, 10), "height_cm": (8, 22),
        "unit_weight_kg": (0.05, 0.50),
        "cases_per_pallet": (40, 130),
    },
    "Talc": {
        "storage_type": "CARTON",
        "length_cm": (5, 10), "width_cm": (5, 10), "height_cm": (10, 22),
        "unit_weight_kg": (0.05, 0.25),
        "cases_per_pallet": (50, 150),
    },
    "Home Care": {
        "storage_type": "CARTON",
        "length_cm": (8, 18), "width_cm": (6, 14), "height_cm": (18, 35),
        "unit_weight_kg": (0.50, 2.20),
        "cases_per_pallet": (20, 60),
    },
    "Baby Care": {
        "storage_type": "CARTON",
        "length_cm": (10, 25), "width_cm": (6, 15), "height_cm": (5, 18),
        "unit_weight_kg": (0.05, 0.40),
        "cases_per_pallet": (40, 120),
    },
    "Combo": {
        "storage_type": "CARTON",
        "length_cm": (20, 35), "width_cm": (15, 25), "height_cm": (10, 20),
        "unit_weight_kg": (0.50, 2.00),
        "cases_per_pallet": (15, 50),
    },
}

RM_FAMILY_PROFILES = {
    "SOLVENT": {
        "storage_type": "DRUM",
        "length_cm": (55, 60), "width_cm": (55, 60), "height_cm": (85, 92),
        "unit_weight_kg": (150, 220),
        "units_per_pallet": (1, 4),
    },
    "SURFACTANT": {
        "storage_type": "DRUM",
        "length_cm": (55, 60), "width_cm": (55, 60), "height_cm": (85, 92),
        "unit_weight_kg": (120, 200),
        "units_per_pallet": (1, 4),
    },
    "COLORANT": {
        "storage_type": "CARTON",
        "length_cm": (15, 30), "width_cm": (15, 25), "height_cm": (15, 25),
        "unit_weight_kg": (1, 25),
        "units_per_pallet": (4, 40),
    },
    "ACID_BASE": {
        "storage_type": "DRUM",
        "length_cm": (30, 60), "width_cm": (30, 60), "height_cm": (40, 92),
        "unit_weight_kg": (25, 250),
        "units_per_pallet": (1, 4),
    },
    "STARCH_GUM": {
        "storage_type": "BAG",
        "length_cm": (40, 70), "width_cm": (25, 45), "height_cm": (10, 25),
        "unit_weight_kg": (20, 50),
        "units_per_pallet": (4, 20),
    },
    "OIL_WAX": {
        "storage_type": "DRUM",
        "length_cm": (30, 60), "width_cm": (30, 60), "height_cm": (40, 92),
        "unit_weight_kg": (15, 200),
        "units_per_pallet": (1, 4),
    },
    "ACTIVE": {
        "storage_type": "CARTON",
        "length_cm": (10, 30), "width_cm": (10, 25), "height_cm": (10, 25),
        "unit_weight_kg": (0.5, 25),
        "units_per_pallet": (4, 40),
    },
    "FRAGRANCE_COOLANT": {
        "storage_type": "CARTON",
        "length_cm": (10, 25), "width_cm": (10, 20), "height_cm": (10, 25),
        "unit_weight_kg": (0.5, 30),
        "units_per_pallet": (4, 30),
    },
    "PACKAGING": {
        "storage_type": "ROLL",
        "length_cm": (60, 120), "width_cm": (20, 40), "height_cm": (20, 40),
        "unit_weight_kg": (5, 30),
        "units_per_pallet": (4, 20),
    },
    "GENERAL": {
        "storage_type": "CARTON",
        "length_cm": (15, 35), "width_cm": (15, 25), "height_cm": (15, 30),
        "unit_weight_kg": (1, 30),
        "units_per_pallet": (4, 20),
    },
}

HAZARD_RULES = {
    "SOLVENT": ("FLAMMABLE", 0.70),
    "ACID_BASE": ("CORROSIVE", 0.80),
    "FRAGRANCE_COOLANT": ("FLAMMABLE", 0.15),
    "OIL_WAX": ("FLAMMABLE", 0.10),
}


def _rand_between(rng: np.random.Generator, low: float, high: float) -> float:
    return round(float(rng.uniform(low, high)), 2)


def _infer_rm_family(description: str) -> str:
    from rule_based_synthetic_generator import infer_material_family
    return infer_material_family(description)


def _demand_scale_for_rm(row: pd.Series) -> str:
    avg = row.get("future_average", 0)
    if pd.isna(avg) or avg <= 0:
        avg = 1.0
    if avg >= 1500:
        return "BULK"
    if avg >= 300:
        return "MEDIUM"
    return "SMALL"


def generate_fg_dimensions(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    fg_skus = [
        ("FG001", "Baby Soap 50g", "Soap"), ("FG002", "Baby Soap 75g", "Soap"),
        ("FG003", "Baby Soap 100g", "Soap"), ("FG004", "Herbal Neem Soap 75g", "Soap"),
        ("FG005", "Herbal Sandal Soap 75g", "Soap"), ("FG006", "Herbal Aloe Soap 100g", "Soap"),
        ("FG007", "Premium Fragrance Soap 75g", "Soap"), ("FG008", "Premium Fragrance Soap 100g", "Soap"),
        ("FG009", "Luxury Cream Soap", "Soap"), ("FG010", "Antibacterial Soap", "Soap"),
        ("FG011", "Whitening Soap", "Soap"), ("FG012", "Moisturizing Soap", "Soap"),
        ("FG013", "Charcoal Detox Soap", "Soap"), ("FG014", "Lemon Fresh Soap", "Soap"),
        ("FG015", "Family Pack Soap (3x100g)", "Soap"),
        ("FG016", "Shampoo 80ml", "Shampoo"), ("FG017", "Shampoo 100ml", "Shampoo"),
        ("FG018", "Shampoo 200ml", "Shampoo"), ("FG019", "Shampoo 400ml", "Shampoo"),
        ("FG020", "Anti-Dandruff Shampoo 100ml", "Shampoo"), ("FG021", "Anti-Dandruff Shampoo 200ml", "Shampoo"),
        ("FG022", "Herbal Shampoo 100ml", "Shampoo"), ("FG023", "Herbal Shampoo 200ml", "Shampoo"),
        ("FG024", "Baby Shampoo 100ml", "Shampoo"), ("FG025", "Baby Shampoo 200ml", "Shampoo"),
        ("FG026", "Silk Smooth Shampoo", "Shampoo"), ("FG027", "Volume Boost Shampoo", "Shampoo"),
        ("FG028", "Repair & Protect Shampoo", "Shampoo"), ("FG029", "Shampoo Sachet 10ml", "Shampoo"),
        ("FG030", "Anti-Dandruff Sachet", "Shampoo"), ("FG031", "Herbal Sachet", "Shampoo"),
        ("FG032", "Shampoo + Conditioner Pack", "Shampoo"), ("FG033", "Travel Kit Shampoo", "Shampoo"),
        ("FG034", "Handwash 200ml", "Liquid Wash"), ("FG035", "Handwash 500ml", "Liquid Wash"),
        ("FG036", "Handwash 1L Refill", "Liquid Wash"), ("FG037", "Antibacterial Handwash", "Liquid Wash"),
        ("FG038", "Aloe Handwash", "Liquid Wash"), ("FG039", "Baby Liquid Wash", "Liquid Wash"),
        ("FG040", "Body Wash 200ml", "Liquid Wash"), ("FG041", "Body Wash 400ml", "Liquid Wash"),
        ("FG042", "Body Wash Refill", "Liquid Wash"), ("FG043", "Premium Body Wash", "Liquid Wash"),
        ("FG044", "Baby Diaper NB", "Diaper"), ("FG045", "Baby Diaper S", "Diaper"),
        ("FG046", "Baby Diaper M", "Diaper"), ("FG047", "Baby Diaper L", "Diaper"),
        ("FG048", "Baby Diaper XL", "Diaper"), ("FG049", "Baby Diaper XXL", "Diaper"),
        ("FG050", "Diaper Value Pack S", "Diaper"), ("FG051", "Diaper Value Pack M", "Diaper"),
        ("FG052", "Diaper Value Pack L", "Diaper"), ("FG053", "Diaper Value Pack XL", "Diaper"),
        ("FG054", "Overnight Diaper M", "Diaper"), ("FG055", "Overnight Diaper L", "Diaper"),
        ("FG056", "Regular 10 Pack", "Sanitary"), ("FG057", "Regular 20 Pack", "Sanitary"),
        ("FG058", "XL Pack", "Sanitary"), ("FG059", "Night Pad Pack", "Sanitary"),
        ("FG060", "Ultra Thin Pack", "Sanitary"), ("FG061", "Maxi Pack", "Sanitary"),
        ("FG062", "Value Pack 30", "Sanitary"), ("FG063", "Premium Cotton Pack", "Sanitary"),
        ("FG064", "Baby Lotion 100ml", "Lotion/Cream"), ("FG065", "Baby Lotion 200ml", "Lotion/Cream"),
        ("FG066", "Moisturizing Cream 50g", "Lotion/Cream"), ("FG067", "Moisturizing Cream 100g", "Lotion/Cream"),
        ("FG068", "Body Lotion 100ml", "Lotion/Cream"), ("FG069", "Body Lotion 200ml", "Lotion/Cream"),
        ("FG070", "Body Lotion 400ml", "Lotion/Cream"), ("FG071", "Aloe Gel", "Lotion/Cream"),
        ("FG072", "Face Cream", "Lotion/Cream"), ("FG073", "Night Repair Cream", "Lotion/Cream"),
        ("FG074", "Sunscreen Lotion", "Lotion/Cream"), ("FG075", "Winter Care Cream", "Lotion/Cream"),
        ("FG076", "Baby Powder 50g", "Talc"), ("FG077", "Baby Powder 100g", "Talc"),
        ("FG078", "Baby Powder 200g", "Talc"), ("FG079", "Adult Talcum 100g", "Talc"),
        ("FG080", "Adult Talcum 200g", "Talc"), ("FG081", "Cooling Powder", "Talc"),
        ("FG082", "Liquid Detergent 500ml", "Home Care"), ("FG083", "Liquid Detergent 1L", "Home Care"),
        ("FG084", "Liquid Detergent 2L", "Home Care"), ("FG085", "Fabric Conditioner 500ml", "Home Care"),
        ("FG086", "Fabric Conditioner 1L", "Home Care"), ("FG087", "Dishwash Liquid 500ml", "Home Care"),
        ("FG088", "Dishwash Liquid 1L", "Home Care"), ("FG089", "Floor Cleaner 1L", "Home Care"),
        ("FG090", "Antibacterial Floor Cleaner", "Home Care"), ("FG091", "Multi-Surface Cleaner", "Home Care"),
        ("FG092", "Baby Wet Wipes Small Pack", "Baby Care"), ("FG093", "Baby Wet Wipes Large Pack", "Baby Care"),
        ("FG094", "Sensitive Wet Wipes", "Baby Care"), ("FG095", "Travel Wipes", "Baby Care"),
        ("FG096", "Baby Rash Cream", "Baby Care"), ("FG097", "Baby Oil", "Baby Care"),
        ("FG098", "Baby Bath Kit", "Baby Care"),
        ("FG099", "Baby Care Gift Pack", "Combo"), ("FG100", "Premium Personal Care Combo", "Combo"),
        ("FG101", "Festive Soap Combo", "Combo"), ("FG102", "Shampoo + Lotion Gift Pack", "Combo"),
        ("FG103", "Family Hygiene Combo", "Combo"),
    ]

    for code, name, category in fg_skus:
        profile = FG_CATEGORY_PROFILES.get(category, FG_CATEGORY_PROFILES["Soap"])
        l = _rand_between(rng, *profile["length_cm"])
        w = _rand_between(rng, *profile["width_cm"])
        h = _rand_between(rng, *profile["height_cm"])
        wt = _rand_between(rng, *profile["unit_weight_kg"])
        vol = round(l * w * h, 2)
        cpp = int(rng.integers(*profile["cases_per_pallet"]))
        rows.append({
            "sku_code": code,
            "sku_name": name,
            "sku_type": "FG",
            "category": category,
            "storage_type": profile["storage_type"],
            "length_cm": l, "width_cm": w, "height_cm": h,
            "weight_kg": wt, "volume_cm3": vol,
            "units_per_pallet": cpp,
            "hazard_class": "NONE",
        })

    return pd.DataFrame(rows)


def generate_rm_dimensions(rng: np.random.Generator) -> pd.DataFrame:
    canonical = pd.read_csv(CANONICAL_RM_PATH)
    rows = []

    for _, row in canonical.iterrows():
        code = f"RM{int(row['material_code']):06d}"
        desc = str(row.get("description", "")).strip()
        family = _infer_rm_family(desc)
        scale = _demand_scale_for_rm(row)
        profile = RM_FAMILY_PROFILES.get(family, RM_FAMILY_PROFILES["GENERAL"])

        if scale == "BULK" and family in ("SOLVENT", "SURFACTANT", "ACID_BASE", "OIL_WAX"):
            st = "IBC" if rng.random() < 0.25 else "DRUM"
        elif scale == "SMALL" and family in ("COLORANT", "ACTIVE", "FRAGRANCE_COOLANT"):
            st = "CARTON"
        else:
            st = profile["storage_type"]

        l = _rand_between(rng, *profile["length_cm"])
        w = _rand_between(rng, *profile["width_cm"])
        h = _rand_between(rng, *profile["height_cm"])
        wt = _rand_between(rng, *profile["unit_weight_kg"])
        vol = round(l * w * h, 2)
        upp = int(rng.integers(*profile["units_per_pallet"]))

        hazard = "NONE"
        if family in HAZARD_RULES:
            hclass, prob = HAZARD_RULES[family]
            if rng.random() < prob:
                hazard = hclass

        rows.append({
            "sku_code": code,
            "sku_name": desc,
            "sku_type": "RM",
            "category": family,
            "storage_type": st,
            "length_cm": l, "width_cm": w, "height_cm": h,
            "weight_kg": wt, "volume_cm3": vol,
            "units_per_pallet": upp,
            "hazard_class": hazard,
        })

    return pd.DataFrame(rows)


def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    fg_dims = generate_fg_dimensions(rng)
    rm_dims = generate_rm_dimensions(rng)
    all_dims = pd.concat([fg_dims, rm_dims], ignore_index=True)

    out_path = GENERATED_DIR / "product_dimensions.csv"
    all_dims.to_csv(out_path, index=False)

    summary = {
        "total_skus": len(all_dims),
        "fg_count": len(fg_dims),
        "rm_count": len(rm_dims),
        "storage_type_counts": all_dims["storage_type"].value_counts().to_dict(),
        "hazard_counts": all_dims["hazard_class"].value_counts().to_dict(),
        "weight_stats": {
            "min": float(all_dims["weight_kg"].min()),
            "max": float(all_dims["weight_kg"].max()),
            "mean": float(all_dims["weight_kg"].mean()),
        },
        "volume_stats": {
            "min": float(all_dims["volume_cm3"].min()),
            "max": float(all_dims["volume_cm3"].max()),
            "mean": float(all_dims["volume_cm3"].mean()),
        },
    }
    summary_path = GENERATED_DIR / "product_dimensions_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Generated dimensions for {len(all_dims)} SKUs -> {out_path}")
    print(f"  FG: {len(fg_dims)}, RM: {len(rm_dims)}")
    for st, cnt in all_dims["storage_type"].value_counts().items():
        print(f"  {st}: {cnt}")
    print(f"Summary -> {summary_path}")


if __name__ == "__main__":
    main()
