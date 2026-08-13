from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class V7Config:
    database_url: str
    schema: str
    warehouse_code: str
    model_name: str
    history_min_months: int
    backtest_months: int
    forecast_horizon_months: int
    material_types: list[str]
    output_dir: Path
    service_level_z: float
    default_lead_time_days: int
    default_lead_time_std_days: float
    default_supplier_otif: float
    intermittent_nonzero_threshold: float
    abc_a_cutoff: float
    abc_b_cutoff: float


def load_config(path: str | Path | None = None) -> V7Config:
    cfg_path = Path(path) if path else ROOT / "pipeline" / "config.yaml"
    raw: dict[str, Any] = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    out_dir = Path(raw.get("output_dir", "outputs"))
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    return V7Config(
        database_url=str(raw["database_url"]),
        schema=str(raw.get("schema", "public")),
        warehouse_code=str(raw.get("warehouse_code", "WH-001")),
        model_name=str(raw.get("model_name", "V7_RM_PM_DIRECT")),
        history_min_months=int(raw.get("history_min_months", 18)),
        backtest_months=int(raw.get("backtest_months", 6)),
        forecast_horizon_months=int(raw.get("forecast_horizon_months", 12)),
        material_types=[str(x).lower() for x in raw.get("material_types", ["raw_material", "packaging_material"])],
        output_dir=out_dir,
        service_level_z=float(raw.get("service_level_z", 1.65)),
        default_lead_time_days=int(raw.get("default_lead_time_days", 14)),
        default_lead_time_std_days=float(raw.get("default_lead_time_std_days", 0)),
        default_supplier_otif=float(raw.get("default_supplier_otif", 0.95)),
        intermittent_nonzero_threshold=float(raw.get("intermittent_nonzero_threshold", 0.55)),
        abc_a_cutoff=float(raw.get("abc_a_cutoff", 0.80)),
        abc_b_cutoff=float(raw.get("abc_b_cutoff", 0.95)),
    )


def ensure_output_dirs(cfg: V7Config) -> None:
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    (cfg.output_dir / "plots").mkdir(parents=True, exist_ok=True)
