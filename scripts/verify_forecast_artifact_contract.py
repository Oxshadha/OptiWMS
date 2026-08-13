#!/usr/bin/env python3
"""Fail CI when the packaged model, loader, service, and UI bindings diverge."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "dataset": "PROJECT_OPS_RM_PM",
    "model": "PROJECT_OPS_EXTRA_TREES_CAUSAL",
    "version": "PROJECT_OPERATIONAL_SIMULATION_V8",
}


def require_text(path: Path, value: str) -> None:
    text = path.read_text(encoding="utf-8")
    if value not in text:
        raise SystemExit(f"{path.relative_to(ROOT)} does not bind {value}")


metadata_path = ROOT / "Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs/serving_bundle/production/metadata.json"
model_path = metadata_path.with_name("model.pkl")
outputs_path = metadata_path.parents[2]
lock = json.loads((ROOT / "scripts/forecast-artifact.lock.json").read_text(encoding="utf-8"))
metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
if metadata.get("dataset") != EXPECTED["dataset"] or metadata.get("model_name") != EXPECTED["model"]:
    raise SystemExit("Serving-bundle metadata disagrees with the canonical binding")
if metadata.get("horizons") != list(range(1, 13)) or not metadata.get("project_operational_decision_eligible"):
    raise SystemExit("Serving bundle is not the decision-eligible H1-H12 model")

checks = [
    ROOT / "scripts/load_project_operational_simulation.py",
    ROOT / "ai_services/forecast-service/app/core/config.py",
    ROOT / "ai_services/forecast-service/app/services/forecast_provider.py",
    ROOT / "frontend/app/admin/forecasts/page.tsx",
]
for path in checks:
    require_text(path, EXPECTED["dataset"])
    require_text(path, EXPECTED["model"])
require_text(checks[0], EXPECTED["version"])

loader_inputs = [
    "data/materials.csv",
    "data/finished_goods.csv",
    "data/bom_components.csv",
    "data/material_demand.csv",
    "data/production_plan_actuals.csv",
    "data/initial_inventory.csv",
    "inventory_policy_simulation.csv",
    "operational_forecasts.csv",
    "champion_prediction_intervals.csv",
    "operational_backtest_metrics.csv",
    "physical_materials.csv",
    "physical_classifications.csv",
    "physical_layout.csv.gz",
    "location_assignments.csv.gz",
    "physical_inventory.csv.gz",
    "storage_slotting_validation.csv",
]
loader_digest = hashlib.sha256()
for path in sorted(outputs_path / item for item in loader_inputs):
    loader_digest.update(path.name.encode())
    loader_digest.update(path.read_bytes())
loader_digest = loader_digest.hexdigest()
source_digest = hashlib.sha256((outputs_path / "data/material_demand.csv").read_bytes()).hexdigest()
model_digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
if not all(re.fullmatch(r"[0-9a-f]{64}", value) for value in (loader_digest, source_digest, model_digest)):
    raise SystemExit("Could not calculate the serving-bundle checksum")
actual = {
    "dataset": metadata["dataset"],
    "datasetVersion": EXPECTED["version"],
    "model": metadata["model_name"],
    "loaderDatasetSha256": loader_digest,
    "trainingSourceSha256": source_digest,
    "modelSha256": model_digest,
}
if actual != lock:
    raise SystemExit(
        "Forecast artifacts disagree with scripts/forecast-artifact.lock.json:\n"
        + json.dumps({"expected": lock, "actual": actual}, indent=2)
    )
if metadata.get("source_sha256") != source_digest:
    raise SystemExit("Serving metadata training-source checksum does not match material_demand.csv")
print(json.dumps({**actual, "status": "ok"}, indent=2))
