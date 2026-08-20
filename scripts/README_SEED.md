# Seeding the databases

**The supported path is [`../SETUP.md`](../SETUP.md).** Run:

```bash
./scripts/seed_all.sh
./scripts/verify_seed.sh
```

Everything is rebuilt from artifacts that are in git — Flyway migrations, the v8
pipeline CSVs and the model bundle — so a clone on any machine reproduces the
same system.

## Why this replaced the SQL dump

This file used to describe restoring `optiwms_local_seed.sql.gz`, a full export of
one developer's local database. That file is **not tracked** and never was, so
the instructions could not work on a fresh clone — the only machine they worked
on was the one that produced the dump.

A dump also captures whatever state that database happened to be in. The local
copy had drifted from the tracked forecast CSVs by up to 138 units before it was
rebuilt, and nothing surfaced the difference.

`restore_local_seed.sh` still works if you generate a dump yourself:

```bash
pg_dump -h localhost -p 5434 -U optiwms optiwms | gzip > scripts/optiwms_local_seed.sql.gz
```

That is a reasonable way to move a specific state between your own machines. It
is not how a teammate should set up from scratch.

## What each script does

| Script | Purpose |
|---|---|
| `seed_all.sh` | Rebuilds every datastore in dependency order |
| `verify_seed.sh` | Queries each store to prove the seed worked; non-zero exit on failure |
| `seed_forecast_service_db.py` | Rebuilds forecast-service SQLite (predictions, metrics, SHAP) from tracked CSVs |
| `load_project_operational_simulation.py` | Loads the v8 materials, locations, inventory and forecasts into PostgreSQL |
| `load_project_operational_baseline.py` | Older v3 baseline loader; still called by forecast-service `canonical.py` |
| `restore_local_seed.sh` | Restores a `pg_dump` you generated yourself (see above) |
