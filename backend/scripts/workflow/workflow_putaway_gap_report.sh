#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# PUTAWAY GAP REPORT
# -----------------------------------------------------------------------------
# PURPOSE:
# - Read-only report for pending putaway tasks where pickedQuantity <= 0
#
# PRODUCTION SAFETY:
# - This script is read-only (diagnostic).
# - Safe to run in production for visibility, but do not pair with write-fix
#   scripts unless explicitly approved change control exists.
# -----------------------------------------------------------------------------

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-admin123}"
OUTPUT_FORMAT="${1:---table}" # --table | --json

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

if [[ "$OUTPUT_FORMAT" != "--table" && "$OUTPUT_FORMAT" != "--json" ]]; then
  echo "Usage: $0 [--table|--json]"
  exit 1
fi

LOGIN_JSON="$(curl -sS -X POST "${BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")"

TOKEN="$(echo "$LOGIN_JSON" | jq -r '.accessToken // empty')"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: login failed at ${BASE_URL}"
  echo "$LOGIN_JSON" | jq -c .
  exit 1
fi
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

PUT_TASKS_JSON="$(curl -sS "${BASE_URL}/api/tasks?taskType=putaway&status=pending" -H "$AUTH_HEADER")"
PUT_COUNT="$(echo "$PUT_TASKS_JSON" | jq 'if type=="array" then length else 0 end')"

if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  report='[]'
else
  printf "%-38s %-38s %-12s %-12s %-38s\n" "TASK_ID" "ORDER_ID" "PICKED_QTY" "ORDER_STATUS" "MATERIAL_ID"
  printf "%-38s %-38s %-12s %-12s %-38s\n" "--------------------------------------" "--------------------------------------" "------------" "------------" "--------------------------------------"
fi

gaps=0
for i in $(seq 0 $((PUT_COUNT - 1))); do
  task_id="$(echo "$PUT_TASKS_JSON" | jq -r ".[$i].id // empty")"
  order_id="$(echo "$PUT_TASKS_JSON" | jq -r ".[$i].referenceId // empty")"
  [[ -z "$order_id" ]] && continue

  order_json="$(curl -sS "${BASE_URL}/api/orders/${order_id}" -H "$AUTH_HEADER")"
  order_status="$(echo "$order_json" | jq -r '.status // "unknown"')"

  items_json="$(curl -sS "${BASE_URL}/api/orders/${order_id}/items" -H "$AUTH_HEADER")"
  material_id="$(echo "$items_json" | jq -r 'if type=="array" then .[0].materialId // empty else empty end')"
  picked_qty="$(echo "$items_json" | jq -r 'if type=="array" then (.[0].pickedQuantity // 0) else 0 end')"

  if [[ ! "$picked_qty" =~ ^-?[0-9]+$ ]]; then
    picked_qty=0
  fi

  if [[ "$picked_qty" -le 0 ]]; then
    gaps=$((gaps + 1))
    if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
      report="$(echo "$report" | jq \
        --arg taskId "$task_id" \
        --arg orderId "$order_id" \
        --arg orderStatus "$order_status" \
        --arg materialId "$material_id" \
        --argjson pickedQty "$picked_qty" \
        '. + [{taskId:$taskId, orderId:$orderId, orderStatus:$orderStatus, materialId:$materialId, pickedQuantity:$pickedQty}]')"
    else
      printf "%-38s %-38s %-12s %-12s %-38s\n" "$task_id" "$order_id" "$picked_qty" "$order_status" "$material_id"
    fi
  fi
done

if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  echo "$report" | jq .
fi

echo
echo "Total pending putaway tasks: ${PUT_COUNT}"
echo "Putaway gaps (pickedQuantity <= 0): ${gaps}"
echo "Action: complete receiving/picking for listed orders before putaway."
