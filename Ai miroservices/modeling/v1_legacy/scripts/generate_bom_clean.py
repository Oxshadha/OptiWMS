"""
BOM Cleanup & Generation — Phase 1.3
Remaps foundation BOM FG/RM codes to match actual SKU codes,
generates missing BOMs for uncovered FG categories, and outputs
a clean BOM CSV + SQL seed script for V55 schema.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import OUT_DIR

GENERATED_DIR = OUT_DIR / "generated"
FOUNDATION_BOM_PATH = GENERATED_DIR / "fg_rm_foundation_bom.csv"
CANONICAL_RM_PATH = OUT_DIR / "real_source" / "active_stock_canonical.csv"
SEED = 42

FG_CODE_MAP = {
    "SOAP": [f"FG{i:03d}" for i in range(1, 16)],      # 15 soaps
    "FACEWASH": [f"FG{i:03d}" for i in range(34, 44)],  # 10 liquid washes
    "SHAMPOO": [f"FG{i:03d}" for i in range(16, 34)],   # 18 shampoos
    "CREAM": [f"FG{i:03d}" for i in range(64, 76)],     # 12 lotions/creams
}

MISSING_FG_CATEGORIES = {
    "Diaper": [f"FG{i:03d}" for i in range(44, 56)],
    "Sanitary": [f"FG{i:03d}" for i in range(56, 64)],
    "Talc": [f"FG{i:03d}" for i in range(76, 82)],
    "Home Care": [f"FG{i:03d}" for i in range(82, 92)],
    "Baby Care": [f"FG{i:03d}" for i in range(92, 99)],
    "Combo": [f"FG{i:03d}" for i in range(99, 104)],
}

CATEGORY_RM_FAMILIES = {
    "Diaper": ["STARCH_GUM", "OIL_WAX", "ACTIVE", "PACKAGING"],
    "Sanitary": ["STARCH_GUM", "OIL_WAX", "ACTIVE", "PACKAGING"],
    "Talc": ["STARCH_GUM", "FRAGRANCE_COOLANT", "ACTIVE", "COLORANT"],
    "Home Care": ["SURFACTANT", "ACID_BASE", "FRAGRANCE_COOLANT", "COLORANT"],
    "Baby Care": ["OIL_WAX", "ACTIVE", "FRAGRANCE_COOLANT", "SURFACTANT"],
    "Combo": ["OIL_WAX", "SURFACTANT", "FRAGRANCE_COOLANT", "ACTIVE"],
}


def load_rm_lookup() -> dict[str, list[int]]:
    """Build family -> list of material_codes from canonical."""
    from rule_based_synthetic_generator import infer_material_family
    canonical = pd.read_csv(CANONICAL_RM_PATH)
    lookup: dict[str, list[int]] = {}
    for _, row in canonical.iterrows():
        code = int(row["material_code"])
        desc = str(row.get("description", ""))
        family = infer_material_family(desc)
        lookup.setdefault(family, []).append(code)
    return lookup


def remap_foundation_bom() -> pd.DataFrame:
    """Remap SOAP_001 -> FG001 style codes."""
    bom = pd.read_csv(FOUNDATION_BOM_PATH)
    rows = []

    for old_cat, fg_codes in FG_CODE_MAP.items():
        cat_bom = bom[bom["fg_category"] == old_cat].copy()
        old_fg_codes = sorted(cat_bom["fg_code"].unique())

        for i, new_fg in enumerate(fg_codes):
            old_fg = old_fg_codes[i % len(old_fg_codes)]
            components = cat_bom[cat_bom["fg_code"] == old_fg].copy()
            for _, comp in components.iterrows():
                rm_code = int(comp["rm_code"])
                rows.append({
                    "fg_code": new_fg,
                    "fg_category": old_cat,
                    "rm_code": f"RM{rm_code:06d}",
                    "rm_family": comp["rm_family"],
                    "bom_coef": round(float(comp["bom_coef"]), 6),
                })

    return pd.DataFrame(rows)


def generate_missing_boms(rm_lookup: dict[str, list[int]], rng: np.random.Generator) -> pd.DataFrame:
    """Generate BOM entries for FG categories not in foundation BOM."""
    rows = []

    for category, fg_codes in MISSING_FG_CATEGORIES.items():
        families = CATEGORY_RM_FAMILIES[category]
        for fg_code in fg_codes:
            n_components = rng.integers(3, 6)
            chosen_families = list(rng.choice(families, size=min(n_components, len(families)), replace=False))
            if len(chosen_families) < n_components:
                chosen_families += list(rng.choice(families, size=n_components - len(chosen_families), replace=True))

            raw_weights = rng.dirichlet(np.ones(len(chosen_families)))
            for fam, coef in zip(chosen_families, raw_weights):
                available = rm_lookup.get(fam, rm_lookup.get("GENERAL", [100005]))
                rm_code = int(rng.choice(available))
                rows.append({
                    "fg_code": fg_code,
                    "fg_category": category,
                    "rm_code": f"RM{rm_code:06d}",
                    "rm_family": fam,
                    "bom_coef": round(float(coef), 6),
                })

    return pd.DataFrame(rows)


def generate_sql_seed(bom_df: pd.DataFrame, out_path: Path) -> None:
    """Generate SQL INSERT statements for V55 BOM schema."""
    lines = [
        "-- Auto-generated BOM seed data for V55 schema",
        "-- Requires materials table to be populated first",
        "-- Run after product/material seeding",
        "",
        "DO $$ DECLARE",
        "  v_bom_id UUID;",
        "  v_parent_id UUID;",
        "  v_comp_id UUID;",
        "BEGIN",
    ]

    for fg_code in sorted(bom_df["fg_code"].unique()):
        fg_bom = bom_df[bom_df["fg_code"] == fg_code]
        category = fg_bom.iloc[0]["fg_category"]
        lines.append(f"  -- BOM for {fg_code} ({category})")
        lines.append(f"  SELECT id INTO v_parent_id FROM materials WHERE material_code = '{fg_code}' LIMIT 1;")
        lines.append("  IF v_parent_id IS NOT NULL THEN")
        lines.append("    INSERT INTO bom_headers (parent_material_id, version, status)")
        lines.append("    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;")

        for _, comp in fg_bom.iterrows():
            rm_code = comp["rm_code"]
            coef = comp["bom_coef"]
            family = comp["rm_family"]
            lines.append(f"    SELECT id INTO v_comp_id FROM materials WHERE material_code = '{rm_code}' LIMIT 1;")
            lines.append("    IF v_comp_id IS NOT NULL THEN")
            lines.append(f"      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)")
            lines.append(f"      VALUES (v_bom_id, v_comp_id, '{family}', {coef}, 'kg');")
            lines.append("    END IF;")

        lines.append("  END IF;")
        lines.append("")

    lines.append("END $$;")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    rm_lookup = load_rm_lookup()
    remapped = remap_foundation_bom()
    generated = generate_missing_boms(rm_lookup, rng)
    full_bom = pd.concat([remapped, generated], ignore_index=True)

    bom_path = GENERATED_DIR / "bom_clean.csv"
    full_bom.to_csv(bom_path, index=False)

    sql_path = GENERATED_DIR / "bom_seed.sql"
    generate_sql_seed(full_bom, sql_path)

    summary = {
        "total_bom_entries": len(full_bom),
        "fg_count": int(full_bom["fg_code"].nunique()),
        "rm_count": int(full_bom["rm_code"].nunique()),
        "remapped_entries": len(remapped),
        "generated_entries": len(generated),
        "category_counts": full_bom["fg_category"].value_counts().to_dict(),
        "avg_components_per_fg": round(len(full_bom) / full_bom["fg_code"].nunique(), 2),
    }
    summary_path = GENERATED_DIR / "bom_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Clean BOM: {bom_path} ({len(full_bom)} entries, {full_bom['fg_code'].nunique()} FGs)")
    print(f"SQL seed: {sql_path}")
    print(f"Summary: {summary_path}")
    for cat, cnt in full_bom["fg_category"].value_counts().items():
        print(f"  {cat}: {cnt} entries")


if __name__ == "__main__":
    main()
