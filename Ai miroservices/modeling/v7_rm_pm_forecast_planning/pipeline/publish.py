from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from pipeline.data import engine_for
from pipeline.io import V7Config


def publish_forecast_results(cfg: V7Config, forecasts: pd.DataFrame) -> dict:
    if forecasts.empty:
        return {"published_rows": 0, "reason": "empty_forecast"}
    sql = text(
        f"""
        INSERT INTO {cfg.schema}.forecast_results (
            material_id,
            warehouse_id,
            forecast_period,
            horizon,
            model_name,
            forecast_p10,
            forecast_p50,
            forecast_p90,
            actual_demand,
            wape,
            method,
            mlflow_run_id,
            created_at
        )
        VALUES (
            CAST(:material_id AS uuid),
            CAST(NULLIF(:warehouse_id, '') AS uuid),
            CAST(:forecast_period AS date),
            :horizon,
            :model_name,
            :forecast_p10,
            :forecast_p50,
            :forecast_p90,
            NULL,
            NULL,
            :method,
            NULL,
            NOW()
        )
        ON CONFLICT (material_id, forecast_period, horizon, model_name)
        DO UPDATE SET
            forecast_p10 = EXCLUDED.forecast_p10,
            forecast_p50 = EXCLUDED.forecast_p50,
            forecast_p90 = EXCLUDED.forecast_p90,
            method = EXCLUDED.method,
            created_at = NOW()
        """
    )
    payload = forecasts.copy()
    if "warehouse_id" not in payload.columns:
        payload["warehouse_id"] = ""
    payload["warehouse_id"] = payload["warehouse_id"].fillna("").astype(str)
    rows = payload[
        [
            "material_id",
            "warehouse_id",
            "forecast_period",
            "horizon",
            "model_name",
            "forecast_p10",
            "forecast_p50",
            "forecast_p90",
            "method",
        ]
    ].to_dict(orient="records")
    with engine_for(cfg).begin() as conn:
        conn.execute(sql, rows)
    return {"published_rows": len(rows), "model_name": cfg.model_name}
