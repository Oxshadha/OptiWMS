from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ForecastRun, ModelRegistryEntry
from app.services.artifact_service import evaluate_acceptance_gate, evaluate_inference_alerts
from app.services.health_monitor_service import latest_operational_health, list_operational_health_history
from app.services.production_readiness_service import evaluate_production_readiness
from app.services.runtime_contract_service import validate_runtime_contract


def _latest_published_run(db: Session, dataset: str | None, model_name: str | None) -> dict[str, Any] | None:
    stmt = select(ForecastRun).where(ForecastRun.status == "published").order_by(ForecastRun.id.desc()).limit(1)
    if dataset:
        stmt = stmt.where(ForecastRun.dataset == dataset)
    if model_name:
        stmt = stmt.where(ForecastRun.model_name.ilike(model_name))
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        return None
    return {
        "id": row.id,
        "dataset": row.dataset,
        "model_name": row.model_name,
        "model_version": row.model_version,
        "warehouse_id": row.warehouse_id,
        "status": row.status,
        "notes": row.notes,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _registry_entries(db: Session, dataset: str | None, model_name: str | None) -> list[dict[str, Any]]:
    stmt = select(ModelRegistryEntry).order_by(ModelRegistryEntry.id.desc())
    if dataset:
        stmt = stmt.where(ModelRegistryEntry.dataset == dataset)
    if model_name:
        stmt = stmt.where(ModelRegistryEntry.model_name.ilike(model_name))
    rows = db.execute(stmt.limit(25)).scalars().all()
    return [
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
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


def build_release_evidence_bundle(
    db: Session,
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 200,
    soak_hours: int = 24,
    history_limit: int = 100,
) -> dict[str, Any]:
    runtime_contract = validate_runtime_contract(force=False)
    acceptance_gate = evaluate_acceptance_gate(
        dataset=dataset,
        model_name=model_name,
        split=split,
        inference_window=inference_window,
    )
    production_readiness = evaluate_production_readiness(
        db=db,
        dataset=dataset,
        model_name=model_name,
        split=split,
        inference_window=inference_window,
        soak_hours=soak_hours,
    )
    inference_alerts = evaluate_inference_alerts(
        limit=inference_window,
        dataset=dataset,
        model_name=model_name,
    )
    latest_health = latest_operational_health(db)
    health_history = list_operational_health_history(db, limit=history_limit)
    latest_run = _latest_published_run(db, dataset=dataset, model_name=model_name)
    registry = _registry_entries(db, dataset=dataset, model_name=model_name)

    return {
        "dataset": dataset,
        "model_name": model_name,
        "split": split,
        "inference_window": inference_window,
        "soak_hours": soak_hours,
        "runtime_contract": runtime_contract,
        "acceptance_gate": acceptance_gate,
        "production_readiness": production_readiness,
        "inference_alerts": inference_alerts,
        "latest_operational_health": latest_health,
        "operational_health_history": health_history,
        "latest_published_run": latest_run,
        "registry_entries": registry,
    }

