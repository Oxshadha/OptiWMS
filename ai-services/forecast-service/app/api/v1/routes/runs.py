from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastRun
from app.services.forecast_service import ingest_snapshot

router = APIRouter(prefix="/runs", tags=["runs"])


class RunCreate(BaseModel):
    dataset: str
    model_name: str
    model_version: str = "v1"
    notes: str | None = None


@router.post("")
def create_run(payload: RunCreate, db: Session = Depends(get_db)):
    run = ForecastRun(
        dataset=payload.dataset,
        model_name=payload.model_name,
        model_version=payload.model_version,
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

    inserted = ingest_snapshot(db, run_id)
    run.status = "published"
    db.commit()
    return {"run_id": run_id, "status": run.status, "inserted": inserted}
