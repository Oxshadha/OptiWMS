from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

from artifacts import save_catboost_model, save_metadata
from common import OUT_DIR, add_series_id, assign_time_split, get_split_dates, load_dataset, summarize_metrics
from run_boosting import get_feature_tiers, make_features, split_masks


@dataclass
class SplitBundle:
    train_df: pd.DataFrame
    val_df: pd.DataFrame
    test_df: pd.DataFrame
    model_cols: list[str]


def prepare_train_lookup(df: pd.DataFrame, split_dates) -> dict[str, np.ndarray]:
    tmp = df.copy()
    tmp["split"] = assign_time_split(tmp, split_dates)
    lookup = {}
    for sid, g in tmp.groupby("series_id"):
        lookup[sid] = g[g["split"] == "train"]["demand_units"].to_numpy(dtype=float)
    return lookup


def build_split_bundle(dfh: pd.DataFrame, dataset: str, split_dates, feature_profile: str) -> SplitBundle | None:
    feature_base = [
        "series_id",
        "fg_code",
        "fg_category",
        "month",
        "target_month",
        "target",
        "scenario_split",
    ]
    for model_cols in get_feature_tiers(dfh, feature_profile=feature_profile):
        keep_cols = list(dict.fromkeys(feature_base + model_cols))
        d = dfh[keep_cols].dropna(subset=["target"]).dropna(subset=model_cols)
        train_mask, val_mask, test_mask = split_masks(d, dataset, split_dates)
        train_df = d[train_mask].copy()
        val_df = d[val_mask].copy()
        test_df = d[test_mask].copy()
        if not train_df.empty and not val_df.empty and not test_df.empty:
            return SplitBundle(train_df=train_df, val_df=val_df, test_df=test_df, model_cols=model_cols)
    return None


def fit_and_predict(bundle: SplitBundle, params: dict) -> tuple[np.ndarray, np.ndarray, float, CatBoostRegressor]:
    reg = CatBoostRegressor(**params)
    cat_cols = ["fg_code", "fg_category"]
    cat_idx = [bundle.model_cols.index(c) for c in cat_cols if c in bundle.model_cols]
    reg.fit(
        bundle.train_df[bundle.model_cols],
        bundle.train_df["target"],
        cat_features=cat_idx,
        eval_set=(bundle.val_df[bundle.model_cols], bundle.val_df["target"]),
        use_best_model=True,
        verbose=False,
    )
    p_val = np.clip(reg.predict(bundle.val_df[bundle.model_cols]), 0, None)
    p_test = np.clip(reg.predict(bundle.test_df[bundle.model_cols]), 0, None)
    sigma = float(np.std(bundle.val_df["target"].to_numpy(dtype=float) - p_val))
    return p_val, p_test, sigma, reg


def trial_space() -> list[dict]:
    return [
        {"iterations": 900, "learning_rate": 0.03, "depth": 8, "l2_leaf_reg": 3.0},
        {"iterations": 1000, "learning_rate": 0.03, "depth": 9, "l2_leaf_reg": 5.0},
        {"iterations": 1100, "learning_rate": 0.025, "depth": 8, "l2_leaf_reg": 7.0},
        {"iterations": 700, "learning_rate": 0.05, "depth": 7, "l2_leaf_reg": 3.0},
        {"iterations": 800, "learning_rate": 0.04, "depth": 8, "l2_leaf_reg": 5.0},
        {"iterations": 1200, "learning_rate": 0.02, "depth": 10, "l2_leaf_reg": 9.0},
        {"iterations": 900, "learning_rate": 0.035, "depth": 9, "l2_leaf_reg": 6.0},
        {"iterations": 1000, "learning_rate": 0.025, "depth": 7, "l2_leaf_reg": 4.0},
    ]


def with_defaults(params: dict) -> dict:
    out = {
        "loss_function": "RMSE",
        "random_seed": 42,
        "thread_count": 1,
        "verbose": False,
    }
    out.update(params)
    return out


def evaluate_trial(
    df: pd.DataFrame,
    dataset: str,
    split_dates,
    tune_horizons: list[int],
    feature_profile: str,
    params: dict,
) -> float:
    rows = []
    for h in tune_horizons:
        dfh = make_features(df, horizon=h)
        bundle = build_split_bundle(dfh, dataset, split_dates, feature_profile)
        if bundle is None:
            continue
        p_val, _p_test, _sigma, _reg = fit_and_predict(bundle, params)
        for row, yp in zip(bundle.val_df.itertuples(index=False), p_val):
            rows.append(
                {
                    "dataset": dataset,
                    "model": "CATBOOST",
                    "series_id": row.series_id,
                    "fg_code": row.fg_code,
                    "fg_category": row.fg_category,
                    "month": row.target_month,
                    "split": "val",
                    "horizon": h,
                    "y_true": float(row.target),
                    "y_pred": float(yp),
                    "p10": float(max(0.0, yp)),
                    "p90": float(yp),
                }
            )

    pred_df = pd.DataFrame(rows)
    if pred_df.empty:
        return float("inf")

    y_train_lookup = prepare_train_lookup(df, split_dates)
    m = summarize_metrics(pred_df, "val", "CATBOOST", dataset, y_train_lookup)
    if m.empty:
        return float("inf")
    row0 = m[m["horizon"] == 0]
    if row0.empty:
        return float("inf")
    wape = float(row0.iloc[0]["WAPE"])
    return wape if np.isfinite(wape) else float("inf")


def train_full_and_save(
    df: pd.DataFrame,
    dataset: str,
    split_dates,
    horizons: list[int],
    feature_profile: str,
    params: dict,
    tag: str,
) -> tuple[pd.DataFrame, pd.DataFrame, Path]:
    rows = []
    y_train_lookup = prepare_train_lookup(df, split_dates)

    artifact_rows: list[dict] = []
    for h in horizons:
        dfh = make_features(df, horizon=h)
        bundle = build_split_bundle(dfh, dataset, split_dates, feature_profile)
        if bundle is None:
            continue

        p_val, p_test, sigma, reg = fit_and_predict(bundle, params)
        for part, part_df, part_pred in [("val", bundle.val_df, p_val), ("test", bundle.test_df, p_test)]:
            for row, yp in zip(part_df.itertuples(index=False), part_pred):
                rows.append(
                    {
                        "dataset": dataset,
                        "model": "CATBOOST",
                        "series_id": row.series_id,
                        "fg_code": row.fg_code,
                        "fg_category": row.fg_category,
                        "month": row.target_month,
                        "split": part,
                        "horizon": h,
                        "y_true": float(row.target),
                        "y_pred": float(yp),
                        "p10": float(max(0.0, yp - 1.28 * sigma)),
                        "p90": float(yp + 1.28 * sigma),
                    }
                )

        meta = {
            "dataset": dataset,
            "model_name": "CATBOOST",
            "horizon": h,
            "feature_profile": feature_profile,
            "model_cols": bundle.model_cols,
            "params": params,
        }
        artifact_path = save_catboost_model(reg, dataset, f"CATBOOST_h{h}", "production", meta)
        artifact_rows.append({"dataset": dataset, "model": "CATBOOST", "series_id": f"h{h}", "artifact_path": str(artifact_path)})

    pred_df = pd.DataFrame(rows)
    metrics_df = pd.concat(
        [
            summarize_metrics(pred_df, "val", "CATBOOST", dataset, y_train_lookup),
            summarize_metrics(pred_df, "test", "CATBOOST", dataset, y_train_lookup),
        ],
        ignore_index=True,
    )

    reports = OUT_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    metrics_path = reports / f"{tag}_pv2_metrics.csv"
    forecasts_path = reports / f"{tag}_pv2_forecasts.csv"
    artifacts_path = reports / f"{tag}_pv2_artifacts.csv"
    leaderboard_path = reports / f"{tag}_leaderboard.csv"

    metrics_df.to_csv(metrics_path, index=False)
    pred_df.to_csv(forecasts_path, index=False)
    pd.DataFrame(artifact_rows).to_csv(artifacts_path, index=False)

    lb = (
        metrics_df[(metrics_df["split"] == "test") & (metrics_df["horizon"] == 0)]
        .sort_values(["WAPE", "MASE_mean", "RMSE"])  # one-row ranking expected
        .reset_index(drop=True)
    )
    lb.to_csv(leaderboard_path, index=False)

    save_metadata(
        reports / f"{tag}_run_metadata",
        {
            "dataset": dataset,
            "model": "CATBOOST",
            "feature_profile": feature_profile,
            "params": params,
            "horizons": horizons,
            "metrics_path": str(metrics_path),
            "forecasts_path": str(forecasts_path),
            "leaderboard_path": str(leaderboard_path),
        },
    )
    return metrics_df, pred_df, leaderboard_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="PV2")
    parser.add_argument("--feature-profile", default="lags_roll_seasonal_category")
    parser.add_argument("--horizons", default="1,2,3,4,5,6,7,8,9,10,11,12")
    parser.add_argument("--tune-horizons", default="1,3,6,12")
    parser.add_argument("--max-trials", type=int, default=8)
    parser.add_argument("--tag", default="pv2_enterprise_tuned")
    args = parser.parse_args()

    dataset = str(args.dataset).upper()
    horizons = [int(x) for x in args.horizons.split(",") if x.strip()]
    tune_horizons = [int(x) for x in args.tune_horizons.split(",") if x.strip()]

    df = add_series_id(load_dataset(dataset), dataset)
    split_dates = get_split_dates(df)

    trials = trial_space()[: max(1, int(args.max_trials))]
    best_params = None
    best_score = float("inf")

    print(f"[PV2-TUNE] dataset={dataset} feature_profile={args.feature_profile} trials={len(trials)}")
    for i, p in enumerate(trials, start=1):
        params = with_defaults(p)
        score = evaluate_trial(
            df=df,
            dataset=dataset,
            split_dates=split_dates,
            tune_horizons=tune_horizons,
            feature_profile=args.feature_profile,
            params=params,
        )
        print(f"[PV2-TUNE] trial={i} val_wape={score:.6f} params={json.dumps(p)}")
        if score < best_score:
            best_score = score
            best_params = params

    if best_params is None:
        raise RuntimeError("No valid PV2 trial produced metrics.")

    print(f"[PV2-TUNE] best_val_wape={best_score:.6f} best_params={json.dumps(best_params)}")
    metrics_df, _pred_df, leaderboard_path = train_full_and_save(
        df=df,
        dataset=dataset,
        split_dates=split_dates,
        horizons=horizons,
        feature_profile=args.feature_profile,
        params=best_params,
        tag=args.tag,
    )

    test0 = metrics_df[(metrics_df["split"] == "test") & (metrics_df["horizon"] == 0)]
    if test0.empty:
        raise RuntimeError("Missing test horizon=0 metrics after training.")
    row = test0.iloc[0]
    print(
        "[PV2-TUNE] final_test "
        f"WAPE={float(row['WAPE']):.6f} RMSE={float(row['RMSE']):.3f} "
        f"MASE={float(row['MASE_mean']) if pd.notna(row['MASE_mean']) else float('nan'):.6f} "
        f"leaderboard={leaderboard_path}"
    )


if __name__ == "__main__":
    main()
