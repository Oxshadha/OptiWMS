# v7 RM/PM Forecast Planning Evidence

## Position

v7 is the WMS planning-grade raw-material / packaging-material forecast layer. It does not claim that v6 FG/bootstrap LightGBM forecasts raw materials.

## Data Truth

- RM/PM demand rows: 10368
- RM/PM demand materials: 288
- Demand window: 2023-02-01 to 2026-01-01
- Existing WMS forecast rows: 6102
- BOM headers/components: 3 headers, 2 component rows
- BOM product-parent coverage: 0.0%

## Model Result

- Selected model: lightgbm_global_rm_pm
- Backtest WAPE: 0.25089219589297024
- Backtest bias: 0.015784222600859966
- Under-forecast rate: 0.5063657407407407

## Planning Output

- Forecast rows generated: 3456
- Policy recommendation rows: 288
- Slotting readiness rows: 288
- High-access candidates: 235

## Runtime Publication

- Spring forecast_results publication: {'published_rows': 3456, 'model_name': 'V7_RM_PM_DIRECT'}

## Evaluation-Safe Statement

Direct RM/PM forecasting is the correct production architecture for the current data state, but the current model should remain a candidate champion until residual diagnostics, interval calibration, and per-material stability are reviewed. FG-to-RM BOM explosion remains a controlled secondary path until BOM coverage is complete and validated.
