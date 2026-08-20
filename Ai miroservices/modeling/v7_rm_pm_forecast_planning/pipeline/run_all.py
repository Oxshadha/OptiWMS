from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

try:
    import matplotlib.pyplot as plt
except Exception:  # plotting is optional in the evidence pipeline
    plt = None

from pipeline.data import (
    build_lineage_summary,
    complete_monthly_panel,
    read_bom_audit,
    read_demand_history,
    read_forecast_results,
    read_material_inventory,
    read_material_type_counts,
    write_json,
)
from pipeline.diagnostics import (
    build_data_dictionary,
    build_data_quality_report,
    build_feature_importance,
    build_feature_matrix_profile,
    build_interval_calibration,
    build_outlier_report,
    build_per_material_metrics,
    build_rolling_origin_splits,
    build_statistical_comparison,
    build_table_relationships,
    combine_backtest_rows,
    plot_abc_fms,
    plot_actual_vs_predicted,
    plot_data_quality,
    plot_feature_importance,
    plot_residual_diagnostics,
    plot_seasonality,
)
from pipeline.features import classify_demand
from pipeline.io import ensure_output_dirs, load_config
from pipeline.models import (
    choose_model,
    evaluate_baselines,
    evaluate_lightgbm,
    generate_forecast,
    train_final_lightgbm,
)
from pipeline.planning import build_inventory_policy, build_slotting_readiness
from pipeline.publish import publish_forecast_results


def _write_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False)


def _plot_top_demand(panel: pd.DataFrame, out_path: Path) -> None:
    if panel.empty or plt is None:
        return
    top = (
        panel.groupby("material_code", as_index=False)["demand_units"].sum()
        .sort_values("demand_units", ascending=False)
        .head(12)
    )
    plt.figure(figsize=(12, 5))
    plt.bar(top["material_code"].astype(str), top["demand_units"])
    plt.title("Top RM/PM Materials By Historical Demand")
    plt.xlabel("Material")
    plt.ylabel("Demand units")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def _plot_model_leaderboard(leaderboard: pd.DataFrame, out_path: Path) -> None:
    if leaderboard.empty or plt is None:
        return
    plot = leaderboard.sort_values("WAPE").copy()
    plt.figure(figsize=(10, 4))
    plt.bar(plot["model"], plot["WAPE"])
    plt.title("v7 Backtest WAPE By Model")
    plt.xlabel("Model")
    plt.ylabel("WAPE")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()


def _executive_summary(summary: dict, leaderboard: pd.DataFrame, policy: pd.DataFrame, slotting: pd.DataFrame, published: dict | None) -> str:
    best = leaderboard.sort_values("WAPE").iloc[0].to_dict() if not leaderboard.empty else {}
    lines = [
        "# v7 RM/PM Forecast Planning Evidence",
        "",
        "## Position",
        "",
        "v7 is the WMS planning-grade raw-material / packaging-material forecast layer. It does not claim that v6 FG/bootstrap LightGBM forecasts raw materials.",
        "",
        "## Data Truth",
        "",
        f"- RM/PM demand rows: {summary.get('demand_rows', 0)}",
        f"- RM/PM demand materials: {summary.get('demand_materials', 0)}",
        f"- Demand window: {summary.get('demand_min_month')} to {summary.get('demand_max_month')}",
        f"- Existing WMS forecast rows: {summary.get('forecast_rows', 0)}",
        f"- BOM headers/components: {summary.get('bom_headers', 0)} headers, {summary.get('bom_component_rows', 0)} component rows",
        f"- BOM product-parent coverage: {summary.get('bom_product_parent_coverage_pct', 0)}%",
        "",
        "## Model Result",
        "",
        f"- Selected model: {best.get('model', 'n/a')}",
        f"- Backtest WAPE: {best.get('WAPE', 'n/a')}",
        f"- Backtest bias: {best.get('Bias', 'n/a')}",
        f"- Under-forecast rate: {best.get('under_forecast_rate', 'n/a')}",
        "",
        "## Planning Output",
        "",
        f"- Forecast rows generated: {summary.get('v7_forecast_rows', 0)}",
        f"- Policy recommendation rows: {len(policy)}",
        f"- Slotting readiness rows: {len(slotting)}",
        f"- High-access candidates: {int(slotting['accessibility_need'].isin(['highest_access', 'high_access']).sum()) if not slotting.empty else 0}",
        "",
        "## Runtime Publication",
        "",
        f"- Spring forecast_results publication: {published if published else 'not requested'}",
        "",
        "## Evaluation-Safe Statement",
        "",
        "Direct RM/PM forecasting is the correct production architecture for the current data state, but the current model should remain a candidate champion until residual diagnostics, interval calibration, and per-material stability are reviewed. FG-to-RM BOM explosion remains a controlled secondary path until BOM coverage is complete and validated.",
        "",
    ]
    return "\n".join(lines)


def run(config_path: str | None = None, publish: bool = False) -> dict:
    cfg = load_config(config_path)
    ensure_output_dirs(cfg)

    material_inventory = read_material_inventory(cfg)
    material_type_counts = read_material_type_counts(cfg)
    raw_demand = read_demand_history(cfg)
    demand_panel = complete_monthly_panel(raw_demand)
    existing_forecasts = read_forecast_results(cfg)
    bom = read_bom_audit(cfg)

    demand_classes = classify_demand(demand_panel, cfg)
    baseline_eval, baseline_leaderboard = evaluate_baselines(demand_panel, cfg)
    lgb_eval, lgb_leaderboard, lgb_model, feature_cols = evaluate_lightgbm(demand_panel, cfg)
    final_lgb = train_final_lightgbm(demand_panel, feature_cols) if lgb_model is not None else None
    bundle = choose_model(baseline_eval, baseline_leaderboard, lgb_eval, lgb_leaderboard, final_lgb, feature_cols)
    forecasts = generate_forecast(demand_panel, bundle, cfg)
    policy = build_inventory_policy(forecasts, material_inventory, demand_classes, cfg)
    slotting = build_slotting_readiness(policy, material_inventory)
    backtest_rows = combine_backtest_rows(baseline_eval, lgb_eval)
    selected_backtest_rows = backtest_rows[backtest_rows["model"].eq(bundle.selected_model)].copy() if not backtest_rows.empty else pd.DataFrame()
    per_material_metrics = build_per_material_metrics(backtest_rows)
    interval_calibration = build_interval_calibration(selected_backtest_rows)
    statistical_comparison = build_statistical_comparison(backtest_rows, bundle.selected_model)
    supervised_matrix, feature_matrix_profile = build_feature_matrix_profile(demand_panel)
    feature_importance = build_feature_importance(final_lgb or lgb_model, feature_cols)
    evidence_frames = {
        "material_inventory_snapshot": material_inventory,
        "material_type_counts": material_type_counts,
        "monthly_demand_panel": demand_panel,
        "demand_classification": demand_classes,
        "bom_coverage_audit": bom,
        "existing_forecast_results_snapshot": existing_forecasts,
        "forecast_results_v7": forecasts,
        "inventory_policy_recommendations_v7": policy,
        "slotting_readiness_v7": slotting,
    }
    data_dictionary = build_data_dictionary(evidence_frames)
    data_quality_report = build_data_quality_report(evidence_frames)
    outlier_report = build_outlier_report(demand_panel)
    rolling_splits = build_rolling_origin_splits(demand_panel, cfg.backtest_months, cfg.history_min_months)
    table_relationships = build_table_relationships()

    summary = build_lineage_summary(cfg, material_inventory, material_type_counts, demand_panel, existing_forecasts, bom)
    summary["v7_forecast_rows"] = int(len(forecasts))
    summary["v7_policy_rows"] = int(len(policy))
    summary["v7_slotting_rows"] = int(len(slotting))
    summary["selected_model"] = bundle.selected_model
    summary["model_leaderboard"] = bundle.leaderboard.to_dict(orient="records") if not bundle.leaderboard.empty else []
    summary["evidence_artifacts"] = {
        "data_dictionary": "data_dictionary.csv",
        "table_relationships": "table_relationships.csv",
        "data_quality_report": "data_quality_report.csv",
        "outlier_report": "outlier_report.csv",
        "feature_matrix_profile": "feature_matrix_profile.csv",
        "rolling_origin_splits": "rolling_origin_splits.csv",
        "backtest_residuals": "backtest_residuals.csv",
        "per_material_metrics": "per_material_metrics.csv",
        "interval_calibration": "interval_calibration.csv",
        "statistical_comparison": "statistical_comparison.csv",
        "model_feature_importance": "model_feature_importance.csv",
    }

    _write_csv(material_inventory, cfg.output_dir / "material_inventory_snapshot.csv")
    _write_csv(material_type_counts, cfg.output_dir / "material_type_counts.csv")
    _write_csv(demand_panel, cfg.output_dir / "monthly_demand_panel.csv")
    _write_csv(demand_classes, cfg.output_dir / "demand_classification.csv")
    _write_csv(bom, cfg.output_dir / "bom_coverage_audit.csv")
    _write_csv(existing_forecasts, cfg.output_dir / "existing_forecast_results_snapshot.csv")
    _write_csv(baseline_eval, cfg.output_dir / "baseline_backtest_rows.csv")
    _write_csv(baseline_leaderboard, cfg.output_dir / "baseline_leaderboard.csv")
    _write_csv(lgb_eval, cfg.output_dir / "lightgbm_backtest_rows.csv")
    _write_csv(lgb_leaderboard, cfg.output_dir / "lightgbm_evaluation.csv")
    _write_csv(bundle.leaderboard, cfg.output_dir / "model_leaderboard.csv")
    _write_csv(forecasts, cfg.output_dir / "forecast_results_v7.csv")
    _write_csv(policy, cfg.output_dir / "inventory_policy_recommendations_v7.csv")
    _write_csv(slotting, cfg.output_dir / "slotting_readiness_v7.csv")
    _write_csv(data_dictionary, cfg.output_dir / "data_dictionary.csv")
    _write_csv(table_relationships, cfg.output_dir / "table_relationships.csv")
    _write_csv(data_quality_report, cfg.output_dir / "data_quality_report.csv")
    _write_csv(outlier_report, cfg.output_dir / "outlier_report.csv")
    _write_csv(feature_matrix_profile, cfg.output_dir / "feature_matrix_profile.csv")
    _write_csv(supervised_matrix.head(5000), cfg.output_dir / "feature_matrix_sample.csv")
    _write_csv(rolling_splits, cfg.output_dir / "rolling_origin_splits.csv")
    _write_csv(backtest_rows, cfg.output_dir / "backtest_residuals.csv")
    _write_csv(selected_backtest_rows, cfg.output_dir / "selected_model_backtest_rows.csv")
    _write_csv(per_material_metrics, cfg.output_dir / "per_material_metrics.csv")
    _write_csv(interval_calibration, cfg.output_dir / "interval_calibration.csv")
    _write_csv(statistical_comparison, cfg.output_dir / "statistical_comparison.csv")
    _write_csv(feature_importance, cfg.output_dir / "model_feature_importance.csv")

    _plot_top_demand(demand_panel, cfg.output_dir / "plots" / "top_demand_materials.png")
    _plot_model_leaderboard(bundle.leaderboard, cfg.output_dir / "plots" / "model_wape_leaderboard.png")
    plot_data_quality(data_quality_report, cfg.output_dir / "plots" / "data_quality_missingness.png")
    plot_abc_fms(demand_classes, cfg.output_dir / "plots" / "abc_fms_heatmap.png")
    plot_seasonality(demand_panel, cfg.output_dir / "plots" / "seasonality_index.png")
    plot_residual_diagnostics(selected_backtest_rows, cfg.output_dir / "plots" / "selected_model_residual_diagnostics.png")
    plot_actual_vs_predicted(selected_backtest_rows, cfg.output_dir / "plots" / "selected_model_actual_vs_predicted.png")
    plot_feature_importance(feature_importance, cfg.output_dir / "plots" / "lightgbm_feature_importance.png")

    published = publish_forecast_results(cfg, forecasts) if publish else None
    if published:
        summary["publication"] = published
    write_json(cfg.output_dir / "data_lineage_summary.json", summary)

    executive = _executive_summary(summary, bundle.leaderboard, policy, slotting, published)
    (cfg.output_dir / "executive_summary.md").write_text(executive, encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Run v7 RM/PM forecast planning evidence pipeline")
    parser.add_argument("--config", default=None)
    parser.add_argument("--publish", action="store_true", help="Upsert v7 forecasts into WMS forecast_results")
    args = parser.parse_args()
    summary = run(args.config, publish=args.publish)
    print(json.dumps(summary, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
