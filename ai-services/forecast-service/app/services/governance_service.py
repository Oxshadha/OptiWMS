from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import ModelRegistryEntry
from app.services.model_registry_service import promote_champion
from app.services.production_readiness_service import evaluate_production_readiness

log = logging.getLogger(__name__)


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _find_entry(db, dataset: str, model_name: str) -> ModelRegistryEntry | None:
    return db.execute(
        select(ModelRegistryEntry)
        .where(
            ModelRegistryEntry.dataset == dataset,
            ModelRegistryEntry.status == "active",
            ModelRegistryEntry.model_name.ilike(model_name),
        )
        .order_by(ModelRegistryEntry.priority.asc(), ModelRegistryEntry.id.desc())
        .limit(1)
    ).scalar_one_or_none()


class GovernanceWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_action: dict[str, Any] = {
            "ts": None,
            "action": "none",
            "status": "idle",
            "message": "No governance action executed yet.",
        }
        self._lock = threading.Lock()

    def start(self) -> None:
        if not settings.governance_enabled:
            return
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="governance-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "enabled": bool(settings.governance_enabled),
                "interval_seconds": float(settings.governance_interval_seconds),
                "dataset": settings.governance_dataset,
                "model_name": settings.governance_model_name,
                "split": settings.governance_split,
                "inference_window": int(settings.governance_inference_window),
                "soak_hours": int(settings.governance_soak_hours),
                "auto_promote": bool(settings.governance_auto_promote),
                "auto_rollback": bool(settings.governance_auto_rollback),
                "rollback_model_name": settings.governance_rollback_model_name,
                "last_action": dict(self._last_action),
            }

    def _set_last_action(self, action: str, status: str, message: str, extra: dict[str, Any] | None = None) -> None:
        payload: dict[str, Any] = {
            "ts": _now_utc_iso(),
            "action": action,
            "status": status,
            "message": message,
        }
        if extra:
            payload.update(extra)
        with self._lock:
            self._last_action = payload

    def _run(self) -> None:
        interval = max(15.0, float(settings.governance_interval_seconds or 180.0))
        while not self._stop.is_set():
            db = SessionLocal()
            try:
                self.tick_once(db)
                db.commit()
            except Exception as ex:
                db.rollback()
                self._set_last_action("tick", "error", f"governance tick failed: {ex}")
                log.warning("governance tick failed: %s", ex)
            finally:
                db.close()
            time.sleep(interval)

    def tick_once(self, db) -> None:
        dataset = settings.governance_dataset
        model_name = settings.governance_model_name
        split = settings.governance_split
        inference_window = int(settings.governance_inference_window)
        soak_hours = int(settings.governance_soak_hours)

        readiness = evaluate_production_readiness(
            db=db,
            dataset=dataset,
            model_name=model_name,
            split=split,
            inference_window=inference_window,
            soak_hours=soak_hours,
        )
        latest_health = readiness.get("latest_operational_health") or {}
        health_status = str(latest_health.get("status", "unknown")).lower()

        if settings.governance_auto_rollback and health_status == "critical":
            rollback_model = settings.governance_rollback_model_name
            rollback_entry = _find_entry(db, dataset=dataset, model_name=rollback_model)
            if not rollback_entry:
                self._set_last_action(
                    "rollback",
                    "skipped",
                    f"critical health detected but rollback model '{rollback_model}' is not registered.",
                )
                return
            promote_champion(
                db=db,
                entry_id=int(rollback_entry.id),
                enforce_gate=False,
                split=split,
                inference_window=inference_window,
            )
            self._set_last_action(
                "rollback",
                "ok",
                f"promoted rollback model {rollback_entry.model_name}#{rollback_entry.id} due to critical health.",
                extra={"entry_id": int(rollback_entry.id)},
            )
            return

        if settings.governance_auto_promote and bool(readiness.get("ready")):
            entry = _find_entry(db, dataset=dataset, model_name=model_name)
            if not entry:
                self._set_last_action(
                    "autopromote",
                    "skipped",
                    f"readiness passed but model '{model_name}' has no active registry entry.",
                )
                return
            if int(entry.is_champion or 0) == 1:
                self._set_last_action(
                    "autopromote",
                    "noop",
                    f"model {entry.model_name}#{entry.id} is already champion.",
                    extra={"entry_id": int(entry.id)},
                )
                return
            promote_champion(
                db=db,
                entry_id=int(entry.id),
                enforce_gate=bool(settings.governance_enforce_gate_on_autopromote),
                split=split,
                inference_window=inference_window,
            )
            self._set_last_action(
                "autopromote",
                "ok",
                f"promoted model {entry.model_name}#{entry.id} after readiness gate pass.",
                extra={"entry_id": int(entry.id)},
            )
            return

        self._set_last_action(
            "tick",
            "ok",
            "no governance action required.",
            extra={"readiness_ready": bool(readiness.get("ready")), "health_status": health_status},
        )


governance_worker = GovernanceWorker()
