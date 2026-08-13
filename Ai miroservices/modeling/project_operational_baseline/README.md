# Project Operational Baseline

This pipeline creates the single deterministic generated dataset used by OptiWMS operational workflows when externally observed customer data is unavailable.

The canonical V3 profile generates 16 finished goods, 48 raw materials, and 32 packaging materials. This deliberately preserves the operational hierarchy `RM > PM > FG` without retaining thousands of redundant catalogue rows. RM names are grounded in the supplied item-description master, while generated PM specifications and FG formulas are explicitly labelled in lineage. It also generates 40 operational racks across five physical zones, 600 storage positions, 6 route stations, complete versioned BOMs, 72 months of causal FG/RM/PM demand, supervisor-aligned ABC/FMS classifications, empirical `(s,S)` policy evidence, and an 18-month transaction history covering 5,000 orders, 15,000 order lines, and 30,000 movements, tasks, and operation events each.

The metric warehouse layout contains receiving/dispatch stations, aisle graph nodes and edges, five rack levels, three bin positions per level, and all nine physical suitability classes (`AF` through `CS`). Zones A-E are all operational storage zones; whole racks are never labelled as balancing racks. Pick-face and upper-level capacity are properties of bin levels inside those racks. Material handling contracts distinguish base-unit quantity, units per handling unit, units per pallet, stack height, and the physical pallet footprint.

The leakage-controlled forecast selection pipeline evaluates seasonal naive, statistical, LightGBM, and Extra Trees candidates with expanding-window validation and an untouched final 12-month test. Selection minimizes `WAPE + 0.5 * |bias|` on pre-test origins so inventory-relevant systematic error is not ignored. After the semantic BOM and pack-profile contract was locked, the V3 checkpoint selected `EXTRA_TREES_RESPONSIVE` with `12.76%` WAPE versus `17.43%` for seasonal naive, `-1.74%` bias, and `89.15%` P10-P90 coverage. This is generated-data system evidence, not a claim of external warehouse accuracy.

Operational screens use these rows normally. The `GENERATED_OPERATIONAL_BASELINE` lineage and dataset hash remain available in administrator, Data Quality and evaluator evidence surfaces. The dataset must never be described as externally observed customer history.

```bash
cd "Ai miroservices/modeling/project_operational_baseline"
../../../.venv/bin/python run_all.py
```

Use `--small` only for contract tests. Canonical runs write compressed CSV artifacts and `outputs/manifest.json`.

## Evaluator-Grade Time-Series Evidence

The evaluator upgrade is deliberately isolated from the runtime forecast contract. It
adds leakage-safe 24-month input windows, direct H1-H12 forecasts, time/frequency
features, a global Conv1D/self-attention challenger, ordered quantiles, rolling-origin
model comparison, residual/interval tests and inventory-cost sensitivity.

Create the clean Python 3.12 environment from the repository root:

```bash
/opt/homebrew/bin/python3.12 -m venv .venv-evaluator
./.venv-evaluator/bin/pip install -r "Ai miroservices/modeling/requirements-evaluator-lock.txt"
./.venv-evaluator/bin/python -m ipykernel install --prefix .venv-evaluator \
  --name optiwms-evaluator --display-name "OptiWMS Evaluator (Python 3.12)"
```

Run the complete five-seed evidence pipeline:

```bash
cd "Ai miroservices/modeling/project_operational_baseline"
../../../.venv-evaluator/bin/python run_evaluator_upgrade.py
```

`--quick` is a one-seed developer check and is not evaluator evidence. Stable results
are written to `outputs/evaluator/`, including the leaderboard, spectral evidence,
assumption registry, dependence-aware hypothesis tests, seed stability, ablations,
calibration, decision-cost sensitivity and explanation artifacts. All results remain
generated-data evidence with external population validity marked `UNVERIFIED`.

After both evaluator runners finish, regenerate the notebook definitions and execute
them with `./.venv-evaluator/bin/python tools/execute_evaluator_notebooks.py`.
