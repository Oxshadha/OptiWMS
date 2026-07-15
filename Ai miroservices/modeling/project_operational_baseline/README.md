# Project Operational Baseline

This pipeline creates the single deterministic generated dataset used by OptiWMS operational workflows when externally observed customer data is unavailable.

It generates 120 finished goods, 288 raw materials, 458 packaging materials, 3,000 warehouse locations, complete versioned BOMs, 72 months of causal RM/PM demand, supervisor-aligned ABC/FMS classifications, empirical `(s,S)` policy evidence, and an 18-month transaction history covering orders, movements, tasks and operation events.

Operational screens use these rows normally. The `GENERATED_OPERATIONAL_BASELINE` lineage and dataset hash remain available in administrator, Data Quality and evaluator evidence surfaces. The dataset must never be described as externally observed customer history.

```bash
cd "Ai miroservices/modeling/project_operational_baseline"
../../..//.venv/bin/python run_all.py
```

Use `--small` only for contract tests. Canonical runs write compressed CSV artifacts and `outputs/manifest.json`.
