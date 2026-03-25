from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from xgboost import XGBRegressor

from artifacts import ARTIFACT_DIR
from benchmark_m5 import aggregate_m5_monthly, get_feature_tiers, make_features
from common import OUT_DIR, summarize_metrics


def load_boosting_artifact(dataset: str, model_name: str, horizon: int):
    path = ARTIFACT_DIR / dataset / f"{model_name}_h{horizon}".lower() / "production"
    meta = json.loads((path / "metadata.json").read_text(encoding="utf-8"))
    if model_name == "XGBOOST":
        reg = XGBRegressor()
        reg.load_model(str(path / "model.json"))
    elif model_name == "CATBOOST":
        reg = CatBoostRegressor()
        reg.load_model(str(path / "model.cbm"))
    else:
        raise ValueError(f"Unsupported model: {model_name}")
    return reg, meta


def assign_test_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    months = np.sort(df["month"].dropna().unique())
    train_end = pd.Timestamp(months[-(6 + 12 + 1)])
    val_end = pd.Timestamp(months[-(12 + 1)])
    out = df.copy()
    out["split"] = np.where(
        out["month"] <= train_end,
        "train",
        np.where(out["month"] <= val_end, "val", "test"),
    )
    return out, train_end, val_end


def predict_saved_model(dataset: str, model_name: str, m5_df: pd.DataFrame, horizons: list[int]) -> pd.DataFrame:
    y_train_lookup = {
        sid: g[g["split"] == "train"]["demand_units"].to_numpy(dtype=float)
        for sid, g in m5_df.groupby("series_id")
    }
    model_rows = []

    for horizon in horizons:
        reg, meta = load_boosting_artifact(dataset, model_name, horizon)
        dfh = make_features(m5_df.assign(scenario_split="all"), horizon=horizon)
        model_cols = meta["model_cols"]
        base_cols = ["series_id", "fg_code", "fg_category", "target", "target_month"]
        keep_cols = [c for c in list(dict.fromkeys(base_cols + model_cols)) if c in dfh.columns]
        d = dfh[keep_cols].dropna(subset=["target"]).copy()
        d = d[d["target_month"] > m5_df.loc[m5_df["split"] == "val", "month"].max()].copy()
        if d.empty:
            continue

        for col in model_cols:
            if col not in d.columns:
                d[col] = 0

        if model_name == "XGBOOST":
            feature_columns = meta.get("feature_columns") or []
            x = pd.get_dummies(d[model_cols], columns=[c for c in ["fg_code", "fg_category"] if c in d.columns], drop_first=False)
            x = x.reindex(columns=feature_columns, fill_value=0)
            preds = np.clip(reg.predict(x), 0, None)
        else:
            preds = np.clip(reg.predict(d[model_cols]), 0, None)

        sigma = float(np.std(d["target"].to_numpy(dtype=float) - preds))
        for row, yp in zip(d.itertuples(index=False), preds):
            model_rows.append(
                {
                    "dataset": f"M5_TRANSFER_{dataset}",
                    "model": model_name,
                    "series_id": row.series_id,
                    "fg_code": row.fg_code,
                    "fg_category": row.fg_category,
                    "month": row.target_month,
                    "split": "test",
                    "horizon": horizon,
                    "y_true": float(row.target),
                    "y_pred": float(yp),
                    "p10": float(max(0.0, yp - 1.28 * sigma)),
                    "p90": float(yp + 1.28 * sigma),
                }
            )

    pred_df = pd.DataFrame(model_rows)
    metrics = summarize_metrics(pred_df, "test", model_name, f"M5_TRANSFER_{dataset}", y_train_lookup) if not pred_df.empty else pd.DataFrame()
    return pred_df, metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--m5-dir", type=Path, required=True)
    parser.add_argument("--granularity", choices=["dept_store", "cat_store", "item_store"], default="dept_store")
    parser.add_argument("--sample-series", type=int, default=None)
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--datasets", nargs="+", default=["A", "B", "C"])
    parser.add_argument("--models", nargs="+", default=["XGBOOST", "CATBOOST"])
    parser.add_argument("--horizons", type=str, default="1,2,3,4,5,6,7,8,9,10,11,12")
    parser.add_argument("--tag", default="m5_saved_transfer")
    args = parser.parse_args()

    horizons = [int(x) for x in args.horizons.split(",") if x.strip()]
    m5_df = aggregate_m5_monthly(args.m5_dir, args.granularity, args.sample_series, args.chunk_size)
    m5_df, _, _ = assign_test_split(m5_df)

    reports = OUT_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)

    all_preds = []
    all_metrics = []
    for dataset in args.datasets:
        for model_name in args.models:
            pred_df, metrics = predict_saved_model(dataset, model_name, m5_df, horizons)
            if not pred_df.empty:
                all_preds.append(pred_df)
            if not metrics.empty:
                all_metrics.append(metrics)

    pred_all = pd.concat(all_preds, ignore_index=True) if all_preds else pd.DataFrame()
    metrics_all = pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame()
    pred_path = reports / f"{args.tag}_predictions.csv"
    metrics_path = reports / f"{args.tag}_metrics.csv"
    summary_path = reports / f"{args.tag}_summary.csv"

    if not pred_all.empty:
        pred_all.to_csv(pred_path, index=False)
    if not metrics_all.empty:
        metrics_all.to_csv(metrics_path, index=False)
        summary = metrics_all[metrics_all["horizon"] == 0].sort_values(["WAPE", "MASE_mean", "RMSE"]).reset_index(drop=True)
        summary.to_csv(summary_path, index=False)

    print(f"Saved predictions: {pred_path}")
    print(f"Saved metrics: {metrics_path}")
    print(f"Saved summary: {summary_path}")


if __name__ == "__main__":
    main()
