from fastapi import APIRouter, HTTPException

from app.api.v1.schemas.artifacts import (
    BoostingInferenceRequest,
    BoostingOnlineInferenceRequest,
    ClassicalInferenceRequest,
)
from app.services.artifact_service import (
    infer_boosting,
    infer_boosting_online,
    infer_classical,
    list_inference_audit,
    list_artifacts,
)

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
def infer_saved_boosting_online(payload: BoostingOnlineInferenceRequest):
    try:
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
