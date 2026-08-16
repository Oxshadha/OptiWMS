# OptiWMS Local Database Seed

This directory contains `optiwms_local_seed.sql.gz`, which is a full database export of the local development database. It includes all dummy data, AI forecast CSV data generated over time, generated SOPs, test users, and operational data needed for local development.

## Why use this?
Running Flyway migrations will give you a fresh, empty schema. But to work on UI features, analytics, and AI agents, you need a large amount of realistic warehouse data. Restoring this seed saves you from having to run data generators manually.

## How to restore the database

To restore this seed into your own local PostgreSQL instance (assuming it is running on `localhost:5434` with user `optiwms`), you can use the provided restore script from the root of the repository:

```bash
./scripts/restore_local_seed.sh
```

**Note for Windows / Manual restore:**
If you prefer to run it manually or use a GUI tool (like pgAdmin or DBeaver):
1. Unzip the file: `gunzip scripts/optiwms_local_seed.sql.gz`
2. Run the SQL script against your database. It includes `DROP TABLE IF EXISTS` commands, so it will overwrite your current schema cleanly.
```bash
psql -h localhost -p 5434 -U optiwms -d optiwms -f scripts/optiwms_local_seed.sql
```
