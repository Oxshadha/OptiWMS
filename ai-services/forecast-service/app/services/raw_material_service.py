from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session

from app.db.models import BomComponentMapping, ForecastPrediction, ForecastRun, RawMaterialRequirement
from app.services.runtime_data_source import resolve_raw_material_snapshot


@dataclass
class BomInputRow:
    fg_sku: str
    rm_sku: str
    qty_per_fg_unit: float
    scrap_rate: float = 0.0
    lead_time_days: int | None = None
    source: str = "manual"
    notes: str | None = None
    is_active: bool = True


def upsert_bom_mappings(db: Session, rows: list[BomInputRow]) -> dict:
    created = 0
    updated = 0
    for row in rows:
        fg = row.fg_sku.strip()
        rm = row.rm_sku.strip()
        if not fg or not rm:
            continue
        qty = max(float(row.qty_per_fg_unit), 0.0)
        scrap = min(max(float(row.scrap_rate or 0.0), 0.0), 5.0)
        existing = db.execute(
            select(BomComponentMapping).where(
                func.lower(BomComponentMapping.fg_sku) == fg.lower(),
                func.lower(BomComponentMapping.rm_sku) == rm.lower(),
            ).limit(1)
        ).scalar_one_or_none()
        if existing is None:
            db.add(
                BomComponentMapping(
                    fg_sku=fg,
                    rm_sku=rm,
                    qty_per_fg_unit=qty,
                    scrap_rate=scrap,
                    lead_time_days=row.lead_time_days,
                    source=row.source or "manual",
                    notes=row.notes,
                    is_active=1 if row.is_active else 0,
                )
            )
            created += 1
        else:
            existing.qty_per_fg_unit = qty
            existing.scrap_rate = scrap
            existing.lead_time_days = row.lead_time_days
            existing.source = row.source or existing.source or "manual"
            existing.notes = row.notes
            existing.is_active = 1 if row.is_active else 0
            updated += 1
    db.flush()
    return {"created": created, "updated": updated}


def list_bom_mappings(
    db: Session,
    fg_sku: str | None = None,
    rm_sku: str | None = None,
    active_only: bool = True,
) -> list[BomComponentMapping]:
    stmt = select(BomComponentMapping)
    if fg_sku:
        stmt = stmt.where(BomComponentMapping.fg_sku == fg_sku)
    if rm_sku:
        stmt = stmt.where(BomComponentMapping.rm_sku == rm_sku)
    if active_only:
        stmt = stmt.where(BomComponentMapping.is_active == 1)
    return db.execute(stmt.order_by(BomComponentMapping.fg_sku.asc(), BomComponentMapping.rm_sku.asc())).scalars().all()


def clear_raw_material_requirements_for_run(db: Session, run_id: int) -> None:
    db.execute(delete(RawMaterialRequirement).where(RawMaterialRequirement.run_id == run_id))


def _build_fg_demand_from_predictions(db: Session, run_id: int) -> dict[str, float]:
    rows = db.execute(
        select(
            ForecastPrediction.sku,
            func.sum(ForecastPrediction.p50).label("demand_sum"),
        ).where(
            ForecastPrediction.run_id == run_id
        ).group_by(ForecastPrediction.sku)
    ).all()
    out: dict[str, float] = {}
    for sku, demand_sum in rows:
        out[str(sku)] = float(demand_sum or 0.0)
    return out


def persist_raw_material_requirements(
    db: Session,
    run: ForecastRun,
    fg_demand_by_sku: dict[str, float] | None = None,
) -> dict:
    fg_demand = fg_demand_by_sku or _build_fg_demand_from_predictions(db, run.id)
    mappings = list_bom_mappings(db, active_only=True)
    clear_raw_material_requirements_for_run(db, run.id)

    if not fg_demand:
        return {"rows": 0, "reason": "no_fg_demand"}
    if not mappings:
        return {"rows": 0, "reason": "no_bom_mapping"}

    rm_snapshot_rows, rm_source = resolve_raw_material_snapshot(run.warehouse_id)
    rm_snapshot = {r.rm_sku: r for r in rm_snapshot_rows}

    gross_by_rm: dict[str, float] = defaultdict(float)
    fg_set_by_rm: dict[str, set[str]] = defaultdict(set)
    for mapping in mappings:
        fg = str(mapping.fg_sku)
        rm = str(mapping.rm_sku)
        fg_demand_qty = float(fg_demand.get(fg, 0.0))
        if fg_demand_qty <= 0:
            continue
        component_qty = max(float(mapping.qty_per_fg_unit or 0.0), 0.0)
        scrap_mult = 1.0 + max(float(mapping.scrap_rate or 0.0), 0.0)
        gross = fg_demand_qty * component_qty * scrap_mult
        if gross <= 0:
            continue
        gross_by_rm[rm] += gross
        fg_set_by_rm[rm].add(fg)

    inserted = 0
    for rm_sku, gross_req in gross_by_rm.items():
        snapshot = rm_snapshot.get(rm_sku)
        on_hand = float(snapshot.on_hand_inventory) if snapshot else 0.0
        safety = float(snapshot.safety_stock) if snapshot and snapshot.safety_stock > 0 else gross_req * 0.1
        reorder_point = float(snapshot.reorder_point) if snapshot and snapshot.reorder_point > 0 else gross_req * 0.3
        net = max(gross_req - on_hand, 0.0)
        suggested = max(net + safety, 0.0)
        db.add(
            RawMaterialRequirement(
                run_id=run.id,
                dataset=run.dataset,
                model_name=run.model_name,
                warehouse_id=run.warehouse_id,
                rm_sku=rm_sku,
                rm_category=(snapshot.rm_category if snapshot else None),
                fg_sku_count=len(fg_set_by_rm.get(rm_sku, set())),
                gross_requirement_qty=float(gross_req),
                on_hand_inventory=float(on_hand),
                safety_stock=float(safety),
                reorder_point=float(reorder_point),
                net_requirement_qty=float(net),
                suggested_procure_qty=float(suggested),
            )
        )
        inserted += 1

    db.flush()
    return {"rows": inserted, "snapshot_source": rm_source}
