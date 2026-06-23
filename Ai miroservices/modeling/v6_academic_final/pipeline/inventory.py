#!/usr/bin/env python3
"""Inventory legacy artifacts and data readiness (Phase 0)."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from pipeline.data_loader import wms_data_ready

ROOT = Path(__file__).resolve().parents[1]
MODELING_ROOT = ROOT.parent


def main() -> int:
    cfg_path = ROOT / "pipeline" / "config.yaml"
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))

    legacy_pkls = list(MODELING_ROOT.rglob("champion_model/model.pkl"))
    legacy_pkls += list(MODELING_ROOT.rglob("data/03_lgbm_model.pkl"))

    artifacts_root = (ROOT / cfg["paths"]["artifacts_root"]).resolve()
    artifact_dirs = list(artifacts_root.glob("**/*")) if artifacts_root.exists() else []

    wms_ready, wms_info = wms_data_ready(cfg)

    report = {
        "legacy_pkl_count": len(legacy_pkls),
        "legacy_pkls": [str(p) for p in legacy_pkls],
        "artifacts_root": str(artifacts_root),
        "artifact_entries": len([p for p in artifact_dirs if p.is_dir() and (p / "metadata.json").exists()]),
        "wms_data_ready": wms_ready,
        "wms_info": wms_info,
        "bootstrap_csv": str((ROOT / cfg["paths"]["bootstrap_csv"]).resolve()),
        "mlflow_experiment": cfg.get("experiment_name"),
    }

    out = ROOT / "pipeline" / "inventory_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
