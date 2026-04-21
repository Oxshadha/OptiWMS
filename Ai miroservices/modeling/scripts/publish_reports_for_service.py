from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from common import OUT_DIR


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return pd.read_csv(path)


def _ensure_forecast_schema(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "forecast_p50" not in out.columns and "y_pred" in out.columns:
        out = out.rename(columns={"y_pred": "forecast_p50"})
    required = {"dataset", "model", "fg_code", "month", "horizon", "forecast_p50", "p10", "p90"}
    missing = sorted(required - set(out.columns))
    if missing:
        raise ValueError(f"Forecast report missing columns: {missing}")
    return out


def _ensure_inventory_schema(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    required = {"dataset", "model", "fg_code", "safety_stock", "reorder_point", "target_max", "suggested_order_qty"}
    missing = sorted(required - set(out.columns))
    if missing:
        raise ValueError(f"Inventory report missing columns: {missing}")
    return out


def _ensure_metrics_schema(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    required = {"dataset", "model", "split", "horizon", "WAPE", "RMSE", "Bias", "MASE_mean"}
    missing = sorted(required - set(out.columns))
    if missing:
        raise ValueError(f"Metrics report missing columns: {missing}")
    return out


def _build_inventory_placeholder_from_forecast(forecast_df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        forecast_df.groupby(["dataset", "model", "fg_code", "fg_category"], as_index=False)
        .agg(forecast_p50=("forecast_p50", "mean"))
    )
    grouped["series_id"] = grouped["fg_code"].astype(str)
    grouped["safety_stock"] = 0.0
    grouped["reorder_point"] = grouped["forecast_p50"].round(3)
    grouped["target_max"] = (grouped["forecast_p50"] * 2.0).round(3)
    grouped["on_hand_inventory"] = 0.0
    grouped["suggested_order_qty"] = grouped["target_max"]
    return grouped[
        [
            "dataset",
            "model",
            "series_id",
            "fg_code",
            "fg_category",
            "safety_stock",
            "reorder_point",
            "target_max",
            "on_hand_inventory",
            "suggested_order_qty",
        ]
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish report trio for forecast microservice ingestion.")
    parser.add_argument("--tag", required=True, help="Report prefix tag, e.g. portable_fair_play_p")
    parser.add_argument("--dataset", default=None, help="Optional dataset filter, e.g. B or P")
    parser.add_argument("--model", default=None, help="Optional model filter, e.g. CATBOOST")
    args = parser.parse_args()

    reports_dir = OUT_DIR / "reports"
    forecast_src = reports_dir / f"{args.tag}_forecasts.csv"
    inventory_src = reports_dir / f"{args.tag}_inventory.csv"
    metrics_src = reports_dir / f"{args.tag}_metrics.csv"

    forecast_df = _ensure_forecast_schema(_read_csv(forecast_src))
    if inventory_src.exists():
        inventory_df = _ensure_inventory_schema(_read_csv(inventory_src))
    else:
        inventory_df = _build_inventory_placeholder_from_forecast(forecast_df)
    metrics_df = _ensure_metrics_schema(_read_csv(metrics_src))

    if args.dataset:
        ds = str(args.dataset).upper()
        forecast_df = forecast_df[forecast_df["dataset"].astype(str).str.upper() == ds]
        inventory_df = inventory_df[inventory_df["dataset"].astype(str).str.upper() == ds]
        metrics_df = metrics_df[metrics_df["dataset"].astype(str).str.upper() == ds]

    if args.model:
        model = str(args.model).upper()
        forecast_df = forecast_df[forecast_df["model"].astype(str).str.upper() == model]
        inventory_df = inventory_df[inventory_df["model"].astype(str).str.upper() == model]
        metrics_df = metrics_df[metrics_df["model"].astype(str).str.upper() == model]

    if forecast_df.empty or metrics_df.empty:
        raise ValueError(
            "Filtered publish result is empty. Check --tag, --dataset, --model values against available reports."
        )

    forecast_out = reports_dir / "dashboard_forecast_output.csv"
    inventory_out = reports_dir / "dashboard_inventory_recommendations.csv"
    metrics_out = reports_dir / "test_metrics_by_horizon.csv"

    forecast_df.to_csv(forecast_out, index=False)
    inventory_df.to_csv(inventory_out, index=False)
    metrics_df.to_csv(metrics_out, index=False)

    print(f"[OK] Wrote {forecast_out} rows={len(forecast_df)}")
    print(f"[OK] Wrote {inventory_out} rows={len(inventory_df)}")
    print(f"[OK] Wrote {metrics_out} rows={len(metrics_df)}")
    print(
        "[OK] Ready for trigger-run ingestion: dataset(s)="
        f"{sorted(forecast_df['dataset'].astype(str).str.upper().unique().tolist())}, "
        f"model(s)={sorted(forecast_df['model'].astype(str).str.upper().unique().tolist())}"
    )


if __name__ == "__main__":
    main()
