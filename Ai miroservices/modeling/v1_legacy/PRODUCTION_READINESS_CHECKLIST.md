# Production Readiness Checklist (Forecast Service)

Use this as a strict go/no-go gate for full enterprise deployment.

Current recommendation:

- `Pilot / controlled rollout`: YES
- `Full production rollout`: NOT YET

---

## A) Data Science Gates

### A1. Accuracy vs baseline (must pass)

- [ ] Compare against seasonal naive on the same granularity and horizon set.
- [ ] Aggregate `WAPE` better than naive by a meaningful margin.
- [ ] Aggregate `RMSE` better than naive.
- [ ] Aggregate `MASE` better than naive.

Suggested thresholds:

- [ ] `WAPE` improvement >= 5% relative over naive.
- [ ] `RMSE` improvement >= 5% relative over naive.

### A2. Horizon-level quality (must pass)

- [ ] For horizons `1..12`, no sustained collapse in long horizons (`9..12`).
- [ ] At least 9/12 horizons better than naive on `WAPE` or a documented fallback rule exists.
- [ ] Horizon 12 does not exceed agreed maximum error threshold.

### A3. Segment-level quality (must pass)

- [ ] Evaluate by category/family (from diagnostics outputs).
- [ ] No critical segment with unacceptable error without fallback.
- [ ] Weak segments are explicitly listed with mitigation.

### A4. Bias/variance controls (must pass)

- [ ] Bias monitored globally and per horizon.
- [ ] Under-forecast rate monitored and thresholded.
- [ ] Error variance monitored (not only mean error).

Suggested alerts:

- [ ] Absolute bias trend increases for 2 consecutive windows.
- [ ] Under-forecast rate exceeds configured limit (for example >0.75).

### A5. Uncertainty quality (should pass before full production)

- [ ] P10/P90 interval coverage checked on recent holdout.
- [ ] Coverage close to target and stable by horizon.
- [ ] If coverage is poor, do not use intervals for business commitments.

### A6. Drift & retraining policy (must pass)

- [ ] Data drift metrics defined for key features.
- [ ] Performance drift trigger defined.
- [ ] Retraining trigger and cadence documented.
- [ ] Last-good model rollback artifact available.

### A7. Model contribution transparency (must pass)

- [ ] Calibration weights logged per horizon.
- [ ] State clearly whether forecast is model-dominant or anchor-dominant.
- [ ] No claims of raw model superiority unless proven.

---

## B) Technical & Service Gates

### B1. API contract (must pass)

- [ ] Request/response schema versioned.
- [ ] Input validation for missing/invalid fields.
- [ ] Deterministic error responses with codes/messages.
- [ ] Backward compatibility tested for Core WMS clients.

### B2. Artifact integrity (must pass)

- [ ] Model artifact + metadata version lock.
- [ ] Feature profile and calibration config stored with artifact.
- [ ] Checksum/hash verification for loaded artifacts.
- [ ] Startup fails fast on corrupted/missing artifacts.

### B3. Runtime reliability (must pass)

- [ ] Health endpoints: liveness/readiness.
- [ ] Timeouts, retries, and circuit-breaker policy defined.
- [ ] Graceful fallback forecast path exists (naive/anchor).
- [ ] Idempotency for repeated requests.

### B4. Observability (must pass)

- [ ] Structured logs with request_id/model_version.
- [ ] Metrics exported (latency, error rate, forecast volume).
- [ ] Forecast KPI metrics logged for monitoring windows.
- [ ] Alerting configured for SLA and quality breaches.

### B5. Performance/SLA (must pass)

- [ ] Load test at expected peak QPS.
- [ ] P95 latency within SLA.
- [ ] Memory/CPU profile stable under load.
- [ ] Cold-start behavior acceptable.

### B6. Security & governance (must pass)

- [ ] Secrets managed outside code.
- [ ] Dependency vulnerability scan done.
- [ ] Access controls for model endpoints.
- [ ] Audit trail for model/config changes.

### B7. Deployment safety (must pass)

- [ ] Staging mirrors production-like data path.
- [ ] Canary or phased rollout plan.
- [ ] Automated rollback trigger.
- [ ] Runbook for incident response.

---

## C) Business Gates

### C1. KPI linkage (must pass)

- [ ] Forecast metrics linked to business outcomes:
  - stockout reduction
  - overstock reduction
  - service level impact
- [ ] KPI acceptance bands signed off by business owner.

### C2. Decision policy (must pass)

- [ ] Human override policy documented.
- [ ] Escalation path for bad forecast episodes.
- [ ] Communication protocol for rollback events.

---

## D) Final Go/No-Go Rule

Declare full production only if all are true:

- [ ] DS gates A1, A2, A4, A6, A7 pass.
- [ ] Technical gates B1-B7 pass.
- [ ] Business gates C1-C2 pass.

If any must-pass gate fails:

- Continue pilot mode.
- Keep fallback active.
- Do not claim full enterprise model readiness.

---

## E) Current Project Status (as of now)

- Accuracy vs naive: PASS (aggregate)
- Horizon consistency: PARTIAL
- Model contribution clarity: PASS
- Drift/retraining governance: PARTIAL
- API/service hardening: PARTIAL
- Full production readiness: NO
- Pilot readiness: YES

