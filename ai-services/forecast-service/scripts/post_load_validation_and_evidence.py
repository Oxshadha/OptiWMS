#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from runtime_data_readiness_check import _outbound_statuses, evaluate as evaluate_runtime_readiness


@dataclass
class PlausibilityResult:
    status: str
    checks: dict[str, Any]
    summary: dict[str, Any]


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _http_json(
    base_url: str,
    path: str,
    query: dict[str, Any] | None = None,
    method: str = "GET",
    timeout: float = 30.0,
) -> dict[str, Any]:
    q = ""
    if query:
        payload = {k: v for k, v in query.items() if v is not None and str(v) != ""}
        if payload:
            q = "?" + urlencode(payload)
    url = f"{base_url.rstrip('/')}{path}{q}"
    req = Request(url=url, method=method.upper())
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            body = json.loads(raw) if raw else {}
            return {"ok": True, "status": resp.status, "url": url, "body": body}
    except HTTPError as ex:
        raw = ex.read().decode("utf-8", errors="replace")
        body = None
        try:
            body = json.loads(raw)
        except Exception:
            body = {"raw": raw}
        return {"ok": False, "status": ex.code, "url": url, "error": str(ex), "body": body}
    except URLError as ex:
        return {"ok": False, "status": None, "url": url, "error": str(ex), "body": None}
    except Exception as ex:
        return {"ok": False, "status": None, "url": url, "error": str(ex), "body": None}


def _run_warmup(orchestrator_url: str, dataset: str, model_name: str, runs: int, mode: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for _ in range(max(0, runs)):
        out.append(
            _http_json(
                orchestrator_url,
                "/jobs/forecast-run",
                query={"dataset": dataset, "model_name": model_name, "mode": mode},
                method="POST",
                timeout=90.0,
            )
        )
    return out


def _as_items(obj: Any) -> list[dict[str, Any]]:
    if isinstance(obj, dict):
        maybe = obj.get("items")
        if isinstance(maybe, list):
            return [x for x in maybe if isinstance(x, dict)]
    if isinstance(obj, list):
        return [x for x in obj if isinstance(x, dict)]
    return []


def _num(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        return float(v)
    except Exception:
        return default


def _business_plausibility(forecasts: list[dict[str, Any]], inventory: list[dict[str, Any]]) -> PlausibilityResult:
    forecast_rows = len(forecasts)
    inventory_rows = len(inventory)

    bad_quantile_order = 0
    negative_forecast_values = 0
    for r in forecasts:
        p10 = _num(r.get("p10"))
        p50 = _num(r.get("p50"))
        p90 = _num(r.get("p90"))
        if not (p10 <= p50 <= p90):
            bad_quantile_order += 1
        if p10 < 0 or p50 < 0 or p90 < 0:
            negative_forecast_values += 1

    bad_inventory_order = 0
    negative_suggested = 0
    should_be_zero_suggested = 0
    top_suggested_qty = 0.0
    for r in inventory:
        reorder = _num(r.get("reorder_point"))
        target = _num(r.get("target_max"))
        on_hand = _num(r.get("on_hand_inventory"))
        suggested = _num(r.get("suggested_order_qty"))
        if reorder > target:
            bad_inventory_order += 1
        if suggested < 0:
            negative_suggested += 1
        if on_hand >= target and suggested > 0:
            should_be_zero_suggested += 1
        if suggested > top_suggested_qty:
            top_suggested_qty = suggested

    checks = {
        "forecast_rows_gt_0": forecast_rows > 0,
        "inventory_rows_gt_0": inventory_rows > 0,
        "quantile_order_valid": bad_quantile_order == 0,
        "forecast_non_negative": negative_forecast_values == 0,
        "reorder_le_target_max": bad_inventory_order == 0,
        "suggested_non_negative": negative_suggested == 0,
        "suggested_zero_when_on_hand_above_target": should_be_zero_suggested == 0,
    }
    all_pass = all(checks.values())
    summary = {
        "forecast_rows": forecast_rows,
        "inventory_rows": inventory_rows,
        "violations": {
            "quantile_order": bad_quantile_order,
            "negative_forecast_values": negative_forecast_values,
            "reorder_gt_target_max": bad_inventory_order,
            "negative_suggested_order_qty": negative_suggested,
            "suggested_nonzero_when_onhand_above_target": should_be_zero_suggested,
        },
        "top_suggested_order_qty": top_suggested_qty,
    }
    return PlausibilityResult(
        status="ok" if all_pass else "error",
        checks=checks,
        summary=summary,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Post-load validation runner: runtime readiness + gate evidence + business plausibility checks."
    )
    parser.add_argument("--db-url", default=os.getenv("WMS_RUNTIME_DATABASE_URL", "").strip())
    parser.add_argument("--schema", default=os.getenv("WMS_RUNTIME_SCHEMA", "public"))
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument(
        "--outbound-statuses",
        default=os.getenv("WMS_RUNTIME_OUTBOUND_STATUSES", "shipped,delivered,completed"),
    )
    parser.add_argument("--forecast-base-url", default="http://localhost:8091")
    parser.add_argument("--orchestrator-base-url", default="http://localhost:8092")
    parser.add_argument("--dataset", default="B")
    parser.add_argument("--model-name", default="CATBOOST")
    parser.add_argument("--split", default="test")
    parser.add_argument("--inference-window", type=int, default=200)
    parser.add_argument("--soak-hours", type=int, default=24)
    parser.add_argument("--history-limit", type=int, default=50)
    parser.add_argument(
        "--warmup-online-runs",
        type=int,
        default=0,
        help="Optional number of online runs before checks to populate serving window metrics.",
    )
    parser.add_argument("--warmup-mode", default="online", choices=["online", "snapshot", "auto"])
    parser.add_argument(
        "--out-json",
        default=None,
        help="Optional output file. Default: ai-services/forecast-service/artifacts/evidence/post_load_validation_<STAMP>.json",
    )
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if any major check fails.")
    args = parser.parse_args()

    if not args.db_url:
        print("ERROR: missing --db-url and WMS_RUNTIME_DATABASE_URL")
        return 2

    stamp = _now_stamp()
    out_path = Path(args.out_json) if args.out_json else Path(
        f"ai-services/forecast-service/artifacts/evidence/post_load_validation_{stamp}.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    warmup_results = _run_warmup(
        orchestrator_url=args.orchestrator_base_url,
        dataset=args.dataset,
        model_name=args.model_name,
        runs=args.warmup_online_runs,
        mode=args.warmup_mode,
    )

    runtime_readiness = evaluate_runtime_readiness(
        db_url=args.db_url,
        schema=args.schema,
        warehouse_id=args.warehouse_id,
        outbound_statuses=_outbound_statuses(args.outbound_statuses),
    )

    acceptance_gate = _http_json(
        args.forecast_base_url,
        "/artifacts/acceptance-gate",
        query={
            "dataset": args.dataset,
            "model_name": args.model_name,
            "split": args.split,
            "inference_window": args.inference_window,
        },
    )
    production_readiness = _http_json(
        args.forecast_base_url,
        "/artifacts/production-readiness",
        query={
            "dataset": args.dataset,
            "model_name": args.model_name,
            "split": args.split,
            "inference_window": args.inference_window,
            "soak_hours": args.soak_hours,
        },
    )
    release_evidence = _http_json(
        args.forecast_base_url,
        "/artifacts/release-evidence",
        query={
            "dataset": args.dataset,
            "model_name": args.model_name,
            "split": args.split,
            "inference_window": args.inference_window,
            "soak_hours": args.soak_hours,
            "history_limit": args.history_limit,
        },
    )
    forecasts = _http_json(
        args.forecast_base_url,
        "/forecasts",
        query={"dataset": args.dataset, "model": args.model_name},
    )
    inventory_recs = _http_json(
        args.forecast_base_url,
        "/inventory-recommendations",
        query={"dataset": args.dataset, "model": args.model_name},
    )

    plausibility = _business_plausibility(
        _as_items(forecasts.get("body")),
        _as_items(inventory_recs.get("body")),
    )

    gate_ready = bool((acceptance_gate.get("body") or {}).get("ready")) if acceptance_gate.get("ok") else False
    prod_ready = bool((production_readiness.get("body") or {}).get("ready")) if production_readiness.get("ok") else False
    runtime_ok = runtime_readiness.get("status") == "ok"

    overall_ok = runtime_ok and gate_ready and plausibility.status == "ok"
    if args.strict:
        overall_ok = overall_ok and prod_ready

    result = {
        "timestamp_utc": stamp,
        "params": {
            "dataset": args.dataset,
            "model_name": args.model_name,
            "split": args.split,
            "inference_window": args.inference_window,
            "soak_hours": args.soak_hours,
            "warehouse_id": args.warehouse_id,
            "warmup_online_runs": args.warmup_online_runs,
            "warmup_mode": args.warmup_mode,
        },
        "runtime_readiness": runtime_readiness,
        "warmup_results": warmup_results,
        "acceptance_gate": acceptance_gate,
        "production_readiness": production_readiness,
        "release_evidence": release_evidence,
        "business_plausibility": {
            "status": plausibility.status,
            "checks": plausibility.checks,
            "summary": plausibility.summary,
        },
        "summary": {
            "runtime_ready": runtime_ok,
            "acceptance_gate_ready": gate_ready,
            "production_readiness_ready": prod_ready,
            "business_plausibility_ok": plausibility.status == "ok",
            "overall_ok": overall_ok,
            "note": "overall_ok excludes 24h soak unless --strict is set",
        },
    }

    text_blob = json.dumps(result, indent=2, sort_keys=True)
    out_path.write_text(text_blob + "\n", encoding="utf-8")
    print(text_blob)
    print(f"\nEVIDENCE_FILE={out_path.resolve()}")
    return 0 if overall_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

