from datetime import datetime
from fastapi import APIRouter

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/forecast-run")
def trigger_forecast_run() -> dict:
    # Wire this to your modeling pipeline execution command/queue.
    return {
        "job": "forecast-run",
        "status": "accepted",
        "triggered_at": datetime.utcnow().isoformat() + "Z",
    }
