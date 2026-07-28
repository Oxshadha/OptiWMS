from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
BASELINE = ROOT.parent / "project_operational_baseline" / "outputs"


def test_v8_physical_population_is_complete_and_reuses_the_colombo_layout():
    materials = pd.read_csv(OUT / "physical_materials.csv")
    layout = pd.read_csv(OUT / "physical_layout.csv.gz")
    baseline_layout = pd.read_csv(BASELINE / "locations.csv.gz")
    assignments = pd.read_csv(OUT / "location_assignments.csv.gz")
    requirements = pd.read_csv(OUT / "storage_capacity_requirements.csv")

    assert len(materials) == materials.material_code.nunique() == 144
    assert materials.material_type.value_counts().to_dict() == {
        "raw_material": 90,
        "packaging_material": 30,
        "product": 24,
    }
    physical = [
        "length_cm", "width_cm", "height_cm", "weight_kg", "volume_cm3",
        "units_per_pallet", "pallet_spaces", "pallet_weight_kg", "pallet_volume_cm3",
    ]
    assert materials[physical].gt(0).all().all()
    assert set(baseline_layout.location_code).issubset(set(layout.location_code))
    assert len(layout) == 4206
    assert layout.location_code.nunique() == len(layout)
    assert assignments.location_code.nunique() == len(assignments) == 3257
    assert assignments.material_code.nunique() == 144
    assert assignments.groupby("material_code").size().sort_index().equals(
        requirements.set_index("material_code").required_positions.sort_index()
    )


def test_v8_assignments_obey_all_physical_and_class_constraints():
    materials = pd.read_csv(OUT / "physical_materials.csv")
    locations = pd.read_csv(OUT / "physical_layout.csv.gz")
    assignments = pd.read_csv(OUT / "location_assignments.csv.gz")
    inventory = pd.read_csv(OUT / "physical_inventory.csv.gz")
    requirements = pd.read_csv(OUT / "storage_capacity_requirements.csv")

    joined = (
        assignments.merge(materials, on=["material_code", "material_type"])
        .merge(locations, on="location_code", suffixes=("_material", "_location"))
    )
    primary = assignments.loc[assignments.assignment_role.eq("PRIMARY_PICK_FACE")]
    assert primary.groupby("material_code").size().eq(1).all()
    assert set(primary.location_code).issubset(
        set(locations.loc[locations.zone_type.eq("PICK_FACE"), "location_code"])
    )
    assert joined.pallet_weight_kg.le(joined.max_weight_kg + 1e-6).all()
    assert joined.pallet_volume_cm3.le(joined.max_volume_cm3 + 1e-6).all()
    assert joined.amalgamated_class_x.str[0].eq(joined.physical_class.str[0]).all()
    assert (
        ~joined.temperature_controlled | joined.temperature_zone.eq("CONTROLLED")
    ).all()
    assert (~joined.hazardous | joined.hazard_allowed).all()
    assert np.allclose(
        inventory.groupby("material_code").quantity.sum().sort_index(),
        requirements.set_index("material_code").current_on_hand.sort_index(),
        atol=0.01,
    )
