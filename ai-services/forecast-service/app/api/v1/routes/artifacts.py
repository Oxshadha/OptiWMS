from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.artifact_service import infer_boosting, infer_classical, list_artifacts

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


class ClassicalInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    series_id: str
    steps: int = Field(default=12, ge=1, le=24)


class BoostingInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    horizon: int = Field(ge=1, le=12)
    rows: list[dict]


@router.get("")
def get_artifacts(dataset: str | None = None, model: str | None = None):
    return {"items": list_artifacts(dataset=dataset, model=model)}


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
