from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import ForecastRun, ForecastRunSummary, OperationalHealthSnapshot
from app.services.artifact_service import evaluate_acceptance_gate, evaluate_inference_alerts
from app.services.alerting_service import dispatch_operational_alert


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _calc_freshness(db) -> dict[str, Any]:
    latest_run = db.execute(
        select(ForecastRun).where(ForecastRun.status == "published").order_by(ForecastRun.id.desc()).limit(1)
    ).scalar_one_or_none()
    if latest_run is None or latest_run.created_at is None:
        return {"status": "critical", "reason": "no_published_runs", "age_minutes": None}

    created_at = latest_run.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_minutes = max(0.0, (_now_utc() - created_at).total_seconds() / 60.0)
    threshold = float(settings.freshness_max_age_minutes or 180.0)
    status = "ok" if age_minutes <= threshold else "warn"
    return {
        "status": status,
        "reason": "within_threshold" if status == "ok" else "stale_latest_run",
        "age_minutes": round(age_minutes, 2),
        "threshold_minutes": threshold,
        "latest_run_id": latest_run.id,
    }


def _calc_drift(db) -> dict[str, Any]:
    latest_two = db.execute(
        select(ForecastRunSummary)
        .where(ForecastRunSummary.avg_wape_test.is_not(None))
        .order_by(ForecastRunSummary.run_id.desc())
        .limit(2)
    ).scalars().all()
    if len(latest_two) < 2:
        return {"status": "unknown", "reason": "insufficient_history"}

    current = latest_two[0]
    baseline = latest_two[1]
    if int(current.forecast_rows or 0) < int(settings.drift_eval_min_rows or 200):
        return {"status": "unknown", "reason": "insufficient_eval_rows", "current_rows": int(current.forecast_rows or 0)}

    curr = float(current.avg_wape_test or 0.0)
    base = float(baseline.avg_wape_test or 0.0)
    if base <= 0:
        return {"status": "unknown", "reason": "invalid_baseline_wape", "current_wape": curr, "baseline_wape": base}
    increase_ratio = (curr - base) / base
    threshold = float(settings.drift_alert_wape_increase_ratio or 0.25)
    status = "warn" if increase_ratio > threshold else "ok"
    return {
        "status": status,
        "reason": "wape_regression" if status == "warn" else "stable",
        "current_run_id": current.run_id,
        "baseline_run_id": baseline.run_id,
        "current_wape": curr,
        "baseline_wape": base,
        "increase_ratio": round(increase_ratio, 6),
        "threshold_ratio": threshold,
    }


def compute_operational_health_snapshot(db) -> dict[str, Any]:
    inference = evaluate_inference_alerts(limit=200)
    drift = _calc_drift(db)
    freshness = _calc_freshness(db)

    statuses = {
        "inference": str(inference.get("status", "unknown")).lower(),
        "drift": str(drift.get("status", "unknown")).lower(),
        "freshness": str(freshness.get("status", "unknown")).lower(),
    }

    final = "ok"
    if "critical" in statuses.values():
        final = "critical"
    elif any(s in {"warn"} for s in statuses.values()):
        final = "warn"

    details = {
        "inference": inference,
        "drift": drift,
        "freshness": freshness,
    }
    snap = OperationalHealthSnapshot(
        status=final,
        drift_status=statuses["drift"],
        freshness_status=statuses["freshness"],
        inference_status=statuses["inference"],
        details_json=json.dumps(details),
    )
    db.add(snap)
    db.flush()
    return {
        "id": snap.id,
        "status": snap.status,
        "drift_status": snap.drift_status,
        "freshness_status": snap.freshness_status,
        "inference_status": snap.inference_status,
        "created_at": snap.created_at.isoformat() if snap.created_at else None,
        "details": details,
    }


def latest_operational_health(db) -> dict[str, Any]:
    row = db.execute(select(OperationalHealthSnapshot).order_by(OperationalHealthSnapshot.id.desc()).limit(1)).scalar_one_or_none()
    if not row:
        return {"status": "unknown", "details": {"reason": "no_snapshot_yet"}}
    details = {}
    if row.details_json:
        try:
            details = json.loads(row.details_json)
        except Exception:
            details = {"raw_details": row.details_json}
    return {
        "id": row.id,
        "status": row.status,
        "drift_status": row.drift_status,
        "freshness_status": row.freshness_status,
        "inference_status": row.inference_status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "details": details,
    }


def list_operational_health_history(db, limit: int = 50) -> dict[str, Any]:
    lim = max(1, min(int(limit or 50), 500))
    rows = db.execute(
        select(OperationalHealthSnapshot).order_by(OperationalHealthSnapshot.id.desc()).limit(lim)
    ).scalars().all()
    items: list[dict[str, Any]] = []
    for r in rows:
        item = {
            "id": r.id,
            "status": r.status,
            "drift_status": r.drift_status,
            "freshness_status": r.freshness_status,
            "inference_status": r.inference_status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        items.append(item)
    return {"count": len(items), "items": items}


class OperationalHealthWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_alert_status: str | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="operational-health-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _run(self) -> None:
        interval = max(10.0, float(settings.health_monitor_interval_seconds or 120.0))
        while not self._stop.is_set():
            db = SessionLocal()
            try:
                snapshot = compute_operational_health_snapshot(db)
                cutoff = _now_utc() - timedelta(days=7)
                old = db.execute(
                    select(OperationalHealthSnapshot).where(OperationalHealthSnapshot.created_at < cutoff)
                ).scalars().all()
                for row in old:
                    db.delete(row)
                db.commit()
                status = str(snapshot.get("status", "")).lower()
                if status and status != self._last_alert_status:
                    dispatch_operational_alert(snapshot)
                self._last_alert_status = status
            except Exception:
                db.rollback()
            finally:
                db.close()
            time.sleep(interval)
