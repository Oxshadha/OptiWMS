from datetime import datetime
import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/forecast-run")
def trigger_forecast_run(dataset: str = "B", model_name: str = "CATBOOST") -> dict:
    # Step 1: register run in forecast service
    try:
        r = httpx.post(
            f"{settings.forecast_api_base_url}/runs",
            json={"dataset": dataset, "model_name": model_name, "model_version": "v1"},
            timeout=20,
        )
        r.raise_for_status()
        run_id = r.json()["id"]

        # Step 2: publish latest snapshot outputs into DB for this run
        p = httpx.post(f"{settings.forecast_api_base_url}/runs/{run_id}/publish-snapshot", timeout=60)
        p.raise_for_status()

        return {
            "job": "forecast-run",
            "status": "published",
            "run_id": run_id,
            "triggered_at": datetime.utcnow().isoformat() + "Z",
            "publish_result": p.json(),
        }
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"forecast pipeline call failed: {ex}")
