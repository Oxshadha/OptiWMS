from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastRun, PublishJob
from app.services.forecast_service import ingest_snapshot
from app.services.model_registry_service import resolve_champion_model
from app.services.run_summary_service import upsert_run_summary
from app.services.run_publish_service import execute_publish_for_run

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

    active_stmt = select(ForecastRun).where(
        ForecastRun.dataset == payload.dataset,
        ForecastRun.model_name == resolved_model_name,
        ForecastRun.status.in_(["created", "publishing"]),
    )
    if payload.warehouse_id is None:
        active_stmt = active_stmt.where(ForecastRun.warehouse_id.is_(None))
    else:
        active_stmt = active_stmt.where(ForecastRun.warehouse_id == payload.warehouse_id)
    existing_active = db.execute(active_stmt.order_by(ForecastRun.id.desc()).limit(1)).scalar_one_or_none()
    if existing_active:
        return {"id": existing_active.id, "status": existing_active.status, "reused": True}

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
    return {"id": run.id, "status": run.status, "reused": False}


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
                "notes": r.notes,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.get("/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(ForecastRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return {
        "id": run.id,
        "dataset": run.dataset,
        "model_name": run.model_name,
        "model_version": run.model_version,
        "warehouse_id": run.warehouse_id,
        "status": run.status,
        "notes": run.notes,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/{run_id}/jobs")
def get_run_jobs(run_id: int, db: Session = Depends(get_db)):
    run = db.get(ForecastRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    rows = db.execute(
        select(PublishJob).where(PublishJob.run_id == run_id).order_by(PublishJob.id.desc()).limit(20)
    ).scalars().all()
    return {
        "items": [
            {
                "id": j.id,
                "run_id": j.run_id,
                "mode": j.mode,
                "status": j.status,
                "error": j.error,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            }
            for j in rows
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
    upsert_run_summary(db, run.id)
    db.commit()
    return {"run_id": run_id, "status": run.status, "inserted": inserted}


@router.post("/{run_id}/publish")
def publish_run(run_id: int, mode: str = "auto", async_run: bool = True, db: Session = Depends(get_db)):
    run = db.get(ForecastRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    mode_norm = (mode or "auto").strip().lower()
    if mode_norm not in {"auto", "online", "snapshot"}:
        raise HTTPException(status_code=400, detail="mode must be one of: auto, online, snapshot")

    if run.status == "published":
        return {
            "run_id": run_id,
            "status": run.status,
            "mode_requested": mode_norm,
            "accepted": False,
            "message": "run already published",
        }
    if run.status == "publishing":
        return {
            "run_id": run_id,
            "status": run.status,
            "mode_requested": mode_norm,
            "accepted": True,
            "message": "run already publishing",
        }

    if async_run:
        run.status = "publishing"
        queued = db.execute(
            select(PublishJob).where(
                PublishJob.run_id == run_id,
                PublishJob.status.in_(["queued", "processing"]),
            ).order_by(PublishJob.id.desc()).limit(1)
        ).scalar_one_or_none()
        if queued is None:
            db.add(PublishJob(run_id=run_id, mode=mode_norm, status="queued"))
        db.commit()
        return {
            "run_id": run_id,
            "status": "publishing",
            "mode_requested": mode_norm,
            "accepted": True,
            "async": True,
        }

    result = execute_publish_for_run(db, run, mode_norm)
    db.commit()
    result["accepted"] = True
    result["async"] = False
    return result
