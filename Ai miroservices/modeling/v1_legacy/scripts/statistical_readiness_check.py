from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass
class Thresholds:
    max_wape: float = 0.135
    max_abs_bias_pct: float = 0.10
    max_rmse_over_mean_demand: float = 1.00
    max_horizon_wape_cv: float = 0.20


def _safe_float(v: float) -> float:
    if v is None or not np.isfinite(v):
        return float("nan")
    return float(v)


def metric_pack(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    e = p - y
    mae = float(np.mean(np.abs(e)))
    rmse = float(np.sqrt(np.mean(e ** 2)))
    mean_demand = float(np.mean(np.abs(y)))
    wape = float(np.sum(np.abs(e)) / np.sum(np.abs(y))) if np.sum(np.abs(y)) > 0 else float("nan")
    bias = float(np.mean(e))
    bias_pct = float(bias / mean_demand) if mean_demand > 0 else float("nan")
    return {
        "MAE": _safe_float(mae),
        "RMSE": _safe_float(rmse),
        "mean_demand": _safe_float(mean_demand),
        "RMSE_over_mean_demand": _safe_float(rmse / mean_demand if mean_demand > 0 else float("nan")),
        "WAPE": _safe_float(wape),
        "Bias": _safe_float(bias),
        "Bias_pct_of_mean_demand": _safe_float(bias_pct),
    }


def horizon_wape_table(df: pd.DataFrame, pred_col: str) -> tuple[pd.DataFrame, float]:
    rows: list[dict] = []
    for h, g in df[df["split"] == "test"].groupby("horizon"):
        y = pd.to_numeric(g["y_true"], errors="coerce").to_numpy(dtype=float)
        p = pd.to_numeric(g[pred_col], errors="coerce").to_numpy(dtype=float)
        denom = float(np.sum(np.abs(y)))
        w = float(np.sum(np.abs(y - p)) / denom) if denom > 0 else float("nan")
        rows.append({"horizon": int(h), "WAPE": _safe_float(w)})
    out = pd.DataFrame(rows).sort_values("horizon").reset_index(drop=True)
    cv = float(out["WAPE"].std(ddof=0) / out["WAPE"].mean()) if not out.empty and float(out["WAPE"].mean()) > 0 else float("nan")
    return out, _safe_float(cv)


def evaluate_checks(metrics: dict[str, float], horizon_wape_cv: float, t: Thresholds) -> list[dict[str, object]]:
    checks = [
        {
            "check": "wape",
            "value": metrics["WAPE"],
            "threshold": t.max_wape,
            "op": "<=",
            "pass": bool(metrics["WAPE"] <= t.max_wape),
        },
        {
            "check": "abs_bias_pct",
            "value": abs(metrics["Bias_pct_of_mean_demand"]),
            "threshold": t.max_abs_bias_pct,
            "op": "<=",
            "pass": bool(abs(metrics["Bias_pct_of_mean_demand"]) <= t.max_abs_bias_pct),
        },
        {
            "check": "rmse_over_mean_demand",
            "value": metrics["RMSE_over_mean_demand"],
            "threshold": t.max_rmse_over_mean_demand,
            "op": "<=",
            "pass": bool(metrics["RMSE_over_mean_demand"] <= t.max_rmse_over_mean_demand),
        },
        {
            "check": "horizon_wape_cv",
            "value": horizon_wape_cv,
            "threshold": t.max_horizon_wape_cv,
            "op": "<=",
            "pass": bool(horizon_wape_cv <= t.max_horizon_wape_cv),
        },
    ]
    return checks


def main() -> None:
    parser = argparse.ArgumentParser(description="Run statistical readiness checks from forecast outputs.")
    parser.add_argument("--forecasts-csv", required=True)
    parser.add_argument("--pred-col", default="y_pred")
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md", required=True)
    parser.add_argument("--max-wape", type=float, default=0.135)
    parser.add_argument("--max-abs-bias-pct", type=float, default=0.10)
    parser.add_argument("--max-rmse-over-mean-demand", type=float, default=1.00)
    parser.add_argument("--max-horizon-wape-cv", type=float, default=0.20)
    args = parser.parse_args()

    forecasts_path = Path(args.forecasts_csv)
    if not forecasts_path.exists():
        raise FileNotFoundError(f"Missing forecasts file: {forecasts_path}")

    df = pd.read_csv(forecasts_path)
    required = {"split", "horizon", "y_true", args.pred_col}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    test_df = df[df["split"] == "test"].copy()
    y = pd.to_numeric(test_df["y_true"], errors="coerce").to_numpy(dtype=float)
    p = pd.to_numeric(test_df[args.pred_col], errors="coerce").to_numpy(dtype=float)
    metrics = metric_pack(y, p)
    h_table, h_cv = horizon_wape_table(df, args.pred_col)

    thr = Thresholds(
        max_wape=float(args.max_wape),
        max_abs_bias_pct=float(args.max_abs_bias_pct),
        max_rmse_over_mean_demand=float(args.max_rmse_over_mean_demand),
        max_horizon_wape_cv=float(args.max_horizon_wape_cv),
    )
    checks = evaluate_checks(metrics, h_cv, thr)
    overall_pass = all(bool(c["pass"]) for c in checks)

    payload = {
        "forecasts_csv": str(forecasts_path),
        "pred_col": args.pred_col,
        "metrics": metrics,
        "horizon_wape_cv": h_cv,
        "checks": checks,
        "overall_pass": overall_pass,
    }

    output_json = Path(args.output_json)
    output_md = Path(args.output_md)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines: list[str] = []
    lines.append("# Statistical Readiness Check")
    lines.append("")
    lines.append(f"- forecasts_csv: `{forecasts_path}`")
    lines.append(f"- pred_col: `{args.pred_col}`")
    lines.append(f"- overall_pass: `{overall_pass}`")
    lines.append("")
    lines.append("## Metrics")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|---|---:|")
    for k in ["WAPE", "RMSE", "MAE", "mean_demand", "RMSE_over_mean_demand", "Bias", "Bias_pct_of_mean_demand"]:
        lines.append(f"| {k} | {metrics[k]:.6f} |")
    lines.append(f"| horizon_wape_cv | {h_cv:.6f} |")
    lines.append("")
    lines.append("## Checks")
    lines.append("")
    lines.append("| Check | Value | Op | Threshold | Pass |")
    lines.append("|---|---:|:---:|---:|:---:|")
    for c in checks:
        lines.append(
            f"| {c['check']} | {float(c['value']):.6f} | {c['op']} | {float(c['threshold']):.6f} | {'PASS' if c['pass'] else 'FAIL'} |"
        )

    output_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[STAT-CHECK] overall_pass={overall_pass} json={output_json} md={output_md}")


if __name__ == "__main__":
    main()
