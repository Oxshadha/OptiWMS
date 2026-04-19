from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ModelRegistryEntry
from app.services.model_registry_service import list_registry_entries, promote_champion, resolve_champion_model
from app.services.artifact_service import evaluate_acceptance_gate
from app.services.production_readiness_service import evaluate_production_readiness

router = APIRouter(prefix="/model-registry", tags=["model-registry"])


class RegistryCreatePayload(BaseModel):
    dataset: str = Field(min_length=1, max_length=32)
    warehouse_id: str | None = None
    model_name: str = Field(min_length=1, max_length=64)
    model_version: str = Field(default="v1", min_length=1, max_length=64)
    artifact_stage: str = Field(default="production", min_length=1, max_length=32)
    status: str = Field(default="active", min_length=1, max_length=32)
    is_champion: bool = False
    priority: int = 100
    metrics: dict | None = None
    notes: str | None = None


class PromotionPayload(BaseModel):
    entry_id: int
    split: str = "test"
    inference_window: int = 500
    enforce_gate: bool | None = None


@router.get("")
def list_entries(
    dataset: str | None = None,
    warehouse_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    rows = list_registry_entries(db=db, dataset=dataset, warehouse_id=warehouse_id, status=status)
    return {
        "items": [
            {
                "id": r.id,
                "dataset": r.dataset,
                "warehouse_id": r.warehouse_id,
                "model_name": r.model_name,
                "model_version": r.model_version,
                "artifact_stage": r.artifact_stage,
                "status": r.status,
                "is_champion": bool(r.is_champion),
                "priority": r.priority,
                "metrics": json.loads(r.metrics_json) if r.metrics_json else None,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.get("/champion")
def get_champion(
    dataset: str,
    warehouse_id: str | None = None,
    db: Session = Depends(get_db),
):
    model_name, model_version = resolve_champion_model(db=db, dataset=dataset, warehouse_id=warehouse_id)
    return {
        "dataset": dataset,
        "warehouse_id": warehouse_id,
        "model_name": model_name,
        "model_version": model_version,
    }


@router.post("")
def create_entry(payload: RegistryCreatePayload, db: Session = Depends(get_db)):
    entry = ModelRegistryEntry(
        dataset=payload.dataset,
        warehouse_id=payload.warehouse_id,
        model_name=payload.model_name,
        model_version=payload.model_version,
        artifact_stage=payload.artifact_stage,
        status=payload.status,
        is_champion=1 if payload.is_champion else 0,
        priority=payload.priority,
        metrics_json=json.dumps(payload.metrics) if payload.metrics is not None else None,
        notes=payload.notes,
    )
    db.add(entry)
    db.flush()

    # Keep champion unique per dataset+warehouse scope.
    if payload.is_champion:
        try:
            promote_champion(db=db, entry_id=entry.id)
        except Exception as ex:
            raise HTTPException(status_code=400, detail=f"failed to promote champion: {ex}")

    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "ok": True}


@router.post("/promote")
def promote(payload: PromotionPayload, db: Session = Depends(get_db)):
    try:
        entry = promote_champion(
            db=db,
            entry_id=payload.entry_id,
            enforce_gate=payload.enforce_gate,
            split=payload.split,
            inference_window=payload.inference_window,
        )
    except ValueError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

    db.commit()
    return {
        "ok": True,
        "entry_id": entry.id,
        "dataset": entry.dataset,
        "warehouse_id": entry.warehouse_id,
        "model_name": entry.model_name,
        "model_version": entry.model_version,
    }


@router.get("/promotion-check")
def promotion_check(
    entry_id: int,
    split: str = "test",
    inference_window: int = 500,
    include_readiness: bool = True,
    soak_hours: int = 24,
    db: Session = Depends(get_db),
):
    entry = db.get(ModelRegistryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="registry entry not found")
    gate = evaluate_acceptance_gate(
        dataset=entry.dataset,
        model_name=entry.model_name,
        split=split,
        inference_window=inference_window,
    )
    out = {
        "entry_id": entry.id,
        "dataset": entry.dataset,
        "model_name": entry.model_name,
        "model_version": entry.model_version,
        "gate": gate,
    }
    if include_readiness:
        out["readiness"] = evaluate_production_readiness(
            db=db,
            dataset=entry.dataset,
            model_name=entry.model_name,
            split=split,
            inference_window=inference_window,
            soak_hours=soak_hours,
        )
    return out
