#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_COMPOSE="$ROOT_DIR/infra/docker-compose.yml"
AI_COMPOSE="$ROOT_DIR/ai_services/docker-compose.ai.yml"
REFRESH=false

usage() {
  echo "Usage: scripts/dev-bootstrap.sh [--refresh-project-data]"
  echo "  --refresh-project-data  Development-only refresh of an existing noncanonical local DB."
}

for arg in "$@"; do
  case "$arg" in
    --refresh-project-data) REFRESH=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
  esac
done

command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required for artifact verification." >&2; exit 1; }
test -f "$ROOT_DIR/ai_services/.env" || {
  echo "Missing ai_services/.env. Copy ai_services/.env.example and supply required secrets." >&2
  exit 1
}
test -f "$ROOT_DIR/Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs/serving_bundle/production/model.pkl" || {
  echo "The promoted model artifact is missing from this checkout." >&2
  exit 1
}
python3 "$ROOT_DIR/scripts/verify_forecast_artifact_contract.py" >/dev/null
EXPECTED_DATASET_HASH="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["loaderDatasetSha256"])' "$ROOT_DIR/scripts/forecast-artifact.lock.json")"

COMMIT_SHA="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8080}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3000}"
export BACKEND_HOST_PORT FRONTEND_HOST_PORT
export OPTIWMS_BUILD_COMMIT="${OPTIWMS_BUILD_COMMIT:-$COMMIT_SHA}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${BACKEND_HOST_PORT}/api}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_HOST_PORT}}"
echo "OptiWMS bootstrap commit: $COMMIT_SHA"

docker compose -f "$CORE_COMPOSE" up -d db backend

echo "Waiting for Spring/Flyway readiness..."
for attempt in $(seq 1 90); do
  if curl --fail --silent "http://localhost:${BACKEND_HOST_PORT}/actuator/health" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 90 ]; then
    docker compose -f "$CORE_COMPOSE" logs --tail=120 backend
    echo "Backend did not become healthy." >&2
    exit 1
  fi
  sleep 2
done

db_scalar() {
  docker compose -f "$CORE_COMPOSE" exec -T db psql -U "${POSTGRES_USER:-optiwms}" -d "${POSTGRES_DB:-optiwms}" -Atqc "$1"
}

MATERIALS="$(db_scalar "SELECT COUNT(*) FROM materials")"
PROJECT_MATERIALS="$(db_scalar "SELECT COUNT(*) FROM materials WHERE data_quality_tier='PROJECT_OPERATIONAL_SIMULATION'")"
AUDITS="$(db_scalar "SELECT COUNT(*) FROM project_dataset_load_audit WHERE dataset_version='PROJECT_OPERATIONAL_SIMULATION_V8' AND status='ok'")"
CANONICAL_ROWS="$(db_scalar "SELECT COUNT(*) FROM forecast_results WHERE training_source='project_ops_v8' AND model_name='PROJECT_OPS_EXTRA_TREES_CAUSAL'")"
MARKER_TABLE="$(db_scalar "SELECT COUNT(*) FROM pg_class WHERE oid=to_regclass('public.optiwms_environment_marker')")"
PROJECT_MARKER=0
if [ "$MARKER_TABLE" -gt 0 ]; then
  PROJECT_MARKER="$(db_scalar "SELECT COUNT(*) FROM optiwms_environment_marker WHERE purpose='PROJECT_OPERATIONAL'")"
fi

if [ "$MATERIALS" -gt 0 ] && [ "$AUDITS" -eq 0 ] && [ "$PROJECT_MARKER" -eq 0 ] && [ "$REFRESH" != true ]; then
  echo "Refusing to replace a populated database that is not marked PROJECT_OPERATIONAL." >&2
  echo "Use --refresh-project-data only for a disposable development database." >&2
  exit 1
fi

if [ "$PROJECT_MATERIALS" -eq 144 ] && [ "$CANONICAL_ROWS" -eq 1440 ] && [ "$AUDITS" -gt 0 ] && [ "$REFRESH" != true ]; then
  echo "Canonical project-operational data already loaded; bootstrap is idempotently skipping reload."
else
  docker compose -f "$CORE_COMPOSE" --profile bootstrap run --rm forecast-bootstrap
fi

VERIFY_SQL="
WITH w AS (SELECT id FROM warehouses WHERE code='WH-001')
SELECT concat_ws('|',
  (SELECT COUNT(*) FROM materials WHERE data_quality_tier='PROJECT_OPERATIONAL_SIMULATION'),
  (SELECT COUNT(*) FROM forecast_results WHERE warehouse_id=(SELECT id FROM w) AND training_source='project_ops_v8' AND model_name='PROJECT_OPS_EXTRA_TREES_CAUSAL'),
  (SELECT COUNT(*) FROM forecast_results WHERE warehouse_id=(SELECT id FROM w) AND decision_eligible=true AND training_source='project_ops_v8'),
  (SELECT COUNT(*) FROM locations WHERE warehouse_id=(SELECT id FROM w) AND dataset_version='PROJECT_OPERATIONAL_SIMULATION_V8' AND is_active=true),
  (SELECT COUNT(*) FROM forecast_model_registry WHERE dataset='PROJECT_OPS_RM_PM' AND model_name='PROJECT_OPS_EXTRA_TREES_CAUSAL' AND status='PROMOTED' AND promotion_eligible=true),
  (SELECT dataset_hash FROM project_dataset_load_audit WHERE dataset_version='PROJECT_OPERATIONAL_SIMULATION_V8' AND status='ok' ORDER BY finished_at DESC LIMIT 1)
);"
IFS='|' read -r V_MATERIALS V_FORECASTS V_ELIGIBLE V_LOCATIONS V_MODEL V_HASH <<<"$(db_scalar "$VERIFY_SQL")"

test "$V_MATERIALS" = "144" || { echo "Expected 144 project materials, got $V_MATERIALS" >&2; exit 1; }
test "$V_FORECASTS" = "1440" || { echo "Expected 1440 H1-H12 forecast rows, got $V_FORECASTS" >&2; exit 1; }
test "$V_ELIGIBLE" = "1440" || { echo "Expected 1440 decision-eligible rows, got $V_ELIGIBLE" >&2; exit 1; }
test "$V_LOCATIONS" = "4206" || { echo "Expected 4206 canonical locations, got $V_LOCATIONS" >&2; exit 1; }
test "$V_MODEL" = "1" || { echo "Promoted canonical model registration is missing." >&2; exit 1; }
test "$V_HASH" = "$EXPECTED_DATASET_HASH" || {
  echo "Database dataset checksum does not match the packaged serving/loader contract." >&2
  exit 1
}

docker compose -f "$AI_COMPOSE" up -d --build forecast-service orchestrator-service slotting-service

# A clean-clone acceptance build must not inherit an old Next.js output tree.
if [ -d "$ROOT_DIR/frontend/.next" ]; then
  rm -rf "$ROOT_DIR/frontend/.next"
fi
docker compose -f "$CORE_COMPOSE" up -d --build frontend

echo ""
echo "OptiWMS developer environment is ready"
echo "  Frontend:        http://localhost:${FRONTEND_HOST_PORT}"
echo "  Spring API:      http://localhost:${BACKEND_HOST_PORT}"
echo "  Forecast API:    http://localhost:8091"
echo "  Orchestrator:    http://localhost:8092"
echo "  Slotting API:    http://localhost:8093"
echo "  Dataset:         PROJECT_OPS_RM_PM / PROJECT_OPERATIONAL_SIMULATION_V8"
echo "  Model:           PROJECT_OPS_EXTRA_TREES_CAUSAL"
echo "  Dataset checksum $V_HASH"
echo "  Commit:          $COMMIT_SHA"
