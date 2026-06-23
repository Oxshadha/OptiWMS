"""Load bootstrap, engineered, or WMS outbound training data."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from pipeline.bootstrap_data import generate_bootstrap_fg_monthly

ROOT = Path(__file__).resolve().parents[1]
MODELING_ROOT = ROOT.parent


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (ROOT / p).resolve()


def load_raw_fg(data_source: str, cfg: dict) -> pd.DataFrame:
    paths = cfg.get("paths", {})
    engineered = _resolve(paths.get("engineered_csv", "data/engineered/fg_features_engineered.csv"))
    scenario_c = _resolve(paths.get("scenario_c_csv", "../Forecast model train data optiwms/hemas_scenario_c_dataset_cleaned.csv"))
    bootstrap = _resolve(paths.get("bootstrap_csv", "data/bootstrap_fg_monthly.csv"))
    wms_csv = _resolve(paths.get("wms_export_csv", "data/wms_outbound_monthly.csv"))

    if data_source == "wms":
        if not wms_csv.exists():
            raise FileNotFoundError(
                f"WMS export not found: {wms_csv}. Run pipeline.export_wms or backfill pipeline first."
            )
        fg = pd.read_csv(wms_csv)
        fg["month"] = pd.to_datetime(fg["month"]).dt.to_period("M").dt.to_timestamp()
        return fg

    if data_source == "engineered" and engineered.exists():
        fg = pd.read_csv(engineered)
        fg["month"] = pd.to_datetime(fg["month"])
        return fg

    if scenario_c.exists():
        fg = pd.read_csv(scenario_c)
        fg["month"] = pd.to_datetime(fg["month"]).dt.to_period("M").dt.to_timestamp()
        if "demand_units_clean" in fg.columns:
            fg["demand_units"] = fg["demand_units_clean"]
        return fg

    bootstrap.parent.mkdir(parents=True, exist_ok=True)
    if not bootstrap.exists():
        fg = generate_bootstrap_fg_monthly(seed=int(cfg.get("seed", 42)))
        fg.to_csv(bootstrap, index=False)
    else:
        fg = pd.read_csv(bootstrap)
        fg["month"] = pd.to_datetime(fg["month"])
    return fg


def wms_data_ready(cfg: dict) -> tuple[bool, dict]:
    """Check if WMS export meets minimum months/SKU threshold."""
    paths = cfg.get("paths", {})
    wms_csv = _resolve(paths.get("wms_export_csv", "data/wms_outbound_monthly.csv"))
    min_months = int(cfg.get("wms_min_months", 12))
    min_skus = int(cfg.get("wms_min_skus", 20))
    if not wms_csv.exists():
        return False, {"reason": "missing_export", "path": str(wms_csv)}

    df = pd.read_csv(wms_csv)
    if df.empty or "month" not in df.columns:
        return False, {"reason": "empty_or_invalid"}

    df["month"] = pd.to_datetime(df["month"])
    sku_col = "fg_code" if "fg_code" in df.columns else "sku_code"
    n_months = df["month"].dt.to_period("M").nunique()
    n_skus = df[sku_col].nunique() if sku_col in df.columns else 0
    ready = n_months >= min_months and n_skus >= min_skus
    return ready, {"months": int(n_months), "skus": int(n_skus), "min_months": min_months, "min_skus": min_skus}


def export_wms_from_csv(source_csv: Path, out_csv: Path) -> Path:
    """Normalize backfill / synthetic runtime CSV to monthly FG panel."""
    df = pd.read_csv(source_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    month_col = next((c for c in ("month", "period_month", "anchor_month") if c in df.columns), None)
    sku_col = next((c for c in ("fg_code", "sku_code", "material_code") if c in df.columns), None)
    demand_col = next((c for c in ("demand_units", "qty", "quantity") if c in df.columns), None)
    if not month_col or not sku_col or not demand_col:
        raise ValueError(f"Cannot normalize WMS CSV columns: {list(df.columns)}")

    panel = df[[month_col, sku_col, demand_col]].copy()
    panel.columns = ["month", "fg_code", "demand_units"]
    panel["month"] = pd.to_datetime(panel["month"]).dt.to_period("M").dt.to_timestamp()
    panel = panel.groupby(["fg_code", "month"], as_index=False)["demand_units"].sum()
    panel["fg_category"] = "FG"
    panel["fg_name"] = panel["fg_code"]
    panel.to_csv(out_csv, index=False)
    return out_csv
