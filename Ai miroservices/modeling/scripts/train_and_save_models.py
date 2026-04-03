from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from xgboost import XGBRegressor

from artifacts import save_catboost_model, save_metadata, save_pickle_model, save_xgboost_model
from common import OUT_DIR, summarize_metrics
from preprocessing import CLEAN_DIR, clean_dataset, export_clean_dataset
from run_boosting import FEATURE_PROFILES, get_feature_tiers, make_features


CLASSICAL_MODELS = ["ETS", "ARIMA", "SARIMA"]
BOOSTING_MODELS = ["XGBOOST", "CATBOOST"]


def load_clean_dataset(dataset: str) -> pd.DataFrame:
    path = CLEAN_DIR / f"dataset_{dataset.lower()}_clean.csv"
    if path.exists():
        df = pd.read_csv(path)
        df["month"] = pd.to_datetime(df["month"])
        return df
    cleaned = clean_dataset(dataset)
    export_clean_dataset(cleaned, dataset)
    return cleaned


def assign_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
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


def prepare_train_lookup(df: pd.DataFrame) -> dict[str, np.ndarray]:
    return {
        sid: g[g["split"] == "train"]["demand_units"].to_numpy(dtype=float)
        for sid, g in df.groupby("series_id")
    }


def fit_classical_model(model_name: str, y_train: np.ndarray):
    if model_name == "ETS":
        try:
            return ExponentialSmoothing(
                y_train,
                trend="add",
                damped_trend=True,
                seasonal="add",
                seasonal_periods=12,
                initialization_method="estimated",
            ).fit(optimized=True)
        except Exception:
            return ExponentialSmoothing(y_train, trend="add", seasonal=None).fit(optimized=True)
    if model_name == "ARIMA":
        return ARIMA(y_train, order=(1, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
    if model_name == "SARIMA":
        return SARIMAX(
            y_train,
            order=(1, 1, 1),
            seasonal_order=(1, 1, 0, 12),
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(disp=False)
    raise ValueError(f"Unsupported classical model: {model_name}")


def run_classical_training(dataset: str, models: list[str]) -> tuple[pd.DataFrame, pd.DataFrame, list[dict[str, str]]]:
    df, _, _ = assign_split(load_clean_dataset(dataset))
    y_train_lookup = prepare_train_lookup(df)
    all_forecasts: list[pd.DataFrame] = []
    all_metrics: list[pd.DataFrame] = []
    artifact_rows: list[dict[str, str]] = []

    for model_name in models:
        rows = []
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
            y_all = y

            try:
                val_model = fit_classical_model(model_name, y_train)
                test_model = fit_classical_model(model_name, y_train_val)
                final_model = fit_classical_model(model_name, y_all)
            except Exception:
                failed_series += 1
                continue

            pred_val = np.clip(val_model.forecast(int(val_mask.sum())), 0, None)
            pred_test = np.clip(test_model.forecast(int(test_mask.sum())), 0, None)
            resid_sigma = float(np.std(y_train - np.mean(y_train))) if len(y_train) > 1 else 0.0

            fg_code = str(g["fg_code"].iloc[0])
            fg_cat = str(g["fg_category"].iloc[0])
            for i, (m, yt, yp) in enumerate(zip(g.loc[val_mask, "month"], y[val_mask], pred_val), start=1):
                rows.append(
                    {
                        "dataset": dataset,
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
            for i, (m, yt, yp) in enumerate(zip(g.loc[test_mask, "month"], y[test_mask], pred_test), start=1):
                rows.append(
                    {
                        "dataset": dataset,
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

            metadata = {
                "dataset": dataset,
                "model_name": model_name,
                "series_id": sid,
                "fg_code": fg_code,
                "fg_category": fg_cat,
                "train_rows": int(len(y_train)),
                "train_val_rows": int(len(y_train_val)),
                "all_rows": int(len(y_all)),
            }
            artifact_path = save_pickle_model(final_model, dataset, f"{model_name}_{sid}", "production", metadata)
            artifact_rows.append(
                {
                    "dataset": dataset,
                    "model": model_name,
                    "series_id": sid,
                    "artifact_path": str(artifact_path),
                }
            )

        pred_df = pd.DataFrame(rows)
        if pred_df.empty:
            continue
        all_forecasts.append(pred_df)
        all_metrics.append(pd.concat([
            summarize_metrics(pred_df, "val", model_name, dataset, y_train_lookup),
            summarize_metrics(pred_df, "test", model_name, dataset, y_train_lookup),
        ], ignore_index=True))
        print(f"[OK] dataset={dataset} model={model_name} failed_series={failed_series} forecast_rows={len(pred_df)}")

    return (
        pd.concat(all_forecasts, ignore_index=True) if all_forecasts else pd.DataFrame(),
        pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame(),
        artifact_rows,
    )


def fit_boosting_final_model(model_name: str, train_df: pd.DataFrame, val_df: pd.DataFrame, model_cols: list[str]):
    metadata = {"model_cols": model_cols}
    cat_cols = [c for c in ["fg_code", "fg_category"] if c in model_cols]
    if model_name == "XGBOOST":
        x_train = pd.get_dummies(train_df[model_cols], columns=cat_cols, drop_first=False)
        x_val = pd.get_dummies(val_df[model_cols], columns=cat_cols, drop_first=False)
        cols = sorted(set(x_train.columns) | set(x_val.columns))
        x_train = x_train.reindex(columns=cols, fill_value=0)
        x_val = x_val.reindex(columns=cols, fill_value=0)
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
        metadata["feature_columns"] = cols
        return reg, np.clip(reg.predict(x_val), 0, None), metadata

    if model_name == "CATBOOST":
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
            train_df[model_cols],
            train_df["target"],
            cat_features=[model_cols.index(c) for c in cat_cols],
            eval_set=(val_df[model_cols], val_df["target"]),
            use_best_model=True,
            verbose=False,
        )
        return reg, np.clip(reg.predict(val_df[model_cols]), 0, None), metadata

    raise ValueError(f"Unsupported boosting model: {model_name}")


def predict_boosting(model_name: str, reg, frame: pd.DataFrame, model_cols: list[str], feature_columns: list[str] | None):
    if model_name == "XGBOOST":
        cat_cols = [c for c in ["fg_code", "fg_category"] if c in model_cols]
        x = pd.get_dummies(frame[model_cols], columns=cat_cols, drop_first=False)
        x = x.reindex(columns=feature_columns or [], fill_value=0)
        return np.clip(reg.predict(x), 0, None)
    return np.clip(reg.predict(frame[model_cols]), 0, None)


def run_boosting_training(
    dataset: str,
    models: list[str],
    horizons: list[int],
    feature_profile: str = "full",
) -> tuple[pd.DataFrame, pd.DataFrame, list[dict[str, str]]]:
    base_df, train_end, val_end = assign_split(load_clean_dataset(dataset))
    y_train_lookup = prepare_train_lookup(base_df)
    all_forecasts: list[pd.DataFrame] = []
    all_metrics: list[pd.DataFrame] = []
    artifact_rows: list[dict[str, str]] = []

    for model_name in models:
        rows = []
        artifact_meta_rows: list[dict[str, str]] = []
        for h in horizons:
            dfh = make_features(base_df.assign(scenario_split=base_df.get("scenario_split", "all")), horizon=h)
            chosen_cols = None
            train_df = val_df = test_df = final_train_df = None

            feature_base = ["series_id", "fg_code", "fg_category", "month", "target_month", "target", "scenario_split"]
            for model_cols in get_feature_tiers(dfh, feature_profile=feature_profile):
                keep_cols = list(dict.fromkeys(feature_base + model_cols))
                d = dfh[keep_cols].dropna(subset=["target"]).dropna(subset=model_cols)
                if dataset == "C":
                    train_mask = (d["scenario_split"] == "train") & (d["target_month"] <= train_end)
                    val_mask = (d["scenario_split"] == "train") & (d["target_month"] > train_end) & (d["target_month"] <= val_end)
                    test_mask = (d["scenario_split"] == "test") & (d["target_month"] > val_end)
                    prod_mask = d["scenario_split"] == "train"
                else:
                    train_mask = d["target_month"] <= train_end
                    val_mask = (d["target_month"] > train_end) & (d["target_month"] <= val_end)
                    test_mask = d["target_month"] > val_end
                    prod_mask = d["target_month"].notna()

                tr = d[train_mask].copy()
                va = d[val_mask].copy()
                te = d[test_mask].copy()
                prod = d[prod_mask].copy()
                if not tr.empty and not va.empty and not te.empty:
                    chosen_cols = model_cols
                    train_df, val_df, test_df, final_train_df = tr, va, te, prod
                    break

            if chosen_cols is None:
                continue

            reg, p_val, meta = fit_boosting_final_model(model_name, train_df, val_df, chosen_cols)
            feature_columns = meta.get("feature_columns")
            p_test = predict_boosting(model_name, reg, test_df, chosen_cols, feature_columns)
            sigma = float(np.std(val_df["target"].to_numpy() - p_val))

            for part, part_df, preds in [("val", val_df, p_val), ("test", test_df, p_test)]:
                for row, yp in zip(part_df.itertuples(index=False), preds):
                    rows.append(
                        {
                            "dataset": dataset,
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

            # Retrain production model on non-test rows.
            prod_reg, _, prod_meta = fit_boosting_final_model(model_name, final_train_df, val_df, chosen_cols)
            prod_meta.update(
                {
                    "dataset": dataset,
                    "model_name": model_name,
                    "horizon": h,
                    "model_cols": chosen_cols,
                    "feature_profile": feature_profile,
                }
            )
            if model_name == "XGBOOST":
                artifact_path = save_xgboost_model(prod_reg, dataset, f"{model_name}_h{h}", "production", prod_meta)
            else:
                artifact_path = save_catboost_model(prod_reg, dataset, f"{model_name}_h{h}", "production", prod_meta)
            artifact_meta_rows.append(
                {
                    "dataset": dataset,
                    "model": model_name,
                    "series_id": f"h{h}",
                    "artifact_path": str(artifact_path),
                }
            )

        pred_df = pd.DataFrame(rows)
        if pred_df.empty:
            continue
        all_forecasts.append(pred_df)
        all_metrics.append(pd.concat([
            summarize_metrics(pred_df, "val", model_name, dataset, y_train_lookup),
            summarize_metrics(pred_df, "test", model_name, dataset, y_train_lookup),
        ], ignore_index=True))
        artifact_rows.extend(artifact_meta_rows)
        print(f"[OK] dataset={dataset} model={model_name} forecast_rows={len(pred_df)}")

    return (
        pd.concat(all_forecasts, ignore_index=True) if all_forecasts else pd.DataFrame(),
        pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame(),
        artifact_rows,
    )


def save_outputs(metrics: pd.DataFrame, forecasts: pd.DataFrame, artifacts: list[dict[str, str]], tag: str) -> None:
    reports = OUT_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    if not metrics.empty:
        metrics.to_csv(reports / f"{tag}_metrics.csv", index=False)
    if not forecasts.empty:
        forecasts.to_csv(reports / f"{tag}_forecasts.csv", index=False)
    if artifacts:
        pd.DataFrame(artifacts).to_csv(reports / f"{tag}_artifacts.csv", index=False)


def save_leaderboard(all_metrics: pd.DataFrame, tag: str) -> Path:
    reports = OUT_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    leaderboard = (
        all_metrics[(all_metrics["split"] == "test") & (all_metrics["horizon"] == 0)]
        .sort_values(["dataset", "WAPE", "MASE_mean", "RMSE"])
        .reset_index(drop=True)
    )
    path = reports / f"{tag}_leaderboard.csv"
    leaderboard.to_csv(path, index=False)

    registry = {}
    for dataset, group in leaderboard.groupby("dataset"):
        ordered = group["model"].tolist()
        first = group.iloc[0]
        registry[dataset] = {
            "champion_model": ordered[0] if ordered else None,
            "fallback_models": ordered[1:4],
            "selection_metric": {
                "WAPE": float(first["WAPE"]),
                "RMSE": float(first["RMSE"]),
                "MASE_mean": float(first["MASE_mean"]) if pd.notna(first["MASE_mean"]) else None,
            },
        }
    registry_path = reports / f"{tag}_deployment_registry.json"
    registry_path.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--datasets", nargs="+", default=["A", "B", "C"])
    parser.add_argument("--classical-models", nargs="*", default=CLASSICAL_MODELS)
    parser.add_argument("--boosting-models", nargs="*", default=BOOSTING_MODELS)
    parser.add_argument("--skip-classical", action="store_true")
    parser.add_argument("--skip-boosting", action="store_true")
    parser.add_argument("--horizons", type=str, default="1,2,3,4,5,6,7,8,9,10,11,12")
    parser.add_argument("--feature-profile", choices=FEATURE_PROFILES, default="full")
    parser.add_argument("--tag", default="artifact_training")
    args = parser.parse_args()

    horizons = [int(x) for x in args.horizons.split(",") if x.strip()]
    all_metrics = []

    for dataset in args.datasets:
        c_forecasts, c_metrics, c_artifacts = (pd.DataFrame(), pd.DataFrame(), [])
        b_forecasts, b_metrics, b_artifacts = (pd.DataFrame(), pd.DataFrame(), [])

        if not args.skip_classical and args.classical_models:
            c_forecasts, c_metrics, c_artifacts = run_classical_training(dataset, args.classical_models)
        if not args.skip_boosting and args.boosting_models:
            b_forecasts, b_metrics, b_artifacts = run_boosting_training(
                dataset,
                args.boosting_models,
                horizons,
                feature_profile=args.feature_profile,
            )

        metrics = pd.concat([c_metrics, b_metrics], ignore_index=True) if not c_metrics.empty or not b_metrics.empty else pd.DataFrame()
        forecasts = pd.concat([c_forecasts, b_forecasts], ignore_index=True) if not c_forecasts.empty or not b_forecasts.empty else pd.DataFrame()
        artifacts = c_artifacts + b_artifacts
        save_outputs(metrics, forecasts, artifacts, f"{args.tag}_{dataset.lower()}")
        if not metrics.empty:
            all_metrics.append(metrics)

    if all_metrics:
        leaderboard_path = save_leaderboard(pd.concat(all_metrics, ignore_index=True), args.tag)
        save_metadata(OUT_DIR / "reports" / f"{args.tag}_run_metadata", {
            "datasets": args.datasets,
            "classical_models": [] if args.skip_classical else args.classical_models,
            "boosting_models": [] if args.skip_boosting else args.boosting_models,
            "horizons": horizons,
            "feature_profile": args.feature_profile,
            "leaderboard_path": str(leaderboard_path),
        })
        print(f"[OK] saved leaderboard: {leaderboard_path}")


if __name__ == "__main__":
    main()
