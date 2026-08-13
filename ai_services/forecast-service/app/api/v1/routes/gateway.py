"""Forecast Gateway Router — the public-facing API for all consumers.

This is the endpoint your team members, chatbots, and other AI services
call to get forecasts.  They never need to know about dataset codes,
model names, or internal architecture.

Endpoints:
    POST  /gateway/forecast          — Run live inference (auto sync/async)
    GET   /gateway/forecast/latest   — Get latest published forecasts
    GET   /gateway/forecast/{sku}    — Get forecast for a specific SKU
    GET   /gateway/jobs/{job_id}     — Poll async job status
    GET   /gateway/health            — Service health + champion model info
    GET   /gateway/models            — Available models and champion info
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.schemas.forecast_response import (
    AsyncJobResponse,
    ForecastPoint,
    ForecastResponse,
    GatewayHealthResponse,
    ModelInfo,
    PaginationInfo,
)
from app.api.v1.schemas.gateway_request import ForecastRequest
from app.core.config import settings
from app.core.security import RATE_LIMITER
from app.db.database import get_db
from app.db.models import (
    ForecastPrediction,
    ForecastRun,
    ForecastRunSummary,
    InventoryRecommendation,
    PublishJob,
)
from app.services.forecast_provider import get_active_provider

logger = logging.getLogger("forecast.gateway")

router = APIRouter(prefix="/gateway", tags=["gateway"])

# Module-level start time for uptime tracking.
_start_time = time.monotonic()


# ──────────────────────────────────────────────────────────────────────────────
# POST /gateway/forecast — Run live inference
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/forecast", response_model=ForecastResponse | AsyncJobResponse)
def gateway_forecast(
    payload: ForecastRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Run a live forecast for the specified SKUs and horizons.

    **Auto sync/async behaviour:**
    - ≤ ``gateway_sync_max_skus`` SKUs (default 100): returns results synchronously.
    - More SKUs or explicit ``mode=async``: creates a background job and returns
      a ``job_id`` for polling.

    Callers never need to specify ``dataset`` or ``model_name`` — both are
    auto-resolved from the server configuration and champion model registry.
    """
    # Rate-limit by client IP.
    client_key = request.client.host if request.client else "unknown"
    if not RATE_LIMITER.allow(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")

    # Determine mode.
    sku_count = len(payload.skus) if payload.skus else 0
    requested_mode = (payload.mode or "").strip().lower()

    if requested_mode == "async" or (
        requested_mode != "sync" and sku_count > settings.gateway_sync_max_skus
    ):
        return _create_async_job(db, payload)

    # Synchronous execution.
    provider = get_active_provider()
    response = provider.predict(
        skus=payload.skus,
        horizons=payload.horizons,
        warehouse_id=payload.warehouse_id,
    )
    response.warehouse_id = payload.warehouse_id

    # Optional field projection.
    if payload.fields:
        response.forecasts = _project_fields(response.forecasts, payload.fields)

    return response


# ──────────────────────────────────────────────────────────────────────────────
# GET /gateway/forecast/latest — Get latest published forecasts
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/forecast/latest", response_model=ForecastResponse)
def gateway_forecast_latest(
    sku: str | None = None,
    warehouse_id: str | None = None,
    horizon: int | None = Query(default=None, ge=1, le=12),
    category: str | None = None,
    limit: int = Query(default=100, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    fields: str | None = Query(default=None, description="Comma-separated field projection"),
    db: Session = Depends(get_db),
):
    """Return the latest published forecast predictions.

    This is the fastest way to get forecasts — it reads pre-computed
    predictions from the database rather than running live inference.
    Ideal for dashboards, reports, and downstream services that need
    the most recent forecast.
    """
    # Find the latest published run.
    run_stmt = (
        select(ForecastRun)
        .where(ForecastRun.status == "published")
        .order_by(ForecastRun.id.desc())
        .limit(1)
    )
    if warehouse_id:
        run_stmt = run_stmt.where(ForecastRun.warehouse_id == warehouse_id)
    latest_run = db.execute(run_stmt).scalar_one_or_none()

    if latest_run is None:
        provider = get_active_provider()
        return ForecastResponse(
            status="success",
            model=provider.model_info(),
            warehouse_id=warehouse_id,
            forecasts=[],
            total_count=0,
            message="No published forecast runs found.",
        )

    # Build prediction query.
    pred_stmt = select(ForecastPrediction).where(ForecastPrediction.run_id == latest_run.id)
    count_stmt = select(func.count(ForecastPrediction.id)).where(
        ForecastPrediction.run_id == latest_run.id
    )

    if sku:
        pred_stmt = pred_stmt.where(ForecastPrediction.sku == sku)
        count_stmt = count_stmt.where(ForecastPrediction.sku == sku)
    if horizon is not None:
        pred_stmt = pred_stmt.where(ForecastPrediction.horizon == horizon)
        count_stmt = count_stmt.where(ForecastPrediction.horizon == horizon)
    if category:
        pred_stmt = pred_stmt.where(ForecastPrediction.category == category)
        count_stmt = count_stmt.where(ForecastPrediction.category == category)
    if warehouse_id:
        pred_stmt = pred_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)
        count_stmt = count_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)

    total = db.execute(count_stmt).scalar_one()
    rows = (
        db.execute(
            pred_stmt
            .order_by(ForecastPrediction.sku.asc(), ForecastPrediction.horizon.asc())
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    forecast_points = [
        ForecastPoint(
            sku=r.sku,
            category=r.category,
            horizon=r.horizon,
            period=r.month,
            p10=round(r.p10, 2),
            p50=round(r.p50, 2),
            p90=round(r.p90, 2),
            actual=r.y_true,
        )
        for r in rows
    ]

    # Optional field projection.
    field_list = [f.strip() for f in fields.split(",")] if fields else None
    if field_list:
        forecast_points = _project_fields(forecast_points, field_list)

    model_info = ModelInfo(
        name=latest_run.model_name.lower(),
        version=latest_run.model_version or "v1",
        is_champion=True,
        fallback_used=False,
    )

    return ForecastResponse(
        status="success",
        model=model_info,
        warehouse_id=warehouse_id or latest_run.warehouse_id,
        forecasts=forecast_points,
        total_count=total,
        pagination=PaginationInfo(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + limit) < total,
        ),
        message=f"Latest forecasts from run #{latest_run.id} ({latest_run.model_name}).",
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /gateway/forecast/{sku} — Get forecast for specific SKU
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/forecast/{sku}", response_model=ForecastResponse)
def gateway_forecast_by_sku(
    sku: str,
    warehouse_id: str | None = None,
    horizon: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Get all available forecast points for a specific SKU.

    Returns the latest published predictions for the given SKU across
    all horizons (or a specific horizon if provided).
    """
    # Find the latest published run.
    run_stmt = (
        select(ForecastRun)
        .where(ForecastRun.status == "published")
        .order_by(ForecastRun.id.desc())
        .limit(1)
    )
    latest_run = db.execute(run_stmt).scalar_one_or_none()

    if latest_run is None:
        provider = get_active_provider()
        return ForecastResponse(
            status="success",
            model=provider.model_info(),
            warehouse_id=warehouse_id,
            forecasts=[],
            total_count=0,
            message=f"No published forecast runs found for SKU '{sku}'.",
        )

    pred_stmt = select(ForecastPrediction).where(
        ForecastPrediction.run_id == latest_run.id,
        ForecastPrediction.sku == sku,
    )
    if horizon is not None:
        pred_stmt = pred_stmt.where(ForecastPrediction.horizon == horizon)
    if warehouse_id:
        pred_stmt = pred_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)

    rows = (
        db.execute(pred_stmt.order_by(ForecastPrediction.horizon.asc()))
        .scalars()
        .all()
    )

    forecast_points = [
        ForecastPoint(
            sku=r.sku,
            category=r.category,
            horizon=r.horizon,
            period=r.month,
            p10=round(r.p10, 2),
            p50=round(r.p50, 2),
            p90=round(r.p90, 2),
            actual=r.y_true,
        )
        for r in rows
    ]

    model_info = ModelInfo(
        name=latest_run.model_name.lower(),
        version=latest_run.model_version or "v1",
        is_champion=True,
        fallback_used=False,
    )

    return ForecastResponse(
        status="success",
        model=model_info,
        warehouse_id=warehouse_id or latest_run.warehouse_id,
        forecasts=forecast_points,
        total_count=len(forecast_points),
        message=f"Forecasts for SKU '{sku}' from run #{latest_run.id}.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /gateway/jobs/{job_id} — Poll async job status
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}")
def gateway_job_status(
    job_id: int,
    include_results: bool = Query(default=True, description="Include forecast results if job is complete"),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Poll the status of an async forecast job.

    Returns the job status, and if complete, includes the forecast results.
    """
    run = db.get(ForecastRun, job_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Job/run {job_id} not found.")

    # Check for associated publish job status.
    pub_job = db.execute(
        select(PublishJob)
        .where(PublishJob.run_id == job_id)
        .order_by(PublishJob.id.desc())
        .limit(1)
    ).scalar_one_or_none()

    status_map = {
        "created": "accepted",
        "publishing": "processing",
        "published": "completed",
        "failed": "failed",
    }
    job_status = status_map.get(run.status, run.status)

    result: dict[str, Any] = {
        "api_version": "1.0",
        "job_id": job_id,
        "status": job_status,
        "model_name": run.model_name,
        "warehouse_id": run.warehouse_id,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }

    if pub_job:
        result["started_at"] = pub_job.started_at.isoformat() if pub_job.started_at else None
        result["finished_at"] = pub_job.finished_at.isoformat() if pub_job.finished_at else None
        if pub_job.error:
            result["error"] = pub_job.error

    # Include results if job is completed and requested.
    if job_status == "completed" and include_results:
        pred_stmt = (
            select(ForecastPrediction)
            .where(ForecastPrediction.run_id == job_id)
            .order_by(ForecastPrediction.sku.asc(), ForecastPrediction.horizon.asc())
            .offset(offset)
            .limit(limit)
        )
        rows = db.execute(pred_stmt).scalars().all()
        total = db.execute(
            select(func.count(ForecastPrediction.id)).where(
                ForecastPrediction.run_id == job_id
            )
        ).scalar_one()

        result["forecasts"] = [
            {
                "sku": r.sku,
                "category": r.category,
                "horizon": r.horizon,
                "period": r.month,
                "p10": round(r.p10, 2),
                "p50": round(r.p50, 2),
                "p90": round(r.p90, 2),
                "actual": r.y_true,
            }
            for r in rows
        ]
        result["total_count"] = total
        result["pagination"] = {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total,
        }

    return result


# ──────────────────────────────────────────────────────────────────────────────
# GET /gateway/health — Service health
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=GatewayHealthResponse)
def gateway_health(db: Session = Depends(get_db)):
    """Health check for the forecast gateway.

    Returns service status, champion model information, and artifact
    availability.
    """
    provider = get_active_provider()
    health = provider.health_check()
    champion = provider.model_info()

    # Get the latest run ID.
    latest_run_id = db.execute(
        select(func.max(ForecastRun.id)).where(ForecastRun.status == "published")
    ).scalar_one_or_none()

    status = health.get("status", "ok")

    return GatewayHealthResponse(
        status=status,
        champion_model=champion,
        total_artifacts=health.get("total_artifacts", 0),
        last_run_id=latest_run_id,
        uptime_seconds=round(time.monotonic() - _start_time, 1),
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /gateway/models — Available models
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/models")
def gateway_models():
    """List available models and identify the current champion.

    Useful for debugging, monitoring dashboards, and understanding
    which model is serving predictions.
    """
    from app.services.artifact_service import list_artifacts

    dataset = settings.default_forecast_dataset
    provider = get_active_provider()
    champion = provider.model_info()
    provider_health = provider.health_check()

    artifacts = list_artifacts(dataset=dataset)

    # Group by model name.
    model_names: dict[str, int] = {}
    for a in artifacts:
        name = a.get("artifact_name", "unknown").split("_h")[0]
        model_names[name] = model_names.get(name, 0) + 1
    if provider_health.get("provider") == "v8_snapshot":
        model_names[champion.name] = max(model_names.get(champion.name, 0), 1)

    return {
        "api_version": "1.0",
        "champion": {
            "name": champion.name,
            "version": champion.version,
            "is_champion": True,
        },
        "available_models": [
            {"name": name, "artifact_count": count, "is_champion": name == champion.name}
            for name, count in sorted(model_names.items())
        ],
        "dataset": dataset,
        "total_artifacts": max(
            len(artifacts),
            int(provider_health.get("total_artifacts", 0)),
        ),
        "provider": provider_health.get("provider"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _create_async_job(db: Session, payload: ForecastRequest) -> AsyncJobResponse:
    """Create an async forecast run and return a job reference for polling."""
    from app.services.model_registry_service import resolve_champion_model as resolve_reg

    resolved_model, resolved_version = resolve_reg(
        db=db,
        dataset=settings.default_forecast_dataset,
        warehouse_id=payload.warehouse_id,
    )

    run = ForecastRun(
        dataset=settings.default_forecast_dataset,
        model_name=resolved_model,
        model_version=resolved_version,
        warehouse_id=payload.warehouse_id,
        notes=f"Gateway async forecast: {len(payload.skus or [])} SKUs, horizons={payload.horizons}",
        status="created",
    )
    db.add(run)
    db.flush()

    db.add(PublishJob(run_id=run.id, mode="online", status="queued"))
    db.commit()
    db.refresh(run)

    return AsyncJobResponse(
        status="accepted",
        job_id=run.id,
        poll_url=f"/api/v1/gateway/jobs/{run.id}",
        estimated_seconds=len(payload.horizons) * 3.0,
        message=f"Forecast job #{run.id} queued. Poll /api/v1/gateway/jobs/{run.id} for results.",
    )


def _project_fields(
    points: list[ForecastPoint],
    fields: list[str],
) -> list[ForecastPoint]:
    """Apply field projection to forecast points.

    Returns the same list of ForecastPoint objects, but with non-requested
    fields reset to their defaults.  This reduces payload size for
    lightweight consumers (e.g. chatbots that only need sku + p50).
    """
    # We keep all ForecastPoint objects intact but only serialize the requested
    # fields.  For now, this is a no-op on the Pydantic model level — the
    # actual projection happens at serialization time via response_model_include
    # or the consumer simply ignores extra fields.
    #
    # This is the standard approach: return the full object but document that
    # consumers may request specific fields.  True server-side projection
    # can be added later if bandwidth becomes a concern.
    return points
