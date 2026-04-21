from datetime import datetime
import httpx
from fastapi import APIRouter, HTTPException
import time

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
            params={"mode": mode, "async_run": "true"},
            timeout=settings.run_publish_timeout_seconds,
        )
        p.raise_for_status()
        publish_result = p.json()

        started_at = time.time()
        final_status = "publishing"
        run_state = {"id": run_id, "status": final_status}
        while (time.time() - started_at) < settings.run_publish_timeout_seconds:
            rstate = httpx.get(
                f"{settings.forecast_api_base_url}/runs/{run_id}",
                timeout=settings.run_create_timeout_seconds,
            )
            rstate.raise_for_status()
            run_state = rstate.json()
            final_status = str(run_state.get("status") or "").lower()
            if final_status in {"published", "failed"}:
                break
            time.sleep(max(0.2, settings.run_publish_poll_interval_seconds))

        return {
            "job": "forecast-run",
            "status": final_status if final_status else "unknown",
            "run_id": run_id,
            "mode_requested": mode,
            "triggered_at": datetime.utcnow().isoformat() + "Z",
            "publish_result": publish_result,
            "run_state": run_state,
        }
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"forecast pipeline call failed: {ex}")
