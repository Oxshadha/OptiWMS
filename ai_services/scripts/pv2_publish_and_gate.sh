#!/usr/bin/env bash
set -euo pipefail

FORECAST_BASE_URL="${FORECAST_BASE_URL:-http://localhost:8091}"
ORCHESTRATOR_BASE_URL="${ORCHESTRATOR_BASE_URL:-http://localhost:8092}"
DATASET="${DATASET:-PV2}"
MODEL_NAME="${MODEL_NAME:-CATBOOST}"
SPLIT="${SPLIT:-test}"
INFERENCE_WINDOW="${INFERENCE_WINDOW:-200}"
SOAK_HOURS="${SOAK_HOURS:-24}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-12}"
SLEEP_SECONDS="${SLEEP_SECONDS:-10}"

attempt=1

while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
  echo "[pv2-pipeline] Attempt ${attempt}/${MAX_ATTEMPTS}: trigger publish run"

  curl -sS -X POST \
    "${ORCHESTRATOR_BASE_URL}/jobs/forecast-run?dataset=${DATASET}&model_name=${MODEL_NAME}&mode=online" \
    | jq . >/dev/null || true

  curl -sS -X POST "${FORECAST_BASE_URL}/artifacts/operational-health/refresh" | jq . >/dev/null || true

  readiness_json="$(curl -sS "${FORECAST_BASE_URL}/artifacts/production-readiness?dataset=${DATASET}&model_name=${MODEL_NAME}&split=${SPLIT}&inference_window=${INFERENCE_WINDOW}&soak_hours=${SOAK_HOURS}")"

  ready="$(echo "$readiness_json" | jq -r '.ready // false')"

  if [[ "$ready" == "true" ]]; then
    echo "[pv2-pipeline] Readiness reached TRUE for ${DATASET}/${MODEL_NAME}."
    echo "$readiness_json" | jq .
    exit 0
  fi

  echo "[pv2-pipeline] Not ready yet. Failing checks snapshot:"
  echo "$readiness_json" | jq '{ready, dataset, model_name, checks: [.checks[] | select(.pass == false) | {name, value, threshold}]}'

  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

echo "[pv2-pipeline] Exhausted attempts without readiness=true for ${DATASET}/${MODEL_NAME}."
echo "[pv2-pipeline] Action: check missing published run, mapping coverage, and test metrics availability."
exit 1
