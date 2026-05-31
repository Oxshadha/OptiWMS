from fastapi import APIRouter, HTTPException, Request

from app.api.v1.schemas.artifacts import (
    BoostingInferenceRequest,
    BoostingOnlineInferenceRequest,
    ClassicalInferenceRequest,
)
from app.services.artifact_service import (
    evaluate_acceptance_gate,
    evaluate_inference_alerts,
    infer_boosting,
    infer_boosting_online,
    infer_classical,
    list_inference_audit,
    list_artifacts,
)
from app.core.security import RATE_LIMITER
from app.db.database import SessionLocal
from app.services.health_monitor_service import (
    compute_operational_health_snapshot,
    latest_operational_health,
    list_operational_health_history,
)
from app.services.production_readiness_service import evaluate_production_readiness
from app.services.release_evidence_service import build_release_evidence_bundle
from app.services.governance_service import governance_worker

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@router.get("")
def get_artifacts(dataset: str | None = None, model: str | None = None):
    return {"items": list_artifacts(dataset=dataset, model=model)}


@router.get("/inference-audit")
def get_inference_audit(
    limit: int = 100,
    dataset: str | None = None,
    model_name: str | None = None,
):
    try:
        return list_inference_audit(limit=limit, dataset=dataset, model_name=model_name)
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"inference audit lookup failed: {ex}")


@router.get("/inference-alerts")
def get_inference_alerts(
    limit: int = 200,
    dataset: str | None = None,
    model_name: str | None = None,
):
    try:
        return evaluate_inference_alerts(limit=limit, dataset=dataset, model_name=model_name)
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"inference alert evaluation failed: {ex}")


@router.get("/acceptance-gate")
def get_acceptance_gate(
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 500,
):
    try:
        return evaluate_acceptance_gate(
            dataset=dataset,
            model_name=model_name,
            split=split,
            inference_window=inference_window,
        )
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"acceptance gate evaluation failed: {ex}")


@router.get("/operational-health")
def get_operational_health():
    db = SessionLocal()
    try:
        return latest_operational_health(db)
    finally:
        db.close()


@router.post("/operational-health/refresh")
def refresh_operational_health():
    db = SessionLocal()
    try:
        out = compute_operational_health_snapshot(db)
        db.commit()
        return out
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"operational health refresh failed: {ex}")
    finally:
        db.close()


@router.get("/operational-health/history")
def get_operational_health_history(limit: int = 50):
    db = SessionLocal()
    try:
        return list_operational_health_history(db, limit=limit)
    finally:
        db.close()


@router.get("/production-readiness")
def get_production_readiness(
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 500,
    soak_hours: int = 24,
):
    db = SessionLocal()
    try:
        return evaluate_production_readiness(
            db=db,
            dataset=dataset,
            model_name=model_name,
            split=split,
            inference_window=inference_window,
            soak_hours=soak_hours,
        )
    finally:
        db.close()


@router.get("/release-evidence")
def get_release_evidence(
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 200,
    soak_hours: int = 24,
    history_limit: int = 100,
):
    db = SessionLocal()
    try:
        return build_release_evidence_bundle(
            db=db,
            dataset=dataset,
            model_name=model_name,
            split=split,
            inference_window=inference_window,
            soak_hours=soak_hours,
            history_limit=history_limit,
        )
    finally:
        db.close()


@router.get("/governance/status")
def get_governance_status():
    return governance_worker.status()


@router.post("/governance/tick")
def governance_tick_now():
    db = SessionLocal()
    try:
        governance_worker.tick_once(db)
        db.commit()
        return governance_worker.status()
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"governance tick failed: {ex}")
    finally:
        db.close()


@router.post("/infer-classical")
def infer_saved_classical(payload: ClassicalInferenceRequest):
    try:
        return infer_classical(payload.dataset, payload.model_name, payload.series_id, payload.steps)
    except FileNotFoundError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"classical inference failed: {ex}")


@router.post("/infer-boosting")
def infer_saved_boosting(payload: BoostingInferenceRequest):
    try:
        return infer_boosting(payload.dataset, payload.model_name, payload.horizon, payload.rows)
    except FileNotFoundError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"boosting inference failed: {ex}")


@router.post("/infer-boosting-online")
def infer_saved_boosting_online(payload: BoostingOnlineInferenceRequest, request: Request):
    try:
        client_key = request.client.host if request.client else "unknown"
        if not RATE_LIMITER.allow(client_key):
            raise HTTPException(status_code=429, detail="Rate limit exceeded for online inference requests.")
        return infer_boosting_online(
            dataset=payload.dataset,
            model_name=payload.model_name,
            horizon=payload.horizon,
            series=payload.series,
            stage=payload.stage,
            clip_negative=payload.clip_negative,
        )
    except FileNotFoundError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"online boosting inference failed: {ex}")
