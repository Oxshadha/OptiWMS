from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastRun
from app.services.forecast_service import ingest_snapshot, publish_online
from app.services.model_registry_service import resolve_champion_model

router = APIRouter(prefix="/runs", tags=["runs"])


class RunCreate(BaseModel):
    dataset: str
    model_name: str = "AUTO"
    model_version: str = "v1"
    warehouse_id: str | None = None
    notes: str | None = None


@router.post("")
def create_run(payload: RunCreate, db: Session = Depends(get_db)):
    requested_model = (payload.model_name or "").strip()
    if not requested_model or requested_model.upper() == "AUTO":
        resolved_model_name, resolved_model_version = resolve_champion_model(
            db=db,
            dataset=payload.dataset,
            warehouse_id=payload.warehouse_id,
        )
    else:
        resolved_model_name, resolved_model_version = requested_model, payload.model_version

    run = ForecastRun(
        dataset=payload.dataset,
        model_name=resolved_model_name,
        model_version=resolved_model_version,
        warehouse_id=payload.warehouse_id,
        notes=payload.notes,
        status="created",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"id": run.id, "status": run.status}


@router.get("")
def list_runs(db: Session = Depends(get_db)):
    rows = db.execute(select(ForecastRun).order_by(ForecastRun.id.desc()).limit(100)).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "dataset": r.dataset,
                "model_name": r.model_name,
                "model_version": r.model_version,
                "warehouse_id": r.warehouse_id,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.post("/{run_id}/publish-snapshot")
def publish_snapshot(run_id: int, db: Session = Depends(get_db)):
    run = db.get(ForecastRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    inserted = ingest_snapshot(db, run)
    run.status = "published"
    db.commit()
    return {"run_id": run_id, "status": run.status, "inserted": inserted}


@router.post("/{run_id}/publish")
def publish_run(run_id: int, mode: str = "auto", db: Session = Depends(get_db)):
    run = db.get(ForecastRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    mode_norm = (mode or "auto").strip().lower()
    if mode_norm not in {"auto", "online", "snapshot"}:
        raise HTTPException(status_code=400, detail="mode must be one of: auto, online, snapshot")

    online_result: dict | None = None
    snapshot_result: dict | None = None
    path_used = "snapshot"
    warnings: list[str] = []

    if mode_norm in {"auto", "online"}:
        try:
            online_result = publish_online(db, run)
            if int(online_result.get("predictions", 0) or 0) > 0:
                path_used = "online"
            elif mode_norm == "online":
                raise RuntimeError("online publish returned zero predictions")
            else:
                warnings.append("online publish returned zero predictions; falling back to snapshot")
        except Exception as ex:
            if mode_norm == "online":
                raise HTTPException(status_code=400, detail=f"online publish failed: {ex}")
            warnings.append(f"online publish failed; falling back to snapshot: {ex}")

    if path_used != "online":
        snapshot_result = ingest_snapshot(db, run)
        path_used = "snapshot"

    run.status = "published"
    if warnings:
        prior = (run.notes or "").strip()
        append = " | ".join(warnings)
        run.notes = f"{prior} | {append}" if prior else append
    db.commit()

    return {
        "run_id": run_id,
        "status": run.status,
        "mode_requested": mode_norm,
        "path_used": path_used,
        "online_result": online_result,
        "snapshot_result": snapshot_result,
        "warnings": warnings,
    }
