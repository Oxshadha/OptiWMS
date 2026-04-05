from datetime import datetime
import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/forecast-run")
def trigger_forecast_run(
    dataset: str = "B",
    model_name: str = "AUTO",
    warehouse_id: str | None = None,
    mode: str = "auto",
) -> dict:
    try:
        r = httpx.post(
            f"{settings.forecast_api_base_url}/runs",
            json={
                "dataset": dataset,
                "model_name": model_name,
                "model_version": "v1",
                "warehouse_id": warehouse_id,
            },
            timeout=settings.run_create_timeout_seconds,
        )
        r.raise_for_status()
        run_id = r.json()["id"]

        p = httpx.post(
            f"{settings.forecast_api_base_url}/runs/{run_id}/publish",
            params={"mode": mode},
            timeout=settings.run_publish_timeout_seconds,
        )
        p.raise_for_status()

        return {
            "job": "forecast-run",
            "status": "published",
            "run_id": run_id,
            "mode_requested": mode,
            "triggered_at": datetime.utcnow().isoformat() + "Z",
            "publish_result": p.json(),
        }
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"forecast pipeline call failed: {ex}")
