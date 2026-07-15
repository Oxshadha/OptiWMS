from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/canonical", tags=["canonical-forecast"])
_recalculation_lock = threading.Lock()


def _run(command: list[str], timeout_seconds: int) -> dict:
    completed = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    output = completed.stdout.strip()
    if not output:
        return {}
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return {"output": output[-4000:]}


@router.post("/recalculate")
def recalculate() -> dict:
    if not _recalculation_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A canonical forecast recalculation is already running")

    project_root = Path(os.getenv("CANONICAL_FORECAST_ROOT", "/project_operational_baseline"))
    repository_root = Path(os.getenv("OPTIWMS_REPOSITORY_ROOT", "/optiwms"))
    output_dir = project_root / "outputs"
    database_url = os.getenv(
        "WMS_RUNTIME_DATABASE_URL",
        "postgresql://optiwms:optiwms@host.docker.internal:5434/optiwms",
    )
    try:
        forecast_result = _run(
            [
                sys.executable,
                str(project_root / "runtime_recalculate.py"),
                "--output",
                str(output_dir),
                "--db-url",
                database_url,
            ],
            timeout_seconds=1800,
        )
        publish_result = _run(
            [
                sys.executable,
                str(repository_root / "scripts/load_project_operational_baseline.py"),
                "--db-url",
                database_url,
                "--source",
                str(output_dir),
                "--forecast-only",
            ],
            timeout_seconds=600,
        )
        return {
            "ok": True,
            "status": "published_draft",
            "dataset": "PROJECT_OPERATIONAL_BASELINE_RM_PM",
            "model_name": forecast_result.get("champion"),
            "promotion_status": forecast_result.get("promotion_status"),
            "forecast_result": forecast_result,
            "publish_result": publish_result,
        }
    except subprocess.TimeoutExpired as exception:
        raise HTTPException(status_code=504, detail=f"Canonical forecast step timed out: {exception.cmd}") from exception
    except subprocess.CalledProcessError as exception:
        detail = (exception.stderr or exception.stdout or str(exception))[-4000:]
        raise HTTPException(status_code=500, detail=f"Canonical forecast recalculation failed: {detail}") from exception
    finally:
        _recalculation_lock.release()
