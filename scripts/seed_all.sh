#!/usr/bin/env bash
#
# Rebuild every datastore OptiWMS needs, from a fresh clone, in dependency order.
#
# None of the databases are in git -- they are derived data, and a binary blob in
# version control goes stale without anyone noticing. Everything here is rebuilt
# from tracked artifacts: Flyway migrations, the v8 pipeline CSVs, and the model
# bundle. That means a clone on any machine reproduces the same system.
#
# Safe to re-run. Every step either upserts or is explicitly forced.
#
# Usage:
#   ./scripts/seed_all.sh              # full seed
#   ./scripts/seed_all.sh --skip-rag   # skip the step that needs a Google API key
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_URL="${OPTIWMS_DB_URL:-postgresql://optiwms:optiwms@localhost:5434/optiwms}"
WAREHOUSE="${OPTIWMS_WAREHOUSE:-WH-001}"
SKIP_RAG=0
[[ "${1:-}" == "--skip-rag" ]] && SKIP_RAG=1

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31merror: %s\033[0m\n' "$1" >&2; exit 1; }

step "1/5  PostgreSQL"
docker compose -f infra/docker-compose.db.yml up -d
printf 'waiting for postgres'
for _ in $(seq 1 45); do
  if docker exec optiwms-db pg_isready -U optiwms -d optiwms >/dev/null 2>&1; then
    printf ' ready\n'; break
  fi
  printf '.'; sleep 2
done
docker exec optiwms-db pg_isready -U optiwms -d optiwms >/dev/null 2>&1 \
  || fail "postgres did not become ready"

step "2/5  Schema and SOPs (Flyway, via the backend)"
echo "Flyway runs on backend startup and creates the schema, seed users and the"
echo "eight default SOPs (V97). Start the backend once, wait for it to listen on"
echo "8080, then stop it:"
echo "    cd backend && ./gradlew :core-api:bootRun"
read -r -p "Press enter once the backend has started and migrated (or Ctrl-C to abort) "
psql "$DB_URL" -tAc "select count(*) from flyway_schema_history" >/dev/null 2>&1 \
  || fail "schema not found -- did the backend start and migrate?"
SOPS=$(psql "$DB_URL" -tAc "select count(*) from sops where status='active'")
echo "active SOPs: $SOPS"

step "3/5  Operational data (materials, locations, inventory, forecasts) -> PostgreSQL"
python3 scripts/load_project_operational_simulation.py \
  --db-url "$DB_URL" --warehouse-code "$WAREHOUSE"

step "4/5  forecast-service database (predictions, metrics, SHAP) -> SQLite"
python3 scripts/seed_forecast_service_db.py --warehouse "$WAREHOUSE" --force

if [[ "$SKIP_RAG" -eq 1 ]]; then
  step "5/5  SOP vector store -- SKIPPED"
else
  step "5/5  SOP vector store (ChromaDB) <- the sops table"
  [[ -f ai_services/ai-agent/.env ]] \
    || fail "ai_services/ai-agent/.env missing -- copy .env.example and set GOOGLE_API_KEY"
  ( cd ai_services/ai-agent && python3 ingest.py )
fi

step "Done"
cat <<'SUMMARY'
Rebuilt:
  postgres  optiwms          schema, users, SOPs, materials, locations, inventory, forecasts
  sqlite    forecast_service.db  1,440 predictions + 1,440 SHAP explanations
  chroma    ai-agent/db      30 chunks across 8 SOPs

Monte Carlo policy evidence is generated on demand, not seeded: trigger a policy
run from the Inventory Intelligence screen, or
  POST /api/v1/forecast-space/policy-runs

Verify with:
  ./scripts/verify_seed.sh
SUMMARY
