#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-admin123}"
MODE="${1:---check}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

if [[ "$MODE" != "--check" && "$MODE" != "--fix-inventory" ]]; then
  echo "Usage: $0 [--check|--fix-inventory]"
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

echo "Checking workflow data integrity at ${BASE_URL}"
echo "Mode: ${MODE}"

pick_total=0
pick_bad=0
pick_fixed=0
put_total=0
put_bad=0

# ---- Picking task checks ----
PICK_TASKS_JSON="$(curl -sS "${BASE_URL}/api/tasks?taskType=picking&status=pending" -H "$AUTH_HEADER")"
PICK_COUNT="$(echo "$PICK_TASKS_JSON" | jq 'if type=="array" then length else 0 end')"
pick_total="$PICK_COUNT"

if [[ "$PICK_COUNT" -gt 0 ]]; then
  for i in $(seq 0 $((PICK_COUNT - 1))); do
    task_id="$(echo "$PICK_TASKS_JSON" | jq -r ".[$i].id // empty")"
    order_id="$(echo "$PICK_TASKS_JSON" | jq -r ".[$i].referenceId // empty")"
    [[ -z "$order_id" ]] && continue

    order_json="$(curl -sS "${BASE_URL}/api/orders/${order_id}" -H "$AUTH_HEADER")"
    wh_id="$(echo "$order_json" | jq -r '.warehouseId // empty')"
    [[ -z "$wh_id" ]] && continue

    items_json="$(curl -sS "${BASE_URL}/api/orders/${order_id}/items" -H "$AUTH_HEADER")"
    material_id="$(echo "$items_json" | jq -r 'if type=="array" then .[0].materialId // empty else empty end')"
    [[ -z "$material_id" ]] && continue

    inv_json="$(curl -sS "${BASE_URL}/api/inventory?materialId=${material_id}&warehouseId=${wh_id}" -H "$AUTH_HEADER")"
    inv_id="$(echo "$inv_json" | jq -r 'if type=="array" then .[0].id // empty else empty end')"
    avail="$(echo "$inv_json" | jq -r 'if type=="array" then (.[0].availableQuantity // "0") else "0" end')"

    # Normalize avail to integer when possible; fallback to 0
    if [[ "$avail" =~ ^-?[0-9]+$ ]]; then
      avail_int="$avail"
    else
      avail_int=0
    fi

    if [[ "$avail_int" -le 0 ]]; then
      pick_bad=$((pick_bad + 1))
      echo "[PICKING MISMATCH] task=${task_id} order=${order_id} material=${material_id} warehouse=${wh_id} available=${avail}"

      if [[ "$MODE" == "--fix-inventory" ]]; then
        loc_json="$(curl -sS "${BASE_URL}/api/locations?warehouseId=${wh_id}" -H "$AUTH_HEADER")"
        loc_code="$(echo "$loc_json" | jq -r 'if type=="array" then (map(select(.isActive == true and (.locationType == "storage" or .locationType == null))) | .[0].locationCode // empty) else empty end')"

        if [[ -z "$loc_code" ]]; then
          echo "  -> FIX SKIPPED (no active storage location found)"
          continue
        fi

        payload="$(jq -nc \
          --arg mid "$material_id" \
          --arg wid "$wh_id" \
          --arg loc "$loc_code" \
          '{materialId:$mid,warehouseId:$wid,locationCode:$loc,quantity:"20",availableQuantity:"20",reservedQuantity:"0",status:"active"}')"

        if [[ -n "$inv_id" ]]; then
          code="$(curl -sS -o /tmp/workflow_inv_fix.json -w '%{http_code}' \
            -X PUT "${BASE_URL}/api/inventory/${inv_id}" \
            -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d "$payload")"
        else
          code="$(curl -sS -o /tmp/workflow_inv_fix.json -w '%{http_code}' \
            -X POST "${BASE_URL}/api/inventory" \
            -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d "$payload")"
        fi

        if [[ "$code" == "200" || "$code" == "201" ]]; then
          pick_fixed=$((pick_fixed + 1))
          echo "  -> FIXED inventory (status=${code}, location=${loc_code})"
        else
          echo "  -> FIX FAILED (status=${code})"
          cat /tmp/workflow_inv_fix.json | jq -c . || true
        fi
      fi
    fi
  done
fi

# ---- Putaway task checks ----
PUT_TASKS_JSON="$(curl -sS "${BASE_URL}/api/tasks?taskType=putaway&status=pending" -H "$AUTH_HEADER")"
PUT_COUNT="$(echo "$PUT_TASKS_JSON" | jq 'if type=="array" then length else 0 end')"
put_total="$PUT_COUNT"

if [[ "$PUT_COUNT" -gt 0 ]]; then
  for i in $(seq 0 $((PUT_COUNT - 1))); do
    task_id="$(echo "$PUT_TASKS_JSON" | jq -r ".[$i].id // empty")"
    order_id="$(echo "$PUT_TASKS_JSON" | jq -r ".[$i].referenceId // empty")"
    [[ -z "$order_id" ]] && continue

    items_json="$(curl -sS "${BASE_URL}/api/orders/${order_id}/items" -H "$AUTH_HEADER")"
    qty="$(echo "$items_json" | jq -r 'if type=="array" then (.[0].pickedQuantity // 0) else 0 end')"
    material_id="$(echo "$items_json" | jq -r 'if type=="array" then .[0].materialId // empty else empty end')"

    if [[ ! "$qty" =~ ^-?[0-9]+$ ]]; then
      qty=0
    fi

    if [[ "$qty" -le 0 ]]; then
      put_bad=$((put_bad + 1))
      echo "[PUTAWAY MISMATCH] task=${task_id} order=${order_id} material=${material_id} pickedQuantity=${qty}"
    fi
  done
fi

echo
echo "Summary:"
echo "  pending picking tasks: ${pick_total}"
echo "  picking mismatches:    ${pick_bad}"
echo "  picking auto-fixed:    ${pick_fixed}"
echo "  pending putaway tasks: ${put_total}"
echo "  putaway mismatches:    ${put_bad}"

if [[ "$MODE" == "--check" ]]; then
  echo
  echo "Tip: rerun with --fix-inventory to auto-fix picking inventory mismatches."
  echo "Putaway mismatches usually mean received quantity (pickedQuantity) is still 0 on order items."
fi
