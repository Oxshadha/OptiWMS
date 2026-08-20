#!/usr/bin/env python3
"""Promote v6 MLflow / local run artifacts to forecast-service production layout."""

from __future__ import annotations

import argparse
import json
import os
import pickle
import shutil
import sys
from pathlib import Path

import yaml

_V6_ROOT = Path(__file__).resolve().parents[1]
if str(_V6_ROOT) not in sys.path:
    sys.path.insert(0, str(_V6_ROOT))


def _load_config(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (_V6_ROOT / p).resolve()


def _latest_run_dir() -> Path:
    runs = sorted((_V6_ROOT / "pipeline" / "runs").glob("*"), reverse=True)
    if not runs:
        raise FileNotFoundError("No training runs found under pipeline/runs/")
    return runs[0]


def _copy_horizon_artifacts(run_dir: Path, artifacts_root: Path, cfg: dict) -> list[Path]:
    dataset = cfg.get("dataset", "P")
    model_name = cfg.get("model_name", "LIGHTGBM").lower()
    stage = cfg.get("artifact_stage", "production")
    exported: list[Path] = []

    for hdir in sorted(p for p in run_dir.glob("h[0-9]*") if p.is_dir()):
        horizon = int(hdir.name[1:])
        target = artifacts_root / dataset / f"{model_name}_h{horizon}" / stage
        target.mkdir(parents=True, exist_ok=True)

        for src_name, dst_name in [
            ("model.pkl", "model.pkl"),
            ("model.txt", "model.txt"),
            ("metadata.json", "metadata.json"),
        ]:
            src = hdir / src_name
            if src.exists():
                shutil.copy2(src, target / dst_name)

        for qfile in hdir.glob("model_q*.pkl"):
            shutil.copy2(qfile, target / qfile.name)

        exported.append(target)
        print(f"Exported h{horizon} -> {target}")
    return exported


def _transition_mlflow_stage(cfg: dict, run_id: str | None, stage: str = "Production") -> None:
    try:
        import mlflow
        from mlflow.tracking import MlflowClient
    except ImportError:
        return

    reg_name = cfg.get("registered_model_name", "optiwms-forecast-lightgbm")
    tracking = os.getenv("MLFLOW_TRACKING_URI", f"sqlite:///{_V6_ROOT / 'mlruns' / 'mlflow.db'}")
    os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
    mlflow.set_tracking_uri(tracking)
    client = MlflowClient()

    versions = client.search_model_versions(f"name='{reg_name}'")
    if not versions and run_id:
        try:
            mlflow.register_model(f"runs:/{run_id}/lightgbm_h1", reg_name)
            versions = client.search_model_versions(f"name='{reg_name}'")
        except Exception as exc:
            print(f"MLflow register skipped: {exc}")
            return

    if not versions:
        print("No MLflow model versions to transition")
        return

    latest = max(versions, key=lambda v: int(v.version))
    client.transition_model_version_stage(reg_name, latest.version, stage, archive_existing_versions=True)
    print(f"MLflow {reg_name} v{latest.version} -> {stage}")


def _write_champion_seed(artifacts_root: Path, cfg: dict, run_dir: Path) -> Path:
    meta_path = run_dir / "h1" / "metadata.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    seed = {
        "dataset": cfg.get("dataset", "P"),
        "model_name": cfg.get("model_name", "LIGHTGBM"),
        "champion_horizon": 1,
        "training_source": meta.get("training_source", "bootstrap"),
        "mlflow_run_id": meta.get("mlflow_run_id"),
        "promoted_at": run_dir.name,
    }
    out = artifacts_root / "champion_seed.json"
    out.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    return out


def promote(run_dir: Path | None, cfg: dict, mlflow_stage: str = "Production") -> dict:
    if run_dir is None:
        run_dir = _latest_run_dir()

    artifacts_root = _resolve(cfg["paths"]["artifacts_root"])
    artifacts_root.mkdir(parents=True, exist_ok=True)

    exported = _copy_horizon_artifacts(run_dir, artifacts_root, cfg)
    seed_path = _write_champion_seed(artifacts_root, cfg, run_dir)

    summary_path = run_dir / "summary.json"
    run_id = None
    if summary_path.exists():
        run_id = json.loads(summary_path.read_text(encoding="utf-8")).get("mlflow_run_id")

    _transition_mlflow_stage(cfg, run_id, stage=mlflow_stage)

    result = {
        "run_dir": str(run_dir),
        "artifacts_root": str(artifacts_root),
        "horizons_exported": len(exported),
        "champion_seed": str(seed_path),
        "mlflow_run_id": run_id,
    }
    print(json.dumps(result, indent=2))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote v6 models to forecast-service artifacts")
    parser.add_argument("--config", default=str(_V6_ROOT / "pipeline" / "config.yaml"))
    parser.add_argument("--run-dir", default=None, help="Training run directory (default: latest)")
    parser.add_argument("--mlflow-stage", default="Production")
    args = parser.parse_args()

    cfg = _load_config(Path(args.config))
    run_dir = Path(args.run_dir) if args.run_dir else None
    promote(run_dir, cfg, mlflow_stage=args.mlflow_stage)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
