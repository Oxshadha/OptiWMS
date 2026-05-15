#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _parse_statuses(raw: str) -> list[str]:
    out = [s.strip() for s in str(raw or "").split(",") if s.strip()]
    # Use runtime-realistic defaults for WMS outbound flows.
    return out or ["delivered", "packed", "picking", "shipped", "completed"]


def _wape(actual: np.ndarray, pred: np.ndarray) -> float | None:
    denom = float(np.sum(np.abs(actual)))
    if denom <= 0:
        return None
    return float(np.sum(np.abs(actual - pred)) / denom)


def _rmse(actual: np.ndarray, pred: np.ndarray) -> float | None:
    if len(actual) == 0:
        return None
    return float(np.sqrt(np.mean((pred - actual) ** 2)))


def _bias(actual: np.ndarray, pred: np.ndarray) -> float | None:
    if len(actual) == 0:
        return None
    return float(np.mean(pred - actual))


def _under_rate(actual: np.ndarray, pred: np.ndarray) -> float | None:
    if len(actual) == 0:
        return None
    return float(np.mean(pred < actual))


def _http_json(base_url: str, path: str, query: dict[str, Any]) -> dict[str, Any] | None:
    payload = {k: v for k, v in query.items() if v is not None and str(v) != ""}
    url = f"{base_url.rstrip('/')}{path}?{urlencode(payload)}"
    try:
        with urlopen(url, timeout=20.0) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except Exception:
        return None


def _norm_sku(s: Any) -> str:
    return str(s or "").strip().upper()


def _load_optional_sku_map(wms_db_url: str, schema: str) -> dict[str, str]:
    """
    Optional explicit SKU bridge table support.
    Expected table (if present): <schema>.forecast_sku_mapping
    Columns:
      - forecast_sku
      - wms_material_id
      - is_active (optional, defaults true when absent)
    """
    engine = create_engine(wms_db_url, future=True, pool_pre_ping=True)
    exists_sql = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_name = 'forecast_sku_mapping'
        ) AS exists
        """
    )
    with engine.connect() as conn:
        exists = bool(conn.execute(exists_sql, {"schema": schema}).scalar() or False)
        if not exists:
            return {}
        rows = conn.execute(
            text(
                f"""
                SELECT
                    fsm.forecast_sku::text AS forecast_sku,
                    m.material_code::text AS wms_sku
                FROM {schema}.forecast_sku_mapping fsm
                JOIN {schema}.materials m ON m.id = fsm.wms_material_id
                WHERE COALESCE(is_active, TRUE)
                """
            )
        ).mappings().all()
    out: dict[str, str] = {}
    for r in rows:
        fk = _norm_sku(r.get("forecast_sku"))
        wk = _norm_sku(r.get("wms_sku"))
        if fk and wk:
            out[fk] = wk
            # Also allow already-runtime namespace lookups to be stable.
            out[wk] = wk
    return out


@dataclass
class EvalSummary:
    status: str
    dataset: str
    model_name: str
    rows_total_predictions: int
    rows_matured_predictions: int
    rows_matched_actuals: int
    coverage_pct_matured: float
    wape: float | None
    rmse: float | None
    bias: float | None
    under_forecast_rate: float | None
    first_target_month: str | None
    last_target_month: str | None
    generated_at_utc: str
    details_csv: str
    by_horizon_csv: str
    inference_summary: dict[str, Any] | None


def _load_predictions(
    forecast_db_url: str,
    dataset: str,
    model_name: str,
    warehouse_id: str | None,
) -> pd.DataFrame:
    engine = create_engine(forecast_db_url, future=True, pool_pre_ping=True)
    where_wh = "AND (:warehouse_id IS NULL OR p.warehouse_id = :warehouse_id OR p.warehouse_id IS NULL)"
    sql = text(
        f"""
        SELECT
            p.run_id,
            p.sku,
            p.horizon,
            p.p50,
            p.month,
            p.warehouse_id,
            r.created_at
        FROM forecast_predictions p
        JOIN forecast_runs r ON r.id = p.run_id
        WHERE r.status = 'published'
          AND p.dataset = :dataset
          AND p.model_name = :model_name
          AND p.horizon > 0
          {where_wh}
        ORDER BY p.run_id DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(
            sql,
            {"dataset": dataset, "model_name": model_name, "warehouse_id": warehouse_id},
        ).mappings().all()
    return pd.DataFrame(rows)


def _add_target_month(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["created_at"] = pd.to_datetime(out["created_at"], errors="coerce")
    out["run_month"] = out["created_at"].dt.to_period("M").dt.to_timestamp()
    out["month"] = out["month"].astype(str)
    out["target_month"] = pd.NaT

    hmask = out["month"].str.match(r"^H\+\d+$", na=False)
    if hmask.any():
        # Use the explicit H+N token as the source of truth and add months via Period arithmetic.
        # This avoids object-dtype DateOffset vectorization issues that can produce wrong months.
        h_vals = (
            out.loc[hmask, "month"]
            .str.extract(r"^H\+(\d+)$", expand=False)
            .astype("Int64")
        )
        run_period = out.loc[hmask, "run_month"].dt.to_period("M")
        target_period = run_period + h_vals
        out.loc[hmask, "target_month"] = target_period.dt.to_timestamp()

    dmask = ~hmask
    if dmask.any():
        parsed = pd.to_datetime(out.loc[dmask, "month"], errors="coerce")
        out.loc[dmask, "target_month"] = parsed.dt.to_period("M").dt.to_timestamp()

    out["target_month"] = pd.to_datetime(out["target_month"], errors="coerce")
    out = out[out["target_month"].notna()].copy()
    return out


def _load_actual_monthly(
    wms_db_url: str,
    schema: str,
    outbound_statuses: list[str],
    warehouse_id: str | None,
) -> pd.DataFrame:
    engine = create_engine(wms_db_url, future=True, pool_pre_ping=True)
    wh_sql = "AND (:warehouse_id IS NULL OR o.warehouse_id::text = :warehouse_id)"
    sql = text(
        f"""
        SELECT
            COALESCE(o.warehouse_id::text, '') AS warehouse_id,
            m.material_code::text AS sku,
            DATE_TRUNC('month', o.order_date)::date AS month_start,
            SUM(COALESCE(oi.quantity, 0))::double precision AS actual_units
        FROM {schema}.orders o
        JOIN {schema}.order_items oi ON oi.order_id = o.id
        JOIN {schema}.materials m ON m.id = oi.material_id
        WHERE LOWER(COALESCE(o.order_type, '')) = 'outbound'
          AND LOWER(COALESCE(o.status, '')) = ANY(:statuses)
          AND LOWER(COALESCE(m.material_type, '')) = 'product'
          {wh_sql}
        GROUP BY COALESCE(o.warehouse_id::text, ''), m.material_code, DATE_TRUNC('month', o.order_date)::date
        """
    )
    statuses = [s.lower() for s in outbound_statuses]
    with engine.connect() as conn:
        rows = conn.execute(sql, {"statuses": statuses, "warehouse_id": warehouse_id}).mappings().all()
    out = pd.DataFrame(rows)
    if out.empty:
        return out
    out["month_start"] = pd.to_datetime(out["month_start"], errors="coerce").dt.to_period("M").dt.to_timestamp()
    out["actual_units"] = pd.to_numeric(out["actual_units"], errors="coerce").fillna(0.0)
    out["sku"] = out["sku"].astype(str).str.strip()
    return out


def _evaluate_join(
    pred: pd.DataFrame,
    act: pd.DataFrame,
    sku_map: dict[str, str] | None = None,
) -> pd.DataFrame:
    if pred.empty or act.empty:
        return pd.DataFrame()

    actual_all = (
        act.groupby(["sku", "month_start"], as_index=False)["actual_units"]
        .sum()
        .rename(columns={"month_start": "target_month", "actual_units": "actual_all"})
    )
    actual_wh = act.rename(columns={"month_start": "target_month", "actual_units": "actual_wh"})[
        ["warehouse_id", "sku", "target_month", "actual_wh"]
    ]

    out = pred.copy()
    map_dict = sku_map or {}
    out["sku"] = out["sku"].astype(str).str.strip()
    out["sku_key"] = out["sku"].map(lambda x: map_dict.get(_norm_sku(x), _norm_sku(x)))
    out["warehouse_id"] = out["warehouse_id"].fillna("").astype(str)
    actual_all["sku_key"] = actual_all["sku"].map(lambda x: map_dict.get(_norm_sku(x), _norm_sku(x)))
    actual_wh["sku_key"] = actual_wh["sku"].map(lambda x: map_dict.get(_norm_sku(x), _norm_sku(x)))
    out = out.merge(actual_all.drop(columns=["sku"]), on=["sku_key", "target_month"], how="left")
    out = out.merge(actual_wh.drop(columns=["sku"]), on=["warehouse_id", "sku_key", "target_month"], how="left")

    # If prediction row has explicit warehouse, prefer warehouse-level actuals; otherwise use all-warehouse aggregate.
    use_wh = out["warehouse_id"].astype(str).str.len() > 0
    out["actual_units"] = np.where(use_wh, out["actual_wh"], out["actual_all"])
    out["actual_units"] = pd.to_numeric(out["actual_units"], errors="coerce")
    out["p50"] = pd.to_numeric(out["p50"], errors="coerce")
    out["abs_err"] = (out["p50"] - out["actual_units"]).abs()
    out["sq_err"] = (out["p50"] - out["actual_units"]) ** 2
    out["is_under"] = (out["p50"] < out["actual_units"]).astype(float)
    return out


def run(
    forecast_db_url: str,
    wms_db_url: str,
    schema: str,
    dataset: str,
    model_name: str,
    warehouse_id: str | None,
    outbound_statuses: list[str],
    forecast_base_url: str,
    inference_window: int,
    out_dir: Path,
) -> tuple[EvalSummary, pd.DataFrame, pd.DataFrame]:
    pred = _load_predictions(
        forecast_db_url=forecast_db_url,
        dataset=dataset,
        model_name=model_name,
        warehouse_id=warehouse_id,
    )
    if pred.empty:
        stamp = _now_stamp()
        out_dir.mkdir(parents=True, exist_ok=True)
        details_csv = out_dir / f"shadow_feedback_{stamp}_rows.csv"
        by_h_csv = out_dir / f"shadow_feedback_{stamp}_by_horizon.csv"
        pd.DataFrame().to_csv(details_csv, index=False)
        pd.DataFrame().to_csv(by_h_csv, index=False)
        return (
            EvalSummary(
                status="warn",
                dataset=dataset,
                model_name=model_name,
                rows_total_predictions=0,
                rows_matured_predictions=0,
                rows_matched_actuals=0,
                coverage_pct_matured=0.0,
                wape=None,
                rmse=None,
                bias=None,
                under_forecast_rate=None,
                first_target_month=None,
                last_target_month=None,
                generated_at_utc=datetime.now(timezone.utc).isoformat(),
                details_csv=str(details_csv.resolve()),
                by_horizon_csv=str(by_h_csv.resolve()),
                inference_summary=_http_json(
                    forecast_base_url,
                    "/artifacts/inference-alerts",
                    {"dataset": dataset, "model_name": model_name, "limit": inference_window},
                ),
            ),
            pd.DataFrame(),
            pd.DataFrame(),
        )

    pred = _add_target_month(pred)
    now_month = pd.Timestamp.utcnow().to_period("M").to_timestamp()
    matured = pred[pred["target_month"] < now_month].copy()
    actual = _load_actual_monthly(
        wms_db_url=wms_db_url,
        schema=schema,
        outbound_statuses=outbound_statuses,
        warehouse_id=warehouse_id,
    )
    sku_map = _load_optional_sku_map(wms_db_url=wms_db_url, schema=schema)
    joined = _evaluate_join(matured, actual, sku_map=sku_map)
    matched = joined[joined["actual_units"].notna() & joined["p50"].notna()].copy()

    wape = _wape(matched["actual_units"].to_numpy(), matched["p50"].to_numpy()) if not matched.empty else None
    rmse = _rmse(matched["actual_units"].to_numpy(), matched["p50"].to_numpy()) if not matched.empty else None
    bias = _bias(matched["actual_units"].to_numpy(), matched["p50"].to_numpy()) if not matched.empty else None
    under_rate = _under_rate(matched["actual_units"].to_numpy(), matched["p50"].to_numpy()) if not matched.empty else None

    by_h = pd.DataFrame()
    if not matched.empty:
        rows = []
        for h, g in matched.groupby("horizon"):
            a = g["actual_units"].to_numpy()
            p = g["p50"].to_numpy()
            rows.append(
                {
                    "horizon": int(h),
                    "n_obs": int(len(g)),
                    "WAPE": _wape(a, p),
                    "RMSE": _rmse(a, p),
                    "Bias": _bias(a, p),
                    "under_forecast_rate": _under_rate(a, p),
                }
            )
        by_h = pd.DataFrame(rows).sort_values("horizon").reset_index(drop=True)

    stamp = _now_stamp()
    out_dir.mkdir(parents=True, exist_ok=True)
    details_csv = out_dir / f"shadow_feedback_{stamp}_rows.csv"
    by_h_csv = out_dir / f"shadow_feedback_{stamp}_by_horizon.csv"
    joined.to_csv(details_csv, index=False)
    by_h.to_csv(by_h_csv, index=False)

    coverage = float(len(matched) / len(matured)) if len(matured) > 0 else 0.0
    summary = EvalSummary(
        status="ok" if len(matched) > 0 else "warn",
        dataset=dataset,
        model_name=model_name,
        rows_total_predictions=int(len(pred)),
        rows_matured_predictions=int(len(matured)),
        rows_matched_actuals=int(len(matched)),
        coverage_pct_matured=coverage,
        wape=wape,
        rmse=rmse,
        bias=bias,
        under_forecast_rate=under_rate,
        first_target_month=str(matched["target_month"].min().date()) if not matched.empty else None,
        last_target_month=str(matched["target_month"].max().date()) if not matched.empty else None,
        generated_at_utc=datetime.now(timezone.utc).isoformat(),
        details_csv=str(details_csv.resolve()),
        by_horizon_csv=str(by_h_csv.resolve()),
        inference_summary=_http_json(
            forecast_base_url,
            "/artifacts/inference-alerts",
            {"dataset": dataset, "model_name": model_name, "limit": inference_window},
        ),
    )
    return summary, joined, by_h


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate shadow-mode forecast quality by joining published predictions with realized WMS outbound demand."
    )
    parser.add_argument("--forecast-db-url", default=os.getenv("FORECAST_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///./forecast_service.db")))
    parser.add_argument("--wms-db-url", default=os.getenv("WMS_RUNTIME_DATABASE_URL", ""))
    parser.add_argument("--schema", default=os.getenv("WMS_RUNTIME_SCHEMA", "public"))
    parser.add_argument("--dataset", default="B")
    parser.add_argument("--model-name", default="CATBOOST")
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--outbound-statuses", default=os.getenv("WMS_RUNTIME_OUTBOUND_STATUSES", "shipped,delivered,completed"))
    parser.add_argument("--forecast-base-url", default="http://localhost:8091")
    parser.add_argument("--inference-window", type=int, default=200)
    parser.add_argument(
        "--out-dir",
        default="/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/evidence",
    )
    args = parser.parse_args()

    if not args.wms_db_url:
        print("ERROR: missing --wms-db-url and WMS_RUNTIME_DATABASE_URL")
        return 2

    summary, _rows, _by_h = run(
        forecast_db_url=args.forecast_db_url,
        wms_db_url=args.wms_db_url,
        schema=args.schema,
        dataset=args.dataset,
        model_name=args.model_name,
        warehouse_id=args.warehouse_id,
        outbound_statuses=_parse_statuses(args.outbound_statuses),
        forecast_base_url=args.forecast_base_url,
        inference_window=args.inference_window,
        out_dir=Path(args.out_dir),
    )

    summary_dict = asdict(summary)
    out_json = Path(args.out_dir) / f"shadow_feedback_{_now_stamp()}_summary.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary_dict, indent=2), encoding="utf-8")
    summary_dict["summary_json"] = str(out_json.resolve())
    print(json.dumps(summary_dict, indent=2))
    return 0 if summary.status == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
