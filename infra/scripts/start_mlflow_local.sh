#!/usr/bin/env bash
# Run MLflow locally (no Docker) — use if optiwms-mlflow container keeps crashing.
set -euo pipefail

PORT="${MLFLOW_PORT:-5001}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5434}"
DB_USER="${POSTGRES_USER:-optiwms}"
DB_PASS="${POSTGRES_PASSWORD:-optiwms}"
ARTIFACTS_DIR="${MLFLOW_ARTIFACTS:-/tmp/optiwms-mlartifacts}"

mkdir -p "$ARTIFACTS_DIR"

echo "Starting MLflow on http://localhost:${PORT}"
echo "Backend: postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/mlflow"

mlflow server \
  --host 0.0.0.0 \
  --port "$PORT" \
  --backend-store-uri "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/mlflow" \
  --default-artifact-root "$ARTIFACTS_DIR"
