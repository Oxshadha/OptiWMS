# Workflow Scripts (Admin/Worker Flow Diagnostics)

Location: `/Users/k.e.oshada/Documents/OptiWMS/backend/scripts/workflow/`

## Scripts

1. `workflow_data_integrity.sh`
- `--check` (read-only): finds picking/putaway readiness mismatches.
- `--fix-inventory` (write): creates/updates inventory rows to unblock picking in dev/test.

2. `workflow_putaway_gap_report.sh`
- `--table` or `--json` (read-only): lists pending putaway tasks where `pickedQuantity <= 0`.

## Production Safety

- Safe in production:
  - `workflow_data_integrity.sh --check`
  - `workflow_putaway_gap_report.sh --table|--json`
- Not safe by default in production:
  - `workflow_data_integrity.sh --fix-inventory` (writes business data)

## Required Production Changes

1. Disable default bootstrap admin seeding for production.
2. Remove hardcoded/default credentials from runtime paths.
3. Use secrets for JWT and DB credentials.
4. Restrict CORS to actual production domains.
5. Run only read-only workflow scripts in production unless there is explicit change approval.

## Usage

```bash
# Read-only checks
/Users/k.e.oshada/Documents/OptiWMS/backend/scripts/workflow/workflow_data_integrity.sh --check
/Users/k.e.oshada/Documents/OptiWMS/backend/scripts/workflow/workflow_putaway_gap_report.sh --table

# Dev/test only (writes inventory data)
/Users/k.e.oshada/Documents/OptiWMS/backend/scripts/workflow/workflow_data_integrity.sh --fix-inventory
```

