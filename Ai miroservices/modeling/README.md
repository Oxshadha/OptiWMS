# OptiWMS Modeling and Evaluator Workspace

This directory contains the forecasting, inventory-policy, physical-layout,
slotting and routing evidence used by OptiWMS.

## Current Authority

`v8_controlled_synthetic_validation` is the current project-operational
population and model decision. It is deterministic controlled synthetic data,
not externally observed warehouse history.

- Dataset version: `PROJECT_OPERATIONAL_SIMULATION_V8`
- Forecast dataset: `PROJECT_OPS_RM_PM`
- Champion: `PROJECT_OPS_EXTRA_TREES_CAUSAL`
- Generation seed: `20260711`
- External population validity: `UNVERIFIED`

Start with:

- [Current status](CURRENT_STATUS.md)
- [v8 pipeline and evidence](v8_controlled_synthetic_validation/README.md)
- [Final project report](../../report.md)

## Active Evidence Packages

| Package | Purpose |
| --- | --- |
| [`v8_controlled_synthetic_validation`](v8_controlled_synthetic_validation/README.md) | Current generated population, forecasting, policy and physical-layout evidence |
| [`project_operational_baseline`](project_operational_baseline/README.md) | Retained V3 regression baseline and complete shared evaluator artifacts |
| [`evaluator_forecasting`](evaluator_forecasting) | Leakage, cyclic/spectral, normalization and neural-contract implementation/tests |
| [`warehouse_routing_evaluation`](warehouse_routing_evaluation/README.md) | Dijkstra/A*/reservation-A* benchmark and executed notebook |

All current notebook and artifact links are indexed in
[Appendix B of the final report](../../report.md#appendix-b--evidence-and-file-index).

## Reproduce v8 Evidence

```bash
cd "Ai miroservices/modeling/v8_controlled_synthetic_validation"
MPLCONFIGDIR=/tmp/optiwms-v8-mpl \
XDG_CACHE_HOME=/tmp/optiwms-v8-cache \
PYTHONPATH=. \
../../../.venv/bin/python -m pipeline.run_all
```

## Reproduce the Clean Neural Evaluator

The evaluator uses the locked Python 3.12 environment at
`.venv-evaluator`. Environment dependencies are listed in
[`requirements-evaluator-lock.txt`](requirements-evaluator-lock.txt).

```bash
cd "Ai miroservices/modeling/project_operational_baseline"
../../../.venv-evaluator/bin/python run_evaluator_upgrade.py
```

`--quick` is a developer check and is not the five-seed evaluator result.

## Test

Run packages separately so their import roots remain explicit:

```bash
cd "Ai miroservices/modeling/v8_controlled_synthetic_validation"
../../../.venv/bin/python -m pytest tests -q
```

```bash
cd "Ai miroservices/modeling/project_operational_baseline"
../../../.venv/bin/python -m pytest tests/test_baseline_contract.py -q
```

```bash
cd "Ai miroservices/modeling"
../../.venv-evaluator/bin/python -m pytest evaluator_forecasting/tests -q
../../.venv/bin/python -m pytest warehouse_routing_evaluation/tests -q
```

Latest results and test-case links are in
[Appendix A of the final report](../../report.md#appendix-a--test-catalogue-and-execution).

## Historical Research Directories

The `v1_legacy`, `v2_m5_clean`, `v3_beverage`, `v4_m5_proper`,
`v5_paper_compliant`, `v6_academic_final` and
`v7_rm_pm_forecast_planning` directories are retained for research history.
They are not current serving or PostgreSQL population authorities. They must
not be mixed with v8 results when reporting the deployed model.

## Governance Rules

- preserve dataset, model, origin, seed and artifact lineage;
- do not use future actuals in origin features;
- do not describe generated evidence as measured production performance;
- do not promote a neural/tree/statistical model by name or novelty alone;
- do not use forward forecasts as residuals;
- do not hide rejected assumptions;
- retain external population validity as `UNVERIFIED` until the locked protocol
  passes on representative real history.
