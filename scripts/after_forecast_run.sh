#!/usr/bin/env bash
#
# What to run after pressing "Recalculate Forecast Now".
#
# The button triggers /v8/recalculate, which refits the model, republishes the
# forecast, reloads PostgreSQL and reloads the SHAP explanations into the
# forecast-service database. Most of that is automatic. This script checks it
# actually happened, and repairs the two things that do not update themselves.
#
#   ./scripts/after_forecast_run.sh            # check only
#   ./scripts/after_forecast_run.sh --repair   # check, then fix what is stale
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

REPAIR=0; [[ "${1:-}" == "--repair" ]] && REPAIR=1
FS=ai_services/forecast-service/forecast_service.db
OUT="Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs"
ok(){ printf '  \033[32mok\033[0m    %-42s %s\n' "$1" "$2"; }
bad(){ printf '  \033[31mFAIL\033[0m  %-42s %s\n' "$1" "$2"; }

echo "1. Did the run finish?"
docker logs ai_services-forecast-service-1 --tail 60 2>&1 \
  | grep -iE "recalculat|FileNotFound|Traceback|HTTP 500" | tail -3 || echo "  (no recent recalculation in the log)"

echo
echo "2. Pipeline artifacts on the host"
for f in operational_forecasts.csv operational_shap.csv operational_backtest_metrics.csv; do
  if [[ -f "$OUT/$f" ]]; then ok "$f" "$(date -r "$OUT/$f" '+%Y-%m-%d %H:%M')"
  else bad "$f" "missing — the pipeline did not complete"; fi
done

echo
echo "3. SHAP inside the container (what the UI reads)"
N=$(docker exec ai_services-forecast-service-1 python3 -c "
import sqlite3;c=sqlite3.connect('/data/forecast_service.db')
print(c.execute('select count(*) from forecast_shap_explanations').fetchone()[0])" 2>/dev/null || echo 0)
[[ "${N:-0}" -gt 0 ]] && ok "shap rows" "$N" || bad "shap rows" "0 — explanations will not appear"

echo
echo "4. PostgreSQL forecast rows"
PG=$(psql postgresql://optiwms:optiwms@localhost:5434/optiwms -tAc \
  "select count(*) from forecast_results" 2>/dev/null || echo 0)
[[ "${PG:-0}" -gt 0 ]] && ok "forecast_results" "$PG" || bad "forecast_results" "0"

echo
echo "5. Host copy of the forecast database (not updated by the run)"
HN=$(sqlite3 "$FS" "select count(*) from forecast_shap_explanations" 2>/dev/null || echo 0)
echo "     host has $HN shap rows; the container is the one the UI uses."

if [[ "$REPAIR" -eq 1 ]]; then
  echo
  echo "Repairing…"
  echo "  - reseeding the host forecast database from the new CSVs"
  python3 scripts/seed_forecast_service_db.py --force
  echo "  - rebuilding the SOP vector store"
  ( cd ai_services/ai-agent && python3 ingest.py >/dev/null 2>&1 \
      && echo "    vector store rebuilt" || echo "    vector store FAILED (embedding quota?)" )
fi

echo
echo "If SHAP rows are 0, the explanations did not reload. Re-run with --repair,"
echo "then restart the forecast service:  docker compose -f ai_services/docker-compose.ai.yml restart forecast-service"
