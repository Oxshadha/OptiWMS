# Model Release and Rollback Runbook

## Scope
Operational runbook for releasing, monitoring, and rolling back forecasting models in OptiWMS.

## Preconditions
- CI gate green:
  - `forecast-service` artifact tests
  - `core-api` AI proxy tests
- Acceptance gate pass:
  - `/api/ai/artifacts/acceptance-gate` returns `ready=true`
- Champion model mapping prepared and reviewed.

## Release steps
1. Deploy forecast-service and core-api changes to staging.
2. Verify:
   - `/api/ai/artifacts/inference-alerts`
   - `/api/ai/artifacts/inference-audit`
   - `/api/ai/artifacts/acceptance-gate`
3. Confirm no `critical` inference status in staging.
4. Promote to production.
5. Monitor first 60 minutes:
   - fallback rate
   - hard error rate
   - p95 latency
6. Record release evidence and model version.

## Trigger-block behavior
- Forecast trigger is blocked on `critical` inference health by default.
- Break-glass override exists only when enabled by config and requested explicitly by admin-like role.

## Rollback criteria
Rollback immediately if any condition persists for 2 consecutive windows:
- `critical` inference status
- fallback rate > gate threshold
- hard error rate > gate threshold
- p95 latency > gate threshold

## Rollback steps
1. Route back to previous stable champion model.
2. Disable break-glass override if it was enabled.
3. Re-run acceptance gate on rollback model.
4. Keep heightened monitoring for 24 hours.
5. Open post-incident review with root cause and prevention action.

## Configuration controls
- `ai.monitoring.trigger-block-on-critical=true`
- `ai.monitoring.allow-critical-override=false` (recommended default)
- `ai.monitoring.trigger-fail-open-on-guard-error=false` (recommended default)

## Ownership
- Data Science: model quality and drift interpretation.
- Platform/Backend: service reliability, auth/rate-limit, release control.
- Product/Operations: business impact and operational sign-off.
