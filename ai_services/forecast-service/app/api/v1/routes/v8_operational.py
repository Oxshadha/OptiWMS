from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    ForecastMetric,
    ForecastPrediction,
    ForecastRun,
    ForecastRunSummary,
    InventoryRecommendation,
    ModelRegistryEntry,
)
from app.services.forecast_provider import reset_provider


router = APIRouter(prefix="/v8", tags=["v8-project-operational"])
_recalculation_lock = threading.Lock()
DATASET = "PROJECT_OPS_RM_PM"
MODEL_NAME = "PROJECT_OPS_EXTRA_TREES_CAUSAL"


def _run(command: list[str], timeout_seconds: int, cwd: Path | None = None) -> dict:
    completed = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        cwd=str(cwd) if cwd else None,
    )
    output = completed.stdout.strip()
    return json.loads(output) if output else {}


def _publish_service_snapshot(
    db: Session,
    output_dir: Path,
    warehouse_id: str,
) -> dict:
    forecasts = pd.read_csv(output_dir / "operational_forecasts.csv")
    metrics = pd.read_csv(output_dir / "operational_backtest_metrics.csv")
    policy = pd.read_csv(output_dir / "inventory_policy_simulation.csv")
    initial = pd.read_csv(output_dir / "data" / "initial_inventory.csv")

    run = ForecastRun(
        dataset=DATASET,
        model_name=MODEL_NAME,
        model_version="V8_CONTROLLED_EXTRA_TREES_CAUSAL",
        warehouse_id=warehouse_id,
        status="published",
        notes=(
            "Locked v8 recursive H1-H12 project-operational snapshot; "
            "synthetic_ratio=1.0; external population validity UNVERIFIED"
        ),
    )
    db.add(run)
    db.flush()

    for row in forecasts.itertuples(index=False):
        db.add(
            ForecastPrediction(
                run_id=run.id,
                dataset=DATASET,
                model_name=MODEL_NAME,
                warehouse_id=warehouse_id,
                sku=str(row.material_code),
                category=str(row.material_type),
                month=str(row.forecast_period),
                horizon=int(row.horizon),
                p10=float(row.p10),
                p50=float(row.p50),
                p90=float(row.p90),
                y_true=None,
            )
        )

    for row in metrics.itertuples(index=False):
        db.add(
            ForecastMetric(
                run_id=run.id,
                dataset=DATASET,
                model_name=MODEL_NAME,
                warehouse_id=warehouse_id,
                split=str(row.split),
                horizon=int(row.horizon),
                wape=float(row.WAPE),
                mase_mean=None,
                rmse=float(row.RMSE),
                bias=float(row.Bias),
            )
        )

    initial_map = dict(zip(initial["material_id"], initial["initial_on_hand"]))
    for row in policy.itertuples(index=False):
        on_hand = float(initial_map[int(row.material_id)])
        db.add(
            InventoryRecommendation(
                run_id=run.id,
                dataset=DATASET,
                model_name=MODEL_NAME,
                warehouse_id=warehouse_id,
                sku=str(row.material_code),
                category=str(row.material_type),
                safety_stock=float(row.safety_stock),
                reorder_point=float(row.reorder_point),
                target_max=float(row.proposed_max),
                on_hand_inventory=on_hand,
                suggested_order_qty=float(row.order_quantity),
            )
        )

    aggregate = metrics[metrics["horizon"].eq(0)].iloc[0]
    db.add(
        ForecastRunSummary(
            run_id=run.id,
            dataset=DATASET,
            model_name=MODEL_NAME,
            warehouse_id=warehouse_id,
            forecast_rows=int(len(forecasts)),
            metric_rows=int(len(metrics)),
            inventory_rows=int(len(policy)),
            sku_count=int(forecasts["material_code"].nunique()),
            horizon_count=int(forecasts["horizon"].nunique()),
            reorder_now_count=int((policy["order_quantity"] > 0).sum()),
            overstock_risk_count=int(
                (
                    policy["material_id"].map(initial_map)
                    > policy["proposed_max"]
                ).sum()
            ),
            total_suggested_order_qty=float(policy["order_quantity"].sum()),
            avg_wape_test=float(aggregate["WAPE"]),
            avg_rmse_test=float(aggregate["RMSE"]),
            avg_mase_test=None,
            avg_abs_bias_test=abs(float(aggregate["Bias"])),
            rmse_vs_avg_demand_pct=None,
        )
    )

    (
        db.query(ModelRegistryEntry)
        .filter(
            ModelRegistryEntry.dataset == DATASET,
            ModelRegistryEntry.warehouse_id == warehouse_id,
        )
        .update({"is_champion": 0}, synchronize_session=False)
    )
    registry = (
        db.query(ModelRegistryEntry)
        .filter(
            ModelRegistryEntry.dataset == DATASET,
            ModelRegistryEntry.warehouse_id == warehouse_id,
            ModelRegistryEntry.model_name == MODEL_NAME,
        )
        .one_or_none()
    )
    registry_metrics = json.dumps(
        {
            "recursive_test_WAPE": float(aggregate["WAPE"]),
            "recursive_test_Bias": float(aggregate["Bias"]),
            "external_population_validity": "UNVERIFIED",
        }
    )
    if registry is None:
        registry = ModelRegistryEntry(
            dataset=DATASET,
            warehouse_id=warehouse_id,
            model_name=MODEL_NAME,
            model_version="V8_CONTROLLED_EXTRA_TREES_CAUSAL",
            artifact_stage="production",
            status="active",
            is_champion=1,
            priority=1,
            metrics_json=registry_metrics,
            notes="Project-operational synthetic baseline champion",
        )
        db.add(registry)
    else:
        registry.status = "active"
        registry.is_champion = 1
        registry.priority = 1
        registry.metrics_json = registry_metrics
    db.commit()
    reset_provider()
    return {
        "run_id": run.id,
        "forecast_rows": int(len(forecasts)),
        "metric_rows": int(len(metrics)),
        "inventory_rows": int(len(policy)),
        "registry_champion": MODEL_NAME,
    }


@router.post("/recalculate")
def recalculate(
    dry_run: bool = False,
    warehouse_id: str = "WH-001",
    db: Session = Depends(get_db),
) -> dict:
    """Refit the locked v8 family, publish one coherent snapshot, and register it."""
    if not _recalculation_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A v8 recalculation is already running")

    project_root = Path(
        os.getenv(
            "V8_FORECAST_ROOT",
            "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/v8_controlled_synthetic_validation",
        )
    )
    repository_root = Path(
        os.getenv("OPTIWMS_REPOSITORY_ROOT", "/Users/k.e.oshada/Documents/OptiWMS")
    )
    database_url = os.getenv(
        "WMS_RUNTIME_DATABASE_URL",
        "postgresql://optiwms:optiwms@localhost:5434/optiwms",
    )
    try:
        forecast_result = _run(
            [
                sys.executable,
                "-m",
                "pipeline.operational_forecast",
                "--output",
                str(project_root / "outputs"),
            ],
            timeout_seconds=1800,
            cwd=project_root,
        )
        publish_command = [
            sys.executable,
            str(repository_root / "scripts" / "load_project_operational_simulation.py"),
            "--db-url",
            database_url,
            "--warehouse-code",
            warehouse_id,
        ]
        if dry_run:
            publish_command.append("--dry-run")
        wms_result = _run(
            publish_command,
            timeout_seconds=600,
            cwd=repository_root,
        )
        service_result = (
            {"status": "not_published_dry_run"}
            if dry_run
            else _publish_service_snapshot(db, project_root / "outputs", warehouse_id)
        )
        return {
            "ok": True,
            "status": "dry_run" if dry_run else "published",
            "dataset": DATASET,
            "model_name": MODEL_NAME,
            "forecast_result": forecast_result,
            "wms_result": wms_result,
            "forecast_service_result": service_result,
            "external_population_validity": "UNVERIFIED",
        }
    except subprocess.TimeoutExpired as exception:
        raise HTTPException(status_code=504, detail=f"v8 forecast step timed out: {exception.cmd}") from exception
    except subprocess.CalledProcessError as exception:
        detail = (exception.stderr or exception.stdout or str(exception))[-4000:]
        raise HTTPException(status_code=500, detail=f"v8 recalculation failed: {detail}") from exception
    finally:
        _recalculation_lock.release()
