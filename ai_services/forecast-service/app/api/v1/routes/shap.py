"""
GET /api/v1/shap/explanation
Serves pre-computed SHAP feature attributions for a given SKU and horizon.
Called by explain_router.py in the ai-agent to inject model internals into the Gemini prompt.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import verify_service_auth
from app.db.database import get_db
from app.services.shap_service import query_shap_explanation

router = APIRouter(prefix="/api/v1/shap", tags=["shap"])


@router.get("/explanation")
def get_shap_explanation(
    sku: str = Query(..., description="SKU code, e.g. SKU-300001"),
    horizon: int = Query(..., ge=1, le=12, description="Forecast horizon (1–12)"),
    dataset: str | None = Query(None, description="Dataset code, e.g. 'B' or 'P'"),
    model_name: str | None = Query(None, description="Model name, e.g. XGBOOST"),
    db: Session = Depends(get_db),
    _auth=Depends(verify_service_auth),
):
    """
    Returns the most recent SHAP explanation for a given SKU and horizon.

    Response shape:
    {
      "sku": "SKU-300001",
      "horizon": 3,
      "dataset": "B",
      "model_name": "XGBOOST",
      "prediction": 495.0,
      "base_value": 320.4,
      "top_features": [
        {"feature": "lag_1",  "label": "demand 1 month ago",    "shap_value": 87.2, "feature_value": 490.0},
        ...
      ],
      "computed_at": "2026-06-21T14:30:00"
    }
    """
    result = query_shap_explanation(
        db=db,
        sku=sku,
        horizon=horizon,
        dataset=dataset,
        model_name=model_name,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No SHAP explanation found for sku='{sku}' horizon={horizon}. "
                "Trigger a forecast publish run first."
            ),
        )
    return result
