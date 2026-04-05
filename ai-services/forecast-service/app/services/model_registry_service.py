from __future__ import annotations

import json
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ModelRegistryEntry


def list_registry_entries(
    db: Session,
    dataset: str | None = None,
    warehouse_id: str | None = None,
    status: str | None = None,
) -> list[ModelRegistryEntry]:
    stmt = select(ModelRegistryEntry)
    if dataset:
        stmt = stmt.where(ModelRegistryEntry.dataset == dataset)
    if warehouse_id is not None:
        stmt = stmt.where(ModelRegistryEntry.warehouse_id == warehouse_id)
    if status:
        stmt = stmt.where(ModelRegistryEntry.status == status)
    stmt = stmt.order_by(desc(ModelRegistryEntry.is_champion), ModelRegistryEntry.priority.asc(), ModelRegistryEntry.id.desc())
    return db.execute(stmt).scalars().all()


def resolve_champion_model(
    db: Session,
    dataset: str,
    warehouse_id: str | None = None,
) -> tuple[str, str]:
    scoped = select(ModelRegistryEntry).where(
        ModelRegistryEntry.dataset == dataset,
        ModelRegistryEntry.status == "active",
        ModelRegistryEntry.is_champion == 1,
    )
    if warehouse_id:
        scoped_rows = db.execute(
            scoped.where(ModelRegistryEntry.warehouse_id == warehouse_id).order_by(ModelRegistryEntry.priority.asc(), ModelRegistryEntry.id.desc())
        ).scalars().all()
        if scoped_rows:
            top = scoped_rows[0]
            return top.model_name, top.model_version

    global_rows = db.execute(
        scoped.where(ModelRegistryEntry.warehouse_id.is_(None)).order_by(ModelRegistryEntry.priority.asc(), ModelRegistryEntry.id.desc())
    ).scalars().all()
    if global_rows:
        top = global_rows[0]
        return top.model_name, top.model_version

    # Fallback to static champion map in config when DB registry has not been seeded yet.
    champion_map: dict[str, Any] = {}
    try:
        champion_map = json.loads(settings.champion_models_json or "{}")
    except Exception:
        champion_map = {}

    model_name = champion_map.get(dataset)
    if isinstance(model_name, str) and model_name.strip():
        return model_name.strip(), "v1"

    # Final safe default.
    return "CATBOOST", "v1"


def promote_champion(
    db: Session,
    entry_id: int,
) -> ModelRegistryEntry:
    entry = db.get(ModelRegistryEntry, entry_id)
    if not entry:
        raise ValueError("registry entry not found")
    if entry.status != "active":
        raise ValueError("only active entries can be promoted")

    same_scope = select(ModelRegistryEntry).where(
        ModelRegistryEntry.dataset == entry.dataset,
        ModelRegistryEntry.status == "active",
        ModelRegistryEntry.warehouse_id == entry.warehouse_id,
    )
    rows = db.execute(same_scope).scalars().all()
    for row in rows:
        row.is_champion = 1 if row.id == entry.id else 0
    db.flush()
    return entry

