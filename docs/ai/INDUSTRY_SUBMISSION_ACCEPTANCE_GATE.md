# Industry Submission Acceptance Gate

## Purpose
This gate is the formal go/no-go decision for exposing forecasting outputs to WMS workflows.

## Required pass conditions
All checks below must pass in the same evaluation window.

### Forecast quality (offline / validation)
- WAPE (overall): `<= 0.135`
- `abs(Bias)`: `<= 0.10`
- Under-forecast rate: `<= 0.60`
- MASE_mean: `<= 1.10`

### Serving reliability (online inference)
- Fallback usage rate: `<= 0.05`
- Hard error rate: `<= 0.01`
- P95 latency: `<= 500 ms`

## System endpoints
- Forecast-service gate endpoint:
  - `GET /artifacts/acceptance-gate`
- Core API passthrough:
  - `GET /api/ai/artifacts/acceptance-gate`

## Release policy
- If gate fails:
  - Do not promote model to production route.
  - Keep fallback-enabled serving active.
  - Open remediation ticket with failed check details.
- If gate passes:
  - Promote model as champion.
  - Record model version and gate evidence in release notes.

## Notes
- This gate does not replace data-science sign-off.
- DS sign-off must confirm realism, stability, and business interpretability.
