from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def wape(y_true: pd.Series, y_pred: pd.Series) -> float:
    denom = float(np.abs(y_true).sum())
    if denom <= 0:
        return float("nan")
    return float(np.abs(y_true - y_pred).sum() / denom)


def rmse(y_true: pd.Series, y_pred: pd.Series) -> float:
    return float(np.sqrt(np.mean((y_true.to_numpy(dtype=float) - y_pred.to_numpy(dtype=float)) ** 2)))


def bias(y_true: pd.Series, y_pred: pd.Series) -> float:
    return float(np.mean(y_pred.to_numpy(dtype=float) - y_true.to_numpy(dtype=float)))


def summarize_group(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for keys, group in df.groupby(group_cols, dropna=False):
        if not isinstance(keys, tuple):
            keys = (keys,)
        row = {col: key for col, key in zip(group_cols, keys)}
        row.update(
            {
                "n_obs": int(len(group)),
                "WAPE": wape(group["y_true"], group["y_pred"]),
                "RMSE": rmse(group["y_true"], group["y_pred"]),
                "Bias": bias(group["y_true"], group["y_pred"]),
                "under_forecast_rate": float(np.mean(group["y_pred"] < group["y_true"])),
            }
        )
        rows.append(row)
    return pd.DataFrame(rows).sort_values(group_cols).reset_index(drop=True)


def add_family_bucket(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "fg_category" not in out.columns:
        out["family_bucket"] = "UNKNOWN"
        return out
    category = out["fg_category"].astype(str)
    out["family_bucket"] = np.where(category.str.contains("_"), category.str.split("_").str[0], category)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--out-dir", type=Path, default=Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports"))
    args = parser.parse_args()

    df = pd.read_csv(args.predictions)
    df = add_family_bucket(df)

    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    horizon_summary = summarize_group(df, ["dataset", "model", "horizon"])
    category_summary = summarize_group(df, ["dataset", "model", "fg_category"])
    family_summary = summarize_group(df, ["dataset", "model", "family_bucket"])

    horizon_path = out_dir / f"{args.tag}_by_horizon.csv"
    category_path = out_dir / f"{args.tag}_by_category.csv"
    family_path = out_dir / f"{args.tag}_by_family.csv"

    horizon_summary.to_csv(horizon_path, index=False)
    category_summary.to_csv(category_path, index=False)
    family_summary.to_csv(family_path, index=False)

    print(f"Saved horizon diagnostics: {horizon_path}")
    print(f"Saved category diagnostics: {category_path}")
    print(f"Saved family diagnostics: {family_path}")


if __name__ == "__main__":
    main()
