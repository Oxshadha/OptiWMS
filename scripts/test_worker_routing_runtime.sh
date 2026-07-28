#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="${OPTIWMS_SMOKE_API_BASE:-http://localhost:8080}"
DATABASE_URL="${OPTIWMS_SMOKE_DATABASE_URL:-postgresql://optiwms:optiwms@localhost:5434/optiwms}"
SMOKE_USERNAME="${OPTIWMS_SMOKE_USERNAME:-admin}"
SMOKE_PASSWORD="${OPTIWMS_SMOKE_PASSWORD:-admin123}"
SMOKE_DIR="$(mktemp -d /tmp/optiwms-routing-smoke.XXXXXX)"
FIRST_SESSION=""
SECOND_SESSION=""
ACCESS_TOKEN=""

cleanup() {
  if [[ -n "$ACCESS_TOKEN" ]]; then
    for session_id in "$FIRST_SESSION" "$SECOND_SESSION"; do
      if [[ -n "$session_id" ]]; then
        version="$(
          curl -fsS "$API_BASE/api/routing/sessions/$session_id" \
            -H "Authorization: Bearer $ACCESS_TOKEN" |
            jq -r '.routeVersion // empty' || true
        )"
        if [[ -n "$version" ]]; then
          curl -fsS -X POST \
            "$API_BASE/api/routing/sessions/$session_id/cancel?routeVersion=$version" \
            -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null || true
        fi
      fi
    done
  fi
  rm -f "$SMOKE_DIR"/*
  rmdir "$SMOKE_DIR" 2>/dev/null || true
}
trap cleanup EXIT

curl -fsS "$API_BASE/actuator/health" |
  jq -e '.status == "UP"' >/dev/null

LOGIN="$(
  jq -n \
    --arg username "$SMOKE_USERNAME" \
    --arg password "$SMOKE_PASSWORD" \
    '{username:$username,password:$password}' |
    curl -fsS -X POST "$API_BASE/api/auth/login" \
      -H 'Content-Type: application/json' --data-binary @-
)"
ACCESS_TOKEN="$(jq -er '.accessToken' <<<"$LOGIN")"

WAREHOUSE_ID="$(
  psql "$DATABASE_URL" -Atc \
    "SELECT id FROM warehouses WHERE dataset_version = 'PROJECT_OPERATIONAL_SIMULATION_V8' AND lower(status) = 'active' LIMIT 1"
)"
WORKER_ROWS="$(
  psql "$DATABASE_URL" -Atc \
    "SELECT id FROM users WHERE warehouse_id = '$WAREHOUSE_ID' AND lower(status) = 'active' ORDER BY CASE WHEN role = 'forklift_operator' THEN 0 WHEN role = 'picker' THEN 1 ELSE 2 END, username LIMIT 2"
)"
FIRST_WORKER_ID="$(sed -n '1p' <<<"$WORKER_ROWS")"
SECOND_WORKER_ID="$(sed -n '2p' <<<"$WORKER_ROWS")"
if [[ -z "$WAREHOUSE_ID" || -z "$FIRST_WORKER_ID" || -z "$SECOND_WORKER_ID" ]]; then
  echo "The v8 warehouse and two active assigned workers are required." >&2
  exit 1
fi

GRAPH="$(
  curl -fsS \
    "$API_BASE/api/routing/graph?warehouseId=$WAREHOUSE_ID&ensure=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
)"
jq -e '
  .datasetVersion == "PROJECT_OPERATIONAL_SIMULATION_V8"
  and .rackFootprintCount == 280
  and (.nodes | length) == 956
  and (.edges | length) == 1980
' <<<"$GRAPH" >/dev/null

route_payload() {
  jq -n \
    --arg warehouse "$WAREHOUSE_ID" \
    --arg worker "$1" \
    '{
      warehouseId:$warehouse,
      workerId:$worker,
      operationType:"PUTAWAY",
      vehicleType:"FORKLIFT",
      locationCodes:["A-01-01-1-A","A-01-02-1-A"]
    }'
}

FIRST="$(
  route_payload "$FIRST_WORKER_ID" |
    curl -fsS -X POST "$API_BASE/api/routing/sessions" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'Content-Type: application/json' --data-binary @-
)"
FIRST_SESSION="$(jq -er '.id' <<<"$FIRST")"
SECOND="$(
  route_payload "$SECOND_WORKER_ID" |
    curl -fsS -X POST "$API_BASE/api/routing/sessions" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'Content-Type: application/json' --data-binary @-
)"
SECOND_SESSION="$(jq -er '.id' <<<"$SECOND")"

jq -e '.status == "ACTIVE" and .totalWaitSeconds == 0' <<<"$FIRST" >/dev/null
jq -e '.status == "ACTIVE" and .totalWaitSeconds > 0' <<<"$SECOND" >/dev/null

OVERLAPS="$(
  psql "$DATABASE_URL" -Atc "
    SELECT COUNT(*)
      FROM worker_route_reservations a
      JOIN worker_route_reservations b
        ON a.session_id < b.session_id
       AND a.resource_key = b.resource_key
       AND a.status = 'RESERVED'
       AND b.status = 'RESERVED'
       AND tstzrange(a.reserved_from,a.reserved_until,'[)')
           && tstzrange(b.reserved_from,b.reserved_until,'[)')
     WHERE a.session_id IN ('$FIRST_SESSION','$SECOND_SESSION')
       AND b.session_id IN ('$FIRST_SESSION','$SECOND_SESSION')
  "
)"
test "$OVERLAPS" = "0"

PROGRESSED="$(
  curl -fsS -X POST \
    "$API_BASE/api/routing/sessions/$FIRST_SESSION/progress" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    --data '{
      "routeVersion":1,
      "eventType":"STOP_COMPLETED",
      "locationCode":"A-01-01-1-A",
      "clientEventId":"runtime-smoke-stop-1"
    }'
)"
jq -e '
  .routeVersion == 2
  and ([.stops[] | select(.status == "COMPLETED")] | length) == 1
' <<<"$PROGRESSED" >/dev/null

STALE_STATUS="$(
  curl -sS -o "$SMOKE_DIR/stale.json" -w '%{http_code}' -X POST \
    "$API_BASE/api/routing/sessions/$FIRST_SESSION/progress" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    --data '{
      "routeVersion":1,
      "eventType":"HEARTBEAT",
      "clientEventId":"runtime-smoke-stale"
    }'
)"
test "$STALE_STATUS" = "409"

REBUILD_STATUS="$(
  curl -sS -o "$SMOKE_DIR/rebuild.json" -w '%{http_code}' -X POST \
    "$API_BASE/api/routing/graph/rebuild?warehouseId=$WAREHOUSE_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
)"
test "$REBUILD_STATUS" = "409"

jq -n \
  --arg warehouseId "$WAREHOUSE_ID" \
  --arg graphId "$(jq -r '.graphId' <<<"$GRAPH")" \
  --arg firstWaitSeconds "$(jq -r '.totalWaitSeconds' <<<"$FIRST")" \
  --arg secondWaitSeconds "$(jq -r '.totalWaitSeconds' <<<"$SECOND")" \
  --arg staleStatus "$STALE_STATUS" \
  --arg rebuildStatus "$REBUILD_STATUS" \
  '{
    ok:true,
    warehouseId:$warehouseId,
    graphId:$graphId,
    graph:{nodes:956,edges:1980,rackBays:280,mappedLocations:4200},
    firstWaitSeconds:($firstWaitSeconds|tonumber),
    secondWaitSeconds:($secondWaitSeconds|tonumber),
    overlappingReservations:0,
    staleVersionHttpStatus:($staleStatus|tonumber),
    rebuildWhileActiveHttpStatus:($rebuildStatus|tonumber)
  }'
