#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


DEFAULT_REPORTS_DIR = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports")
DEFAULT_LOG_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/docs/ai/FORECAST_LEADERBOARD_ROUND_LOG.md")


def _pick_latest_leaderboard(reports_dir: Path) -> Path:
    candidates = sorted(
        reports_dir.glob("*_leaderboard.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"No *_leaderboard.csv found in {reports_dir}")
    return candidates[0]


def _ensure_log_header(log_path: Path) -> None:
    if log_path.exists():
        return
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        "# Forecast Leaderboard Round Log\n\n"
        "Purpose: preserve every leaderboard round so reruns do not lose prior results.\n\n"
        "Each entry stores:\n"
        "- the exact source leaderboard file,\n"
        "- an archived CSV snapshot,\n"
        "- a ranked summary table.\n",
        encoding="utf-8",
    )


def _format_float(v: object, digits: int = 6) -> str:
    try:
        return f"{float(v):.{digits}f}"
    except Exception:
        return str(v)


def _build_summary_table(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    if "horizon" in work.columns:
        overall = work[work["horizon"] == 0].copy()
        if overall.empty:
            overall = work.copy()
    else:
        overall = work.copy()

    sort_col = "WAPE" if "WAPE" in overall.columns else None
    if sort_col:
        overall = overall.sort_values(sort_col, ascending=True)
    overall["rank"] = range(1, len(overall) + 1)

    cols = [c for c in ["rank", "dataset", "model", "split", "horizon", "n_obs", "WAPE", "RMSE", "Bias", "MASE_mean", "under_forecast_rate"] if c in overall.columns]
    return overall[cols].copy()


def _append_markdown_entry(
    log_path: Path,
    round_id: str,
    source_file: Path,
    archived_file: Path,
    note: str | None,
    summary: pd.DataFrame,
) -> None:
    lines: list[str] = []
    lines.append(f"\n## {round_id}")
    lines.append(f"- Source leaderboard: `{source_file}`")
    lines.append(f"- Archived snapshot: `{archived_file}`")
    if note:
        lines.append(f"- Note: {note}")

    if summary.empty:
        lines.append("\n_No rows found in leaderboard._\n")
    else:
        lines.append("\n### Ranked Summary")
        lines.append("| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |")
        lines.append("|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|")
        for r in summary.itertuples(index=False):
            rank = getattr(r, "rank", "")
            dataset = getattr(r, "dataset", "")
            model = getattr(r, "model", "")
            split = getattr(r, "split", "")
            horizon = getattr(r, "horizon", "")
            n_obs = getattr(r, "n_obs", "")
            wape = _format_float(getattr(r, "WAPE", ""))
            rmse = _format_float(getattr(r, "RMSE", ""), 3)
            bias = _format_float(getattr(r, "Bias", ""), 3)
            mase = _format_float(getattr(r, "MASE_mean", ""))
            ufr = _format_float(getattr(r, "under_forecast_rate", ""))
            lines.append(f"| {rank} | {dataset} | {model} | {split} | {horizon} | {n_obs} | {wape} | {rmse} | {bias} | {mase} | {ufr} |")

    with log_path.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Archive leaderboard CSV and append round summary to markdown log.")
    parser.add_argument("--reports-dir", default=str(DEFAULT_REPORTS_DIR))
    parser.add_argument("--log-path", default=str(DEFAULT_LOG_PATH))
    parser.add_argument("--leaderboard-file", default=None, help="Optional explicit leaderboard CSV path.")
    parser.add_argument("--note", default=None, help="Optional note for this round.")
    args = parser.parse_args()

    reports_dir = Path(args.reports_dir).resolve()
    log_path = Path(args.log_path).resolve()
    source_file = Path(args.leaderboard_file).resolve() if args.leaderboard_file else _pick_latest_leaderboard(reports_dir)

    if not source_file.exists():
        raise FileNotFoundError(f"Leaderboard file not found: {source_file}")

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    round_id = f"ROUND-{stamp}"

    archive_dir = reports_dir / "history" / "leaderboards"
    archive_dir.mkdir(parents=True, exist_ok=True)
    archived_file = archive_dir / f"{stamp}_{source_file.name}"
    shutil.copy2(source_file, archived_file)

    df = pd.read_csv(source_file)
    summary = _build_summary_table(df)

    _ensure_log_header(log_path)
    _append_markdown_entry(
        log_path=log_path,
        round_id=round_id,
        source_file=source_file,
        archived_file=archived_file,
        note=args.note,
        summary=summary,
    )

    print(f"[OK] source: {source_file}")
    print(f"[OK] archived: {archived_file}")
    print(f"[OK] log updated: {log_path}")
    print(f"[OK] rows logged: {len(summary)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

