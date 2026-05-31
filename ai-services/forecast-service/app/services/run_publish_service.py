from __future__ import annotations

from datetime import datetime
import threading
import time

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import ForecastMetric, ForecastRun, PublishJob
from app.services.forecast_service import ingest_snapshot, ingest_snapshot_test_metrics_only, publish_online
from app.services.retention_service import apply_retention_policy
from app.services.run_summary_service import upsert_run_summary


def _assert_publish_completeness(db, run: ForecastRun, path_used: str) -> None:
    summary = upsert_run_summary(db, run.id)
    if summary is None:
        raise RuntimeError("publish completeness check failed: missing run summary")

    min_preds = max(1, int(settings.publish_min_prediction_rows or 1))
    min_inv = max(0, int(settings.publish_min_inventory_rows or 0))
    errors: list[str] = []

    if int(summary.forecast_rows or 0) < min_preds:
        errors.append(f"forecast_rows<{min_preds} (actual={summary.forecast_rows})")
    if int(summary.inventory_rows or 0) < min_inv:
        errors.append(f"inventory_rows<{min_inv} (actual={summary.inventory_rows})")

    if bool(settings.publish_require_test_metrics):
        test_rows = db.execute(
            select(ForecastMetric).where(
                ForecastMetric.run_id == run.id,
                ForecastMetric.split == "test",
            )
        ).scalars().all()
        if not test_rows:
            errors.append("missing_test_metrics")
        elif bool(settings.publish_require_non_null_test_kpis):
            has_non_null = any(
                (m.wape is not None) or (m.rmse is not None) or (m.mase_mean is not None) or (m.bias is not None)
                for m in test_rows
            )
            if not has_non_null:
                errors.append("test_metrics_have_no_non_null_kpis")

    if errors:
        raise RuntimeError(
            f"publish completeness failed for run_id={run.id} path={path_used}: "
            + ", ".join(errors)
        )


def execute_publish_for_run(db, run: ForecastRun, mode_norm: str) -> dict:
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
                raise RuntimeError(f"online publish failed: {ex}") from ex
            warnings.append(f"online publish failed; falling back to snapshot: {ex}")

    if path_used != "online":
        snapshot_result = ingest_snapshot(db, run)
        path_used = "snapshot"
    elif bool(settings.publish_require_test_metrics):
        # Online path may not generate evaluation metrics; backfill test metrics from report package.
        ingest_snapshot_test_metrics_only(db, run)

    _assert_publish_completeness(db, run, path_used)
    run.status = "published"
    if warnings:
        prior = (run.notes or "").strip()
        append = " | ".join(warnings)
        run.notes = f"{prior} | {append}" if prior else append
    upsert_run_summary(db, run.id)
    apply_retention_policy(db)

    return {
        "run_id": run.id,
        "status": run.status,
        "mode_requested": mode_norm,
        "path_used": path_used,
        "online_result": online_result,
        "snapshot_result": snapshot_result,
        "warnings": warnings,
    }


class PublishQueueWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="publish-queue-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _run(self) -> None:
        poll = max(0.2, float(settings.publish_queue_poll_interval_seconds or 1.0))
        while not self._stop.is_set():
            try:
                processed = self._process_one()
            except Exception:
                processed = False
            if not processed:
                time.sleep(poll)

    def _process_one(self) -> bool:
        db = SessionLocal()
        try:
            job = db.execute(
                select(PublishJob).where(PublishJob.status == "queued").order_by(PublishJob.id.asc()).limit(1)
            ).scalar_one_or_none()
            if job is None:
                return False

            run = db.get(ForecastRun, job.run_id)
            if run is None:
                job.status = "failed"
                job.error = "run_not_found"
                job.finished_at = datetime.utcnow()
                db.commit()
                return True

            job.status = "processing"
            job.started_at = datetime.utcnow()
            run.status = "publishing"
            db.commit()

            try:
                execute_publish_for_run(db, run, (job.mode or "auto").strip().lower())
                job.status = "succeeded"
                job.error = None
                job.finished_at = datetime.utcnow()
                db.commit()
            except Exception as ex:
                run.status = "failed"
                prior = (run.notes or "").strip()
                msg = f"publish_failed: {ex}"
                run.notes = f"{prior} | {msg}" if prior else msg
                job.status = "failed"
                job.error = str(ex)
                job.finished_at = datetime.utcnow()
                db.commit()
            return True
        finally:
            db.close()
