#!/usr/bin/env bash
#
# Check every datastore independently, by querying it -- not by trusting the
# seeder's own output. Prints a pass/fail line per store and exits non-zero if
# anything is missing, so it works in CI as well as by hand.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
DB_URL="${OPTIWMS_DB_URL:-postgresql://optiwms:optiwms@localhost:5434/optiwms}"
FAILED=0

check() { # name actual minimum
  if [[ -z "${2:-}" || "$2" == "err" ]]; then
    printf '  \033[31mFAIL\033[0m  %-42s unreachable\n' "$1"; FAILED=1
  elif (( $2 >= $3 )); then
    printf '  \033[32mok\033[0m    %-42s %s\n' "$1" "$2"
  else
    printf '  \033[31mFAIL\033[0m  %-42s %s (expected >= %s)\n' "$1" "$2" "$3"; FAILED=1
  fi
}

pg() { psql "$DB_URL" -tAc "$1" 2>/dev/null || echo err; }

echo "PostgreSQL"
check "materials"                  "$(pg 'select count(*) from materials')" 100
check "locations"                  "$(pg 'select count(*) from locations')" 100
check "inventory rows"             "$(pg 'select count(*) from inventory')" 50
check "forecast_results"           "$(pg 'select count(*) from forecast_results')" 1000
check "active SOPs"                "$(pg "select count(*) from sops where status='active'")" 8

echo "forecast-service (SQLite)"
FS=ai_services/forecast-service/forecast_service.db
if [[ -f "$FS" ]]; then
  q() { sqlite3 "$FS" "$1" 2>/dev/null || echo err; }
  check "forecast_predictions"     "$(q 'select count(*) from forecast_predictions')" 1000
  check "forecast_shap_explanations" "$(q 'select count(*) from forecast_shap_explanations')" 1000
  check "SHAP distinct SKUs"       "$(q 'select count(distinct sku) from forecast_shap_explanations')" 100
  check "model registry champions" "$(q 'select count(*) from model_registry_entries where is_champion=1')" 1
else
  printf '  \033[31mFAIL\033[0m  forecast_service.db                        missing\n'; FAILED=1
fi

echo "SOP vector store (ChromaDB)"
CH=ai_services/ai-agent/db/chroma.sqlite3
if [[ -f "$CH" ]]; then
  check "embeddings" "$(sqlite3 "$CH" 'select count(*) from embeddings' 2>/dev/null || echo err)" 20
  check "SOPs indexed" "$(sqlite3 "$CH" "select count(distinct string_value) from embedding_metadata where key='title'" 2>/dev/null || echo err)" 8
else
  printf '  \033[31mFAIL\033[0m  chroma.sqlite3                             missing (run ingest.py)\n'; FAILED=1
fi

echo "Monte Carlo policy evidence (generated on demand, not seeded)"
EV=$(pg 'select count(*) from inventory_policy_simulation_evidence')
if [[ "$EV" == "err" ]]; then
  printf '  \033[31mFAIL\033[0m  inventory_policy_simulation_evidence       unreachable\n'; FAILED=1
elif (( EV > 0 )); then
  printf '  \033[32mok\033[0m    %-42s %s\n' "simulation evidence rows" "$EV"
else
  printf '  \033[33m--\033[0m    %-42s none yet; run a policy recalculation\n' "simulation evidence rows"
fi

echo
if (( FAILED )); then echo "seed incomplete"; exit 1; else echo "all datastores present"; fi
