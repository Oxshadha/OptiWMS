# OptiWMS — clone to running

Every datastore is rebuilt from tracked artifacts. No database is committed: a
binary blob in git goes stale without anyone noticing, and the derived data here
is fully reproducible from Flyway migrations, the v8 pipeline CSVs, and the model
bundle. A clone on any machine reproduces the same system.

## Prerequisites

| | Version | Check |
|---|---|---|
| Docker | any recent | `docker --version` |
| Java | 17 | `java -version` |
| Node | 20+ | `node --version` |
| Python | 3.12 (3.10+ works for the seed scripts) | `python3 --version` |
| `psql` + `sqlite3` | any | used by the seed and verify scripts |

A Google Gemini API key is needed for the assistant only. Copy
`ai_services/ai-agent/.env.example` to `.env` and set `GOOGLE_API_KEY`. Without
it everything else still runs; pass `--skip-rag` when seeding.

## Seed everything

```bash
./scripts/seed_all.sh          # or: ./scripts/seed_all.sh --skip-rag
./scripts/verify_seed.sh       # proves it worked, by querying each store
```

`seed_all.sh` pauses once to have you start the backend, because Flyway runs on
backend startup — that is what creates the schema, the seed users, and the eight
default SOPs. Everything after that is automatic.

`verify_seed.sh` queries each datastore directly rather than trusting the
seeder's output, and exits non-zero if anything is short. Expected result:

```
PostgreSQL            materials, locations, inventory, forecast_results, 8 SOPs
forecast-service      1,440 predictions · 1,440 SHAP explanations · 120 SKUs
SOP vector store      30 embeddings across 8 SOPs
policy evidence       generated on demand (see below)
```

## What each step rebuilds

| Store | Built from | Command |
|---|---|---|
| PostgreSQL schema, users, SOPs | Flyway migrations `V1..V97` | backend startup |
| Materials, locations, inventory, `forecast_results` | `outputs/data/*.csv`, `physical_materials.csv`, `location_assignments.csv.gz` | `scripts/load_project_operational_simulation.py` |
| `forecast_service.db` — predictions, metrics, SHAP | `outputs/operational_forecasts.csv`, `operational_shap.csv`, `operational_backtest_metrics.csv`, `inventory_policy_simulation.csv` | `scripts/seed_forecast_service_db.py` |
| SOP vector store (ChromaDB) | the `sops` table | `ai_services/ai-agent/ingest.py` |
| Monte Carlo policy evidence | live forecast + material data | a policy run (below) |

`seed_forecast_service_db.py` calls the same `_publish_service_snapshot()` the
live `/v8/recalculate` endpoint uses. A seeder that drifts from the production
path is worse than none, because it hides the drift.

## Monte Carlo evidence is not seeded

`inventory_policy_simulation_evidence` is produced by the Java policy engine from
whatever forecast and material data is live, so seeding it would freeze a
snapshot that no longer matches its inputs. Generate it after seeding:

```bash
curl -X POST http://localhost:8080/api/v1/forecast-space/policy-runs \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"warehouseId":"<warehouse-uuid>"}'
```

or press **Recalculate policies** on the Inventory Intelligence screen. The
simulation is seeded per `(run, material)`, so the same inputs always reproduce
the same 1,000 trials.

## Regenerating the model and its explanations

Only needed if the model or the demand data changes — the outputs are tracked, so
a normal clone skips this. It takes a few minutes and rewrites the serving
bundle.

```bash
cd "Ai miroservices/modeling/v8_controlled_synthetic_validation"
PYTHONPATH=. python3 -m pipeline.operational_forecast
```

This writes `operational_forecasts.csv` and `operational_shap.csv` together, so
predictions and explanations can never drift apart. Reseed afterwards with
`python3 scripts/seed_forecast_service_db.py --force`.

## Running the stack

```bash
docker compose -f infra/docker-compose.db.yml up -d          # postgres :5434
cd backend && ./gradlew :core-api:bootRun                    # :8080
cd ai_services/forecast-service && python3 -m uvicorn app.main:app --port 8091
cd ai_services/slotting-service  && python3 -m uvicorn app.main:app --port 8092
cd ai_services/ai-agent          && python3 -m uvicorn api:app --port 8094
cd frontend && npm install && npm run dev                    # :3000
```

## Tests

```bash
cd backend && ./gradlew :core-app:test :core-api:test
cd ai_services/forecast-service && python3 -m pytest -q
cd ai_services/slotting-service  && python3 -m pytest -q
cd "Ai miroservices/modeling/v8_controlled_synthetic_validation" && PYTHONPATH=. python3 -m pytest tests -q
cd frontend && npx tsc --noEmit && npm run build
```

## If Flyway reports a checksum mismatch

`V54` was corrected so the migration chain applies to an empty database (see
below). Any database seeded before that correction needs its recorded checksum
updated once — the migration's effect is unchanged, so nothing re-runs:

```bash
docker run --rm --network host \
  -v "$PWD/backend/infra/src/main/resources/db/migration:/flyway/sql:ro" \
  flyway/flyway:10.21.0 \
  -url=jdbc:postgresql://localhost:5434/optiwms -user=optiwms -password=optiwms repair
```

## What a fresh clone contains

A clone reproduces the **active** dataset exactly, not the archived history that
accumulates on a long-lived development database:

| | Fresh clone | A long-lived dev database |
|---|---|---|
| Planner-visible materials (`PROJECT_OPERATIONAL_SIMULATION`) | 144 | 144 |
| Active v8 locations | 4,206 | 4,206 |
| Forecast rows / SHAP explanations | 1,440 / 1,440 | 1,440 / 1,440 |
| Archived pre-v8 locations | 0 | ~190,000 |
| Archived baseline materials | 0 | ~722 |

The archived rows are filtered out of every planner query, so their absence does
not change what the application shows.

## Known gaps

- `scripts/README_SEED.md` describes restoring `optiwms_local_seed.sql.gz`, a
  96 MB dump that is **not tracked**. The path in this document replaces it and
  works from a clean clone.
- The 42 MB model bundle *is* tracked, since it cannot be regenerated without
  rerunning the whole pipeline.
