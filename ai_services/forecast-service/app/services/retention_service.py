from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ForecastMetric, ForecastPrediction, ForecastRun, ForecastRunSummary, InventoryRecommendation, PublishJob


def apply_retention_policy(db: Session) -> dict[str, int]:
    deleted_runs = 0
    max_runs = max(5, int(settings.retention_max_runs_per_scope))
    max_age_days = max(1, int(settings.retention_max_run_age_days))
    cutoff = datetime.utcnow() - timedelta(days=max_age_days)

    scope_rows = db.execute(select(ForecastRun.dataset, ForecastRun.model_name, ForecastRun.warehouse_id).distinct()).all()
    for dataset, model_name, warehouse_id in scope_rows:
        stmt = select(ForecastRun).where(
            ForecastRun.dataset == dataset,
            ForecastRun.model_name == model_name,
            ForecastRun.warehouse_id == warehouse_id,
            ForecastRun.status.in_(["published", "failed"]),
        ).order_by(ForecastRun.id.desc())
        runs = db.execute(stmt).scalars().all()
        keep_ids = {r.id for r in runs[:max_runs] if r.created_at and r.created_at >= cutoff}
        if len(keep_ids) < max_runs:
            keep_ids |= {r.id for r in runs[:max_runs]}

        for run in runs:
            if run.id in keep_ids:
                continue
            db.query(ForecastPrediction).filter(ForecastPrediction.run_id == run.id).delete(synchronize_session=False)
            db.query(ForecastMetric).filter(ForecastMetric.run_id == run.id).delete(synchronize_session=False)
            db.query(InventoryRecommendation).filter(InventoryRecommendation.run_id == run.id).delete(synchronize_session=False)
            db.query(ForecastRunSummary).filter(ForecastRunSummary.run_id == run.id).delete(synchronize_session=False)
            db.query(PublishJob).filter(PublishJob.run_id == run.id).delete(synchronize_session=False)
            db.delete(run)
            deleted_runs += 1

    db.flush()
    return {"deleted_runs": deleted_runs}
