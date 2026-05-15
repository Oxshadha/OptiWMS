from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from common import OUT_DIR, get_split_dates, summarize_metrics
from run_classical import fit_predict

EXOG_COLS = [
    "on_hand_inventory",
    "stockout_days",
    "promotion_flag",
    "price_or_discount",
    "lead_time_days",
    "supplier_otif",
    "inbound_po_qty",
    "open_sales_orders",
    "returns_qty",
    "holiday_flag",
]

FEATURE_PROFILES = [
    "full",
    "lags_only",
    "lags_roll",
    "lags_roll_seasonal",
    "lags_roll_seasonal_category",
]

try:
    from lightgbm import LGBMRegressor
except Exception:
    LGBMRegressor = None


def make_features(df: pd.DataFrame, horizon: int) -> pd.DataFrame:
    out = df.copy().sort_values(["series_id", "month"])
    out["month_num"] = out["month"].dt.month
    out["quarter"] = out["month"].dt.quarter
    out["year"] = out["month"].dt.year
    out["month_sin"] = np.sin(2 * np.pi * out["month_num"] / 12.0)
    out["month_cos"] = np.cos(2 * np.pi * out["month_num"] / 12.0)

    for lag in [1, 2, 3, 6, 12]:
        out[f"lag_{lag}"] = out.groupby("series_id")["demand_units"].shift(lag)

    for w in [3, 6, 12]:
        out[f"roll_mean_{w}"] = out.groupby("series_id")["demand_units"].transform(
            lambda s: s.shift(1).rolling(w).mean()
        )
        out[f"roll_std_{w}"] = out.groupby("series_id")["demand_units"].transform(
            lambda s: s.shift(1).rolling(w).std()
        )

    for c in EXOG_COLS:
        if c in out.columns:
            out[f"{c}_lag1"] = out.groupby("series_id")[c].shift(1)

    out["target"] = out.groupby("series_id")["demand_units"].shift(-horizon)
    out["target_month"] = out.groupby("series_id")["month"].shift(-horizon)
    return out


def split_masks(dfh: pd.DataFrame, split_dates) -> tuple[pd.Series, pd.Series, pd.Series]:
    tmp = dfh[["target_month"]].copy().rename(columns={"target_month": "month"})
    target_split = np.where(
        tmp["month"] <= split_dates.train_end,
        "train",
        np.where(tmp["month"] <= split_dates.val_end, "val", "test"),
    )
    target_split = pd.Series(target_split, index=dfh.index)
    return target_split == "train", target_split == "val", target_split == "test"


def prepare_train_lookup(df: pd.DataFrame, split_dates) -> dict[str, np.ndarray]:
    tmp = df.copy()
    tmp["split"] = np.where(
        tmp["month"] <= split_dates.train_end,
        "train",
        np.where(tmp["month"] <= split_dates.val_end, "val", "test"),
    )
    lookup = {}
    for sid, g in tmp.groupby("series_id"):
        lookup[sid] = g[g["split"] == "train"]["demand_units"].to_numpy(dtype=float)
    return lookup


def get_feature_tiers(dfh: pd.DataFrame, feature_profile: str = "full") -> list[list[str]]:
    base = ["fg_code", "fg_category", "month_num", "quarter", "year", "month_sin", "month_cos"]
    lag12 = ["lag_12", "roll_mean_12", "roll_std_12"]
    lag6 = ["lag_6", "roll_mean_6", "roll_std_6"]
    lag3 = ["lag_3", "roll_mean_3", "roll_std_3"]
    lag2 = ["lag_2"]
    lag1 = ["lag_1"]

    exog_lag = [f"{c}_lag1" for c in EXOG_COLS if f"{c}_lag1" in dfh.columns]

    if feature_profile == "lags_only":
        return [lag1 + lag2 + ["lag_3", "lag_6", "lag_12"]]
    if feature_profile == "lags_roll":
        return [lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile == "lags_roll_seasonal":
        return [["month_num", "quarter", "year", "month_sin", "month_cos"] + lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile == "lags_roll_seasonal_category":
        return [base + lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile != "full":
        raise ValueError(f"Unsupported feature profile: {feature_profile}")

    tiers = [
        base + lag1 + lag2 + lag3 + lag6 + lag12 + exog_lag,
        base + lag1 + lag2 + lag3 + lag6 + exog_lag,
        base + lag1 + lag2 + lag3 + exog_lag,
        base + lag1 + lag2 + exog_lag,
        base + lag1 + exog_lag,
        base + lag1,
    ]
    return [list(dict.fromkeys(t)) for t in tiers]


def aggregate_m5_monthly(
    m5_dir: Path,
    granularity: str,
    sample_series: int | None,
    chunk_size: int,
) -> pd.DataFrame:
    sales_path = m5_dir / "sales_train_validation.csv"
    calendar_path = m5_dir / "calendar.csv"
    if not sales_path.exists() or not calendar_path.exists():
        raise FileNotFoundError(f"Missing M5 files under {m5_dir}")

    calendar = pd.read_csv(calendar_path, usecols=["d", "date"])
    calendar["month"] = pd.to_datetime(calendar["date"]).dt.to_period("M").dt.to_timestamp()

    day_cols = [f"d_{i}" for i in range(1, 1914)]
    calendar = calendar[calendar["d"].isin(day_cols)].copy()
    month_lookup = {
        month: grp["d"].tolist()
        for month, grp in calendar.groupby("month", sort=True)
    }

    partials: list[pd.DataFrame] = []
    usecols = ["item_id", "dept_id", "cat_id", "store_id", "state_id", *day_cols]
    for chunk in pd.read_csv(sales_path, usecols=usecols, chunksize=chunk_size):
        if granularity == "dept_store":
            chunk["series_id"] = chunk["dept_id"].astype(str) + "__" + chunk["store_id"].astype(str)
            chunk["fg_code"] = chunk["series_id"]
            chunk["fg_category"] = chunk["dept_id"].astype(str)
        elif granularity == "cat_store":
            chunk["series_id"] = chunk["cat_id"].astype(str) + "__" + chunk["store_id"].astype(str)
            chunk["fg_code"] = chunk["series_id"]
            chunk["fg_category"] = chunk["cat_id"].astype(str)
        elif granularity == "item_store":
            chunk["series_id"] = chunk["item_id"].astype(str) + "__" + chunk["store_id"].astype(str)
            chunk["fg_code"] = chunk["series_id"]
            chunk["fg_category"] = chunk["cat_id"].astype(str)
        else:
            raise ValueError(f"Unsupported granularity: {granularity}")

        grouped = (
            chunk.groupby(["series_id", "fg_code", "fg_category"], as_index=False)[day_cols]
            .sum()
        )

        monthly_rows = []
        for month, cols in month_lookup.items():
            tmp = grouped[["series_id", "fg_code", "fg_category"]].copy()
            tmp["month"] = month
            tmp["demand_units"] = grouped[cols].sum(axis=1).astype(float)
            monthly_rows.append(tmp)

        partials.append(pd.concat(monthly_rows, ignore_index=True))

    if not partials:
        raise ValueError("No M5 rows were aggregated.")

    df = pd.concat(partials, ignore_index=True)
    df = (
        df.groupby(["series_id", "fg_code", "fg_category", "month"], as_index=False)["demand_units"]
        .sum()
        .sort_values(["series_id", "month"])
        .reset_index(drop=True)
    )

    if sample_series is not None:
        keep = (
            df["series_id"]
            .drop_duplicates()
            .sample(n=min(sample_series, df["series_id"].nunique()), random_state=42)
            .tolist()
        )
        df = df[df["series_id"].isin(keep)].copy()

    return df


def fit_predict_snaive(y_train: np.ndarray, steps: int, season_length: int = 12) -> np.ndarray:
    y_train = np.asarray(y_train, dtype=float)
    if len(y_train) == 0:
        return np.zeros(steps, dtype=float)
    if len(y_train) < season_length:
        base = np.repeat(y_train[-1], steps)
        return np.clip(base, 0, None)

    last_season = y_train[-season_length:]
    reps = int(np.ceil(steps / season_length))
    pred = np.tile(last_season, reps)[:steps]
    return np.clip(pred, 0, None)


def run_classical_like(df: pd.DataFrame, dataset_name: str, models: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    split_dates = get_split_dates(df)
    df = df.copy()
    df["split"] = np.where(
        df["month"] <= split_dates.train_end,
        "train",
        np.where(df["month"] <= split_dates.val_end, "val", "test"),
    )

    y_train_lookup: dict[str, np.ndarray] = {}
    all_forecasts: list[pd.DataFrame] = []
    all_metrics: list[pd.DataFrame] = []

    for model_name in models:
        model_rows = []
        failed_series = 0

        for sid, g in df.groupby("series_id"):
            g = g.sort_values("month")
            y = g["demand_units"].to_numpy(dtype=float)
            if len(y) < 24:
                continue

            train_mask = g["split"].eq("train").to_numpy()
            val_mask = g["split"].eq("val").to_numpy()
            test_mask = g["split"].eq("test").to_numpy()

            y_train = y[train_mask]
            y_train_val = y[train_mask | val_mask]
            y_val = y[val_mask]
            y_test = y[test_mask]

            if len(y_val) == 0 or len(y_test) == 0:
                continue

            y_train_lookup[sid] = y_train

            try:
                if model_name == "SNAIVE12":
                    pred_val = fit_predict_snaive(y_train, len(y_val))
                    pred_test = fit_predict_snaive(y_train_val, len(y_test))
                else:
                    pred_val = fit_predict(model_name, y_train, len(y_val))
                    pred_test = fit_predict(model_name, y_train_val, len(y_test))
            except Exception:
                failed_series += 1
                continue

            resid_sigma = float(np.std(y_train - np.mean(y_train))) if len(y_train) > 1 else 0.0
            fg_code = str(g["fg_code"].iloc[0])
            fg_cat = str(g["fg_category"].iloc[0])

            for i, (m, yt, yp) in enumerate(zip(g.loc[val_mask, "month"], y_val, pred_val), start=1):
                model_rows.append(
                    {
                        "dataset": dataset_name,
                        "model": model_name,
                        "series_id": sid,
                        "fg_code": fg_code,
                        "fg_category": fg_cat,
                        "month": m,
                        "split": "val",
                        "horizon": i,
                        "y_true": float(yt),
                        "y_pred": float(yp),
                        "p10": float(max(0.0, yp - 1.28 * resid_sigma)),
                        "p90": float(yp + 1.28 * resid_sigma),
                    }
                )

            for i, (m, yt, yp) in enumerate(zip(g.loc[test_mask, "month"], y_test, pred_test), start=1):
                model_rows.append(
                    {
                        "dataset": dataset_name,
                        "model": model_name,
                        "series_id": sid,
                        "fg_code": fg_code,
                        "fg_category": fg_cat,
                        "month": m,
                        "split": "test",
                        "horizon": i,
                        "y_true": float(yt),
                        "y_pred": float(yp),
                        "p10": float(max(0.0, yp - 1.28 * resid_sigma)),
                        "p90": float(yp + 1.28 * resid_sigma),
                    }
                )

        pred_df = pd.DataFrame(model_rows)
        if pred_df.empty:
            print(f"[WARN] {dataset_name}/{model_name}: no predictions generated.")
            continue

        all_forecasts.append(pred_df)
        met_val = summarize_metrics(pred_df, "val", model_name, dataset_name, y_train_lookup, seasonal_period=12)
        met_test = summarize_metrics(pred_df, "test", model_name, dataset_name, y_train_lookup, seasonal_period=12)
        met_df = pd.concat([met_val, met_test], ignore_index=True)
        all_metrics.append(met_df)
        print(
            f"[OK] {dataset_name}/{model_name}: forecasts={len(pred_df)}, metrics={len(met_df)}, "
            f"failed_series={failed_series}"
        )

    return (
        pd.concat(all_forecasts, ignore_index=True) if all_forecasts else pd.DataFrame(),
        pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame(),
    )


def run_boosting_like(
    df: pd.DataFrame,
    dataset_name: str,
    models: list[str],
    horizons: list[int],
    feature_profile: str = "full",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not models:
        return pd.DataFrame(), pd.DataFrame()

    split_dates = get_split_dates(df)
    y_train_lookup = prepare_train_lookup(df, split_dates)

    feature_base = [
        "series_id",
        "fg_code",
        "fg_category",
        "month",
        "target_month",
        "target",
        "scenario_split",
    ]

    all_forecasts = []
    all_metrics = []

    from catboost import CatBoostRegressor
    from xgboost import XGBRegressor

    for model_name in models:
        model_rows = []

        for h in horizons:
            dfh = make_features(df.assign(scenario_split="all"), horizon=h)
            chosen_cols = None
            train_df = val_df = test_df = None

            for model_cols in get_feature_tiers(dfh, feature_profile=feature_profile):
                keep_cols = list(dict.fromkeys(feature_base + model_cols))
                d = dfh[keep_cols].dropna(subset=["target"]).dropna(subset=model_cols)
                train_mask, val_mask, test_mask = split_masks(d, split_dates)
                tr = d[train_mask].copy()
                va = d[val_mask].copy()
                te = d[test_mask].copy()
                if not tr.empty and not va.empty and not te.empty:
                    chosen_cols = model_cols
                    train_df, val_df, test_df = tr, va, te
                    break

            if chosen_cols is None:
                continue

            if model_name in {"XGBOOST", "LIGHTGBM", "RANDOM_FOREST"}:
                cat_cols = [c for c in ["fg_code", "fg_category"] if c in chosen_cols]
                x_train = pd.get_dummies(train_df[chosen_cols], columns=cat_cols, drop_first=False)
                x_val = pd.get_dummies(val_df[chosen_cols], columns=cat_cols, drop_first=False)
                x_test = pd.get_dummies(test_df[chosen_cols], columns=cat_cols, drop_first=False)

                cols = sorted(set(x_train.columns) | set(x_val.columns) | set(x_test.columns))
                x_train = x_train.reindex(columns=cols, fill_value=0)
                x_val = x_val.reindex(columns=cols, fill_value=0)
                x_test = x_test.reindex(columns=cols, fill_value=0)

                if model_name == "XGBOOST":
                    reg = XGBRegressor(
                        n_estimators=500,
                        learning_rate=0.05,
                        max_depth=6,
                        subsample=0.85,
                        colsample_bytree=0.85,
                        reg_alpha=0.0,
                        reg_lambda=1.0,
                        objective="reg:squarederror",
                        random_state=42,
                        n_jobs=1,
                    )
                    reg.fit(x_train, train_df["target"].to_numpy(), eval_set=[(x_val, val_df["target"].to_numpy())], verbose=False)
                elif model_name == "LIGHTGBM":
                    if LGBMRegressor is None:
                        raise RuntimeError("LIGHTGBM requested but lightgbm is not installed.")
                    reg = LGBMRegressor(
                        n_estimators=700,
                        learning_rate=0.05,
                        num_leaves=31,
                        subsample=0.85,
                        colsample_bytree=0.85,
                        random_state=42,
                        n_jobs=1,
                    )
                    reg.fit(x_train, train_df["target"].to_numpy())
                else:
                    reg = RandomForestRegressor(
                        n_estimators=500,
                        random_state=42,
                        n_jobs=1,
                    )
                    reg.fit(x_train, train_df["target"].to_numpy())
                p_val = np.clip(reg.predict(x_val), 0, None)
                p_test = np.clip(reg.predict(x_test), 0, None)
            elif model_name == "CATBOOST":
                reg = CatBoostRegressor(
                    loss_function="RMSE",
                    iterations=700,
                    learning_rate=0.05,
                    depth=7,
                    random_seed=42,
                    thread_count=1,
                    verbose=False,
                )
                reg.fit(
                    train_df[chosen_cols],
                    train_df["target"],
                    cat_features=[chosen_cols.index(c) for c in ["fg_code", "fg_category"] if c in chosen_cols],
                    eval_set=(val_df[chosen_cols], val_df["target"]),
                    use_best_model=True,
                    verbose=False,
                )
                p_val = np.clip(reg.predict(val_df[chosen_cols]), 0, None)
                p_test = np.clip(reg.predict(test_df[chosen_cols]), 0, None)
            else:
                raise ValueError(f"Unsupported boosting model: {model_name}")

            sigma = float(np.std(val_df["target"].to_numpy() - p_val))
            for part, part_df, part_pred in [("val", val_df, p_val), ("test", test_df, p_test)]:
                for row, yp in zip(part_df.itertuples(index=False), part_pred):
                    model_rows.append(
                        {
                            "dataset": dataset_name,
                            "model": model_name,
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

        pred_df = pd.DataFrame(model_rows)
        if pred_df.empty:
            print(f"[WARN] {dataset_name}/{model_name}: no predictions generated.")
            continue

        all_forecasts.append(pred_df)
        met_val = summarize_metrics(pred_df, "val", model_name, dataset_name, y_train_lookup, seasonal_period=12)
        met_test = summarize_metrics(pred_df, "test", model_name, dataset_name, y_train_lookup, seasonal_period=12)
        all_metrics.append(pd.concat([met_val, met_test], ignore_index=True))
        print(f"[OK] {dataset_name}/{model_name}: forecasts={len(pred_df)}, metrics={len(met_val) + len(met_test)}")

    return (
        pd.concat(all_forecasts, ignore_index=True) if all_forecasts else pd.DataFrame(),
        pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame(),
    )


def save_report(
    forecasts: pd.DataFrame,
    metrics: pd.DataFrame,
    dataset_name: str,
    granularity: str,
    sample_series: int | None,
) -> tuple[Path, Path]:
    report_dir = OUT_DIR / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    suffix = f"m5_{granularity}"
    if sample_series is not None:
        suffix += f"_sample{sample_series}"

    forecast_path = report_dir / f"{suffix}_forecast_output.csv"
    metrics_path = report_dir / f"{suffix}_metrics.csv"
    summary_path = report_dir / f"{suffix}_summary.csv"

    forecasts.to_csv(forecast_path, index=False)
    metrics.to_csv(metrics_path, index=False)

    summary = (
        metrics[(metrics["split"] == "test") & (metrics["horizon"] == 0)]
        .sort_values(["WAPE", "MASE_mean", "RMSE"])
        .reset_index(drop=True)
    )
    summary["dataset"] = dataset_name
    summary.to_csv(summary_path, index=False)
    return metrics_path, summary_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--m5-dir", type=Path, required=True)
    parser.add_argument("--granularity", choices=["dept_store", "cat_store", "item_store"], default="dept_store")
    parser.add_argument("--sample-series", type=int, default=None)
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--classical-models", nargs="*", default=["SNAIVE12", "ETS", "ARIMA", "SARIMA"])
    parser.add_argument("--boosting-models", nargs="*", default=["XGBOOST", "CATBOOST"])
    parser.add_argument("--horizons", type=str, default="1,2,3,4,5,6,7,8,9,10,11,12")
    parser.add_argument("--feature-profile", choices=FEATURE_PROFILES, default="full")
    args = parser.parse_args()

    dataset_name = f"M5_{args.granularity.upper()}"
    df = aggregate_m5_monthly(args.m5_dir, args.granularity, args.sample_series, args.chunk_size)

    classical_forecasts, classical_metrics = run_classical_like(df, dataset_name, args.classical_models)
    boosting_forecasts, boosting_metrics = run_boosting_like(
        df,
        dataset_name,
        args.boosting_models,
        [int(x) for x in args.horizons.split(",") if x.strip()],
        args.feature_profile,
    )

    forecasts = pd.concat([classical_forecasts, boosting_forecasts], ignore_index=True)
    metrics = pd.concat([classical_metrics, boosting_metrics], ignore_index=True)
    if forecasts.empty or metrics.empty:
        raise ValueError("Benchmark did not produce outputs.")

    metrics_path, summary_path = save_report(forecasts, metrics, dataset_name, args.granularity, args.sample_series)
    print(f"Saved benchmark metrics: {metrics_path}")
    print(f"Saved benchmark summary: {summary_path}")


if __name__ == "__main__":
    main()
