#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api}"
TOKEN="${TOKEN:-}"
WAREHOUSE_ID="${WAREHOUSE_ID:-}"
SUPPLIER_ID="${SUPPLIER_ID:-}"
CUSTOMER_ID="${CUSTOMER_ID:-}"
MATERIAL_ID="${MATERIAL_ID:-}"
LOCATION_CODE="${LOCATION_CODE:-}"

auth_args=()
if [[ -n "$TOKEN" ]]; then
  auth_args=(-H "Authorization: Bearer $TOKEN")
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing $name. Export it before running this smoke test." >&2
    exit 2
  fi
}

for name in WAREHOUSE_ID SUPPLIER_ID CUSTOMER_ID MATERIAL_ID LOCATION_CODE; do
  require_env "$name"
done

post_json() {
  local path="$1"
  local body="$2"
  curl -fsS "${auth_args[@]}" -H "Content-Type: application/json" -X POST "$API_BASE$path" -d "$body"
}

put_json() {
  local path="$1"
  local body="$2"
  curl -fsS "${auth_args[@]}" -H "Content-Type: application/json" -X PUT "$API_BASE$path" -d "$body"
}

json_id() {
  python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])'
}

echo "1. Create inbound order"
INBOUND_ID="$(
  post_json "/orders" "{
    \"orderType\":\"inbound\",
    \"supplierId\":\"$SUPPLIER_ID\",
    \"warehouseId\":\"$WAREHOUSE_ID\",
    \"status\":\"pending\",
    \"priority\":\"normal\"
  }" | json_id
)"

echo "2. Add inbound item"
post_json "/orders/$INBOUND_ID/items" "{
  \"materialId\":\"$MATERIAL_ID\",
  \"quantity\":10,
  \"locationCode\":\"$LOCATION_CODE\",
  \"batchNumber\":\"SMOKE-IN-001\"
}" >/dev/null

echo "3. Create receiving/putaway tasks"
post_json "/orders/$INBOUND_ID/create-tasks" "{}" >/dev/null

echo "4. Mark inbound statuses through receiving gate"
put_json "/orders/$INBOUND_ID/status" "{\"status\":\"quality_approved\"}" >/dev/null

echo "5. Create outbound order"
OUTBOUND_ID="$(
  post_json "/orders" "{
    \"orderType\":\"outbound\",
    \"customerId\":\"$CUSTOMER_ID\",
    \"warehouseId\":\"$WAREHOUSE_ID\",
    \"status\":\"pending\",
    \"priority\":\"normal\"
  }" | json_id
)"

echo "6. Add outbound item"
post_json "/orders/$OUTBOUND_ID/items" "{
  \"materialId\":\"$MATERIAL_ID\",
  \"quantity\":1,
  \"locationCode\":\"$LOCATION_CODE\"
}" >/dev/null

echo "7. Create outbound picking tasks"
post_json "/orders/$OUTBOUND_ID/create-tasks" "{}" >/dev/null

echo "Smoke flow created inbound=$INBOUND_ID outbound=$OUTBOUND_ID"
