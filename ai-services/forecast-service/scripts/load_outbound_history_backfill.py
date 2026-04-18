#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text


DDL = """
CREATE TABLE IF NOT EXISTS forecast_outbound_history_backfill (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id uuid NULL REFERENCES warehouses(id),
    sku varchar(64) NOT NULL,
    category varchar(255) NULL,
    demand_date date NOT NULL,
    demand_units numeric(18,4) NOT NULL CHECK (demand_units >= 0),
    dataset_version varchar(64) NOT NULL,
    source_tag varchar(64) NOT NULL DEFAULT 'manual_backfill',
    source_file_sha256 varchar(64) NULL,
    loaded_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    UNIQUE (warehouse_id, sku, demand_date)
);

CREATE INDEX IF NOT EXISTS idx_forecast_backfill_date ON forecast_outbound_history_backfill (demand_date);
CREATE INDEX IF NOT EXISTS idx_forecast_backfill_sku ON forecast_outbound_history_backfill (sku);
CREATE INDEX IF NOT EXISTS idx_forecast_backfill_wh ON forecast_outbound_history_backfill (warehouse_id);

CREATE TABLE IF NOT EXISTS forecast_backfill_load_audit (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_version varchar(64) NOT NULL,
    source_file varchar(1024) NOT NULL,
    source_file_sha256 varchar(64) NULL,
    warehouse_id uuid NULL REFERENCES warehouses(id),
    row_count integer NOT NULL DEFAULT 0,
    inserted_rows integer NOT NULL DEFAULT 0,
    updated_rows integer NOT NULL DEFAULT 0,
    status varchar(32) NOT NULL,
    notes text NULL,
    started_at timestamp without time zone NOT NULL DEFAULT now(),
    finished_at timestamp without time zone NULL
);
"""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_input(frame: pd.DataFrame, warehouse_id_override: str | None) -> pd.DataFrame:
    aliases = {
        "date": "demand_date",
        "forecast_date": "demand_date",
        "qty": "demand_units",
        "quantity": "demand_units",
    }
    for src, dst in aliases.items():
        if src in frame.columns and dst not in frame.columns:
            frame = frame.rename(columns={src: dst})

    required = {"sku", "demand_date", "demand_units"}
    missing = sorted(required.difference(set(frame.columns)))
    if missing:
        raise ValueError(f"missing required columns: {missing}")

    if "category" not in frame.columns:
        frame["category"] = None
    if "warehouse_id" not in frame.columns:
        frame["warehouse_id"] = None

    frame["sku"] = frame["sku"].astype(str).str.strip()
    frame["category"] = frame["category"].where(frame["category"].notna(), None)
    frame["demand_date"] = pd.to_datetime(frame["demand_date"]).dt.date
    frame["demand_units"] = pd.to_numeric(frame["demand_units"], errors="coerce").fillna(0.0)
    frame = frame[frame["sku"] != ""].copy()
    frame = frame[frame["demand_units"] >= 0].copy()

    if warehouse_id_override:
        frame["warehouse_id"] = warehouse_id_override
    else:
        frame["warehouse_id"] = frame["warehouse_id"].where(frame["warehouse_id"].notna(), None)
        frame["warehouse_id"] = frame["warehouse_id"].map(lambda v: str(v).strip() if v is not None else None)
        frame["warehouse_id"] = frame["warehouse_id"].map(lambda v: None if v in {"", "nan", "None"} else v)

    frame = (
        frame.groupby(["warehouse_id", "sku", "category", "demand_date"], dropna=False, as_index=False)["demand_units"]
        .sum()
        .sort_values(["warehouse_id", "sku", "demand_date"])
    )
    return frame


def run(
    db_url: str,
    input_csv: Path,
    dataset_version: str,
    source_tag: str,
    warehouse_id_override: str | None = None,
) -> dict[str, Any]:
    frame = pd.read_csv(input_csv)
    frame = normalize_input(frame, warehouse_id_override)
    file_hash = sha256_file(input_csv)

    engine = create_engine(db_url, future=True, pool_pre_ping=True)

    with engine.begin() as conn:
        conn.execute(text(DDL))
        audit_id = conn.execute(
            text(
                """
                INSERT INTO forecast_backfill_load_audit(
                    dataset_version, source_file, source_file_sha256, warehouse_id, row_count, status, notes
                )
                VALUES(:dataset_version, :source_file, :source_file_sha256, CAST(:warehouse_id AS uuid), :row_count, 'running', 'load started')
                RETURNING id::text
                """
            ),
            {
                "dataset_version": dataset_version,
                "source_file": str(input_csv.resolve()),
                "source_file_sha256": file_hash,
                "warehouse_id": warehouse_id_override,
                "row_count": int(len(frame)),
            },
        ).scalar_one()

        inserted_rows = 0
        updated_rows = 0
        upsert_sql = text(
            """
            WITH incoming AS (
                SELECT
                    CAST(:warehouse_id AS uuid) AS warehouse_id,
                    :sku AS sku,
                    :category AS category,
                    CAST(:demand_date AS date) AS demand_date,
                    CAST(:demand_units AS numeric(18,4)) AS demand_units,
                    :dataset_version AS dataset_version,
                    :source_tag AS source_tag,
                    :source_file_sha256 AS source_file_sha256
            ),
            upd AS (
                UPDATE forecast_outbound_history_backfill t
                SET
                    category = i.category,
                    demand_units = i.demand_units,
                    dataset_version = i.dataset_version,
                    source_tag = i.source_tag,
                    source_file_sha256 = i.source_file_sha256,
                    updated_at = now()
                FROM incoming i
                WHERE t.warehouse_id IS NOT DISTINCT FROM i.warehouse_id
                  AND t.sku = i.sku
                  AND t.demand_date = i.demand_date
                RETURNING 1
            ),
            ins AS (
                INSERT INTO forecast_outbound_history_backfill(
                    warehouse_id, sku, category, demand_date, demand_units,
                    dataset_version, source_tag, source_file_sha256
                )
                SELECT
                    i.warehouse_id, i.sku, i.category, i.demand_date, i.demand_units,
                    i.dataset_version, i.source_tag, i.source_file_sha256
                FROM incoming i
                WHERE NOT EXISTS (SELECT 1 FROM upd)
                RETURNING 1
            )
            SELECT
                COALESCE((SELECT count(*) FROM upd), 0) AS updated_rows,
                COALESCE((SELECT count(*) FROM ins), 0) AS inserted_rows
            """
        )

        for r in frame.itertuples(index=False):
            wh = getattr(r, "warehouse_id")
            row = conn.execute(
                upsert_sql,
                {
                    "warehouse_id": wh,
                    "sku": str(getattr(r, "sku")),
                    "category": (str(getattr(r, "category")) if getattr(r, "category") is not None else None),
                    "demand_date": getattr(r, "demand_date").isoformat(),
                    "demand_units": float(getattr(r, "demand_units")),
                    "dataset_version": dataset_version,
                    "source_tag": source_tag,
                    "source_file_sha256": file_hash,
                },
            ).mappings().one()
            inserted_rows += int(row.get("inserted_rows") or 0)
            updated_rows += int(row.get("updated_rows") or 0)

        conn.execute(
            text(
                """
                UPDATE forecast_backfill_load_audit
                SET
                    inserted_rows = :inserted_rows,
                    updated_rows = :updated_rows,
                    status = 'ok',
                    notes = 'load completed',
                    finished_at = now()
                WHERE id = CAST(:audit_id AS uuid)
                """
            ),
            {
                "audit_id": audit_id,
                "inserted_rows": inserted_rows,
                "updated_rows": updated_rows,
            },
        )

    result = {
        "status": "ok",
        "dataset_version": dataset_version,
        "source_file": str(input_csv.resolve()),
        "source_file_sha256": file_hash,
        "rows_input": int(len(frame)),
        "rows_inserted": int(inserted_rows),
        "rows_updated": int(updated_rows),
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Idempotent loader for outbound demand history backfill.")
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--input-csv", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--source-tag", default="manual_backfill")
    parser.add_argument("--warehouse-id", default=None, help="Override all rows to one warehouse UUID.")
    args = parser.parse_args()

    run(
        db_url=args.db_url,
        input_csv=Path(args.input_csv),
        dataset_version=args.dataset_version,
        source_tag=args.source_tag,
        warehouse_id_override=args.warehouse_id,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

