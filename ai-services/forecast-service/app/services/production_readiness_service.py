from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ForecastRun, OperationalHealthSnapshot
from app.services.artifact_service import evaluate_acceptance_gate, evaluate_inference_alerts
from app.services.health_monitor_service import latest_operational_health
from app.services.runtime_contract_service import validate_runtime_contract


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def evaluate_production_readiness(
    db: Session,
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 500,
    soak_hours: int = 24,
) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    runtime_contract = validate_runtime_contract(force=False)
    contract_ok = str(runtime_contract.get("status", "")).lower() == "ok"
    checks.append(
        {
            "name": "runtime_contract_ok",
            "pass": contract_ok,
            "value": runtime_contract.get("status"),
            "details": runtime_contract,
        }
    )

    latest_run_stmt = select(ForecastRun).where(ForecastRun.status == "published").order_by(ForecastRun.id.desc()).limit(1)
    if dataset:
        latest_run_stmt = latest_run_stmt.where(ForecastRun.dataset == dataset)
    if model_name:
        latest_run_stmt = latest_run_stmt.where(func.lower(ForecastRun.model_name) == model_name.lower())
    latest_run = db.execute(latest_run_stmt).scalar_one_or_none()
    run_ok = latest_run is not None
    checks.append(
        {
            "name": "latest_published_run_exists",
            "pass": run_ok,
            "value": latest_run.id if latest_run else None,
        }
    )

    gate = evaluate_acceptance_gate(
        dataset=dataset,
        model_name=model_name,
        split=split,
        inference_window=inference_window,
    )
    gate_ready = bool(gate.get("ready"))
    checks.append({"name": "acceptance_gate_ready", "pass": gate_ready, "value": gate.get("ready"), "details": gate})

    alerts = evaluate_inference_alerts(limit=inference_window, dataset=dataset, model_name=model_name)
    alerts_ok = str(alerts.get("status", "")).lower() != "critical"
    checks.append({"name": "inference_not_critical", "pass": alerts_ok, "value": alerts.get("status"), "details": alerts})

    since = _utc_now() - timedelta(hours=max(1, int(soak_hours or 24)))
    since_naive = since.replace(tzinfo=None)
    critical_count = db.execute(
        select(func.count(OperationalHealthSnapshot.id)).where(
            OperationalHealthSnapshot.created_at >= since_naive,
            OperationalHealthSnapshot.status == "critical",
        )
    ).scalar_one()
    soak_ok = int(critical_count or 0) == 0
    checks.append(
        {
            "name": "soak_window_no_critical",
            "pass": soak_ok,
            "value": int(critical_count or 0),
            "threshold": 0,
            "window_hours": max(1, int(soak_hours or 24)),
        }
    )

    latest_health = latest_operational_health(db)
    ready = all(bool(c.get("pass")) for c in checks)
    return {
        "ready": ready,
        "dataset": dataset,
        "model_name": model_name,
        "split": split,
        "inference_window": inference_window,
        "soak_hours": max(1, int(soak_hours or 24)),
        "checks": checks,
        "latest_operational_health": latest_health,
    }
