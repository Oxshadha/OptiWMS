from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import pandas as pd

from pipeline.io import load_config


def sync_to_sqlite(forecast_csv: Path, sqlite_db: Path) -> dict:
    forecasts = pd.read_csv(forecast_csv)
    sqlite_db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(sqlite_db)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS forecast_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset VARCHAR(16),
                model_name VARCHAR(64),
                model_version VARCHAR(64) DEFAULT 'v1',
                warehouse_id VARCHAR(64),
                status VARCHAR(32),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS forecast_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER,
                dataset VARCHAR(16),
                model_name VARCHAR(64),
                warehouse_id VARCHAR(64),
                sku VARCHAR(64),
                category VARCHAR(64),
                month VARCHAR(16),
                horizon INTEGER,
                p10 FLOAT,
                p50 FLOAT,
                p90 FLOAT,
                y_true FLOAT
            )
            """
        )
        cur = conn.execute(
            "INSERT INTO forecast_runs(dataset, model_name, model_version, warehouse_id, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
            ("RM_PM", str(forecasts["model_name"].iloc[0]), "v7", None, "published", "Synced from v7 RM/PM forecast_results export"),
        )
        run_id = cur.lastrowid
        rows = [
            (
                run_id,
                "RM_PM",
                str(r.model_name),
                str(r.warehouse_id) if pd.notna(r.warehouse_id) else None,
                str(r.material_code),
                str(r.material_type),
                str(r.forecast_period),
                int(r.horizon),
                float(r.forecast_p10),
                float(r.forecast_p50),
                float(r.forecast_p90),
                None,
            )
            for r in forecasts.itertuples(index=False)
        ]
        conn.executemany(
            """
            INSERT INTO forecast_predictions(
                run_id, dataset, model_name, warehouse_id, sku, category, month,
                horizon, p10, p50, p90, y_true
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        return {"run_id": run_id, "synced_rows": len(rows), "sqlite_db": str(sqlite_db)}
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync v7 WMS forecast export into forecast-service SQLite dashboard DB")
    parser.add_argument("--config", default=None)
    parser.add_argument("--forecast-csv", default=None)
    parser.add_argument("--forecast-service-db", required=True)
    args = parser.parse_args()
    cfg = load_config(args.config)
    csv_path = Path(args.forecast_csv) if args.forecast_csv else cfg.output_dir / "forecast_results_v7.csv"
    result = sync_to_sqlite(csv_path, Path(args.forecast_service_db))
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
