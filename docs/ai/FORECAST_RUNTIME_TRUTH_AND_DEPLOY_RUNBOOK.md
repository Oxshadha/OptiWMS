# Forecast Runtime Truth and Deploy Runbook

## 1) What Is Happening Right Now (Truth)

From the current runtime behavior:
- A run is only marked `published` after completeness checks pass.
- Completeness checks require prediction rows, inventory rows, and (by default) `test` metric rows with non-null KPI values.
- If these are missing, run is marked `failed` and reason is written to run notes.

## 2) Why Decision View and Model Performance Differ

- **Decision View** uses forecast + inventory rows for operations.
- **Model Performance** uses metrics rows (`split=test|cv|train`) for evaluation charts.

So you can see forecast lines but still see `N/A` in model metrics if evaluation rows are not published for that run/filter.

## 3) Run Modes (What Each Mode Produces)

- `snapshot`:
  - Reads prepared report files.
  - Best mode for full dashboard completeness (forecast + metrics + inventory).
- `online`:
  - Uses online artifact inference.
  - Produces forecasts, but may not produce full evaluation/report rows expected by Model Performance.
- `auto`:
  - Tries online first, then snapshot fallback.
  - Final output depends on which path succeeds with usable rows.

## 4) Why Model Comparison Is Empty

Model comparison requires metrics rows for same filter context:
- same dataset
- same split
- same warehouse scope
- enough rows for one or more models

If those rows are absent, chart is correctly blank.

## 5) Admin Operational Procedure (Current System)

1. In **Model Performance**, pick dataset/model/split.
2. Choose run mode:
   - use `snapshot` for full business dashboard outputs.
   - use `online` only for inference-path testing/latency checks.
3. Click **Run Forecast**.
4. Watch **Run Status** panel:
   - `triggering` -> `waiting_publish` -> `published`
5. Click **Apply Filters** after publish.
6. If metrics remain `N/A`, change split to where data exists, or rerun with `snapshot`.

## 6) What Is Already Completed

- Trigger supports `mode` end-to-end (frontend -> core-api -> orchestrator).
- Run status panel added (phase + run_id + updated time).
- Polling after trigger added (avoids immediate false-empty refresh).
- Inference alerts/audit integrated.
- Fallback flags exposed through API stack.

## 7) Remaining Gaps (Before Final Production Claim)

1. UI clarity and control:
   - Expose publish path (`snapshot`/`online`) and run failure reasons directly in cards.
2. WMS contract observability in Core API UI:
   - Surface `/health/runtime-contract` in admin diagnostics.
3. Release gate enforcement:
   - Enforce acceptance gate pass as mandatory before champion promotion.
4. Load-test evidence:
   - Commit repeatable latency/throughput test results for production sign-off.
5. Drift/freshness monitoring:
   - Add scheduled checks and alerts for data freshness and performance drift.

## 8) Deploy After Finalization (Production Procedure)

1. Build and start AI services:
   - `cd ai-services`
   - `docker compose -f docker-compose.ai.yml up -d --build`
2. Start backend and frontend with matching config.
3. Verify health:
   - `/api/ai/health`
   - `/api/ai/artifacts/inference-alerts`
4. Run a controlled `snapshot` forecast on known dataset.
5. Confirm data presence:
   - forecasts rows > 0
   - metrics rows for `split=test` > 0
   - inventory recommendations rows > 0
6. Validate acceptance gate thresholds.
7. Promote champion model in registry only after gate pass.
8. Enable routine monitoring + rollback runbook.

## 9) Direct Answer to “Did You Complete What I Asked?”

Mostly complete on runtime integrity:
- Completed: mode wiring, run status visibility, trigger polling, inference observability integration, and publish completeness guard.
- Still pending for full production claim: gate-to-promotion enforcement, load evidence, and drift/freshness operationalization.
