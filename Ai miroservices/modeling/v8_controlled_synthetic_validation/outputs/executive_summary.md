# v8 Controlled Synthetic Forecast Validation

## Experimental Position

This benchmark tests whether the forecasting pipeline can recover a known causal RM/PM demand-generating process. It does not claim production accuracy because every row is controlled synthetic ground truth.

## Protocol

- Seed: `20260711`
- Materials: `120`
- Finished goods: `24`
- BOM coverage: `100%` within the controlled simulation
- Hyperparameter tuning: `6` months
- Champion selection: `6` independent months
- Final untouched test: `12` rolling origins
- Locked champion: `extra_trees_causal`

## Final Test Result

- WAPE: `8.34%`
- MAE: `736.76`
- RMSE: `1408.46`
- Bias: `-0.15%`
- Under-forecast rate: `48.26%`

## Interpretation

If BOM/production-plan models materially outperform direct-history models, the experiment demonstrates the value of causal planning signals. If all candidates fail despite the known structure, the pipeline or model specification remains defective. Neither outcome proves that failures on real operational data are caused only by data quality; that conclusion requires real issue-history validation.
