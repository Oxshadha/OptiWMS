from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

from app.core.config import settings

log = logging.getLogger(__name__)

_STATUS_RANK = {"ok": 0, "warn": 1, "critical": 2}


def _rank(status: str | None) -> int:
    return _STATUS_RANK.get(str(status or "").strip().lower(), -1)


def should_emit_alert(status: str | None) -> bool:
    threshold = str(settings.ops_alert_min_status or "warn").strip().lower()
    return _rank(status) >= _rank(threshold)


def dispatch_operational_alert(snapshot: dict[str, Any]) -> bool:
    webhook = (settings.ops_alert_webhook_url or "").strip()
    if not webhook:
        return False
    status = str(snapshot.get("status", "")).lower()
    if not should_emit_alert(status):
        return False

    payload: dict[str, Any] = {
        "event": "forecast_operational_health",
        "service": settings.service_name,
        "env": settings.ai_env,
        "status": status,
        "created_at": snapshot.get("created_at"),
        "snapshot_id": snapshot.get("id"),
        "inference_status": snapshot.get("inference_status"),
        "freshness_status": snapshot.get("freshness_status"),
        "drift_status": snapshot.get("drift_status"),
        "emitted_at": datetime.now(timezone.utc).isoformat(),
    }
    if settings.ops_alert_include_details:
        payload["details"] = snapshot.get("details")

    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        webhook,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=5.0) as res:
            if int(getattr(res, "status", 200)) >= 400:
                log.warning("ops_alert webhook non-2xx status=%s", getattr(res, "status", "unknown"))
                return False
        return True
    except (error.URLError, TimeoutError, OSError) as ex:
        log.warning("ops_alert dispatch failed: %s", ex)
        return False

