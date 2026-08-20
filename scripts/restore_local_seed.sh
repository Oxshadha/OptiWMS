#!/bin/bash

# NOTE: scripts/optiwms_local_seed.sql.gz is NOT tracked in git. This script only
# works if you generated that dump yourself:
#     pg_dump -h localhost -p 5434 -U optiwms optiwms | gzip > scripts/optiwms_local_seed.sql.gz
# For setting up from a fresh clone, use ./scripts/seed_all.sh instead (SETUP.md).

# Exit on error
set -e

# Default variables
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5434"}
DB_USER=${DB_USER:-"optiwms"}
DB_NAME=${DB_NAME:-"optiwms"}

echo "OptiWMS Database Restore Utility"
echo "================================"
echo "This script will restore the OptiWMS local database seed."
echo "WARNING: This will DESTROY ALL EXISTING DATA in the '$DB_NAME' database!"
echo "Are you sure you want to proceed? (y/n)"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
fi

echo "Please enter the database password for user '$DB_USER':"
read -s PGPASSWORD
export PGPASSWORD

echo "Restoring database from compressed seed file..."
# Extract and pipe directly to psql to save disk space
gzcat scripts/optiwms_local_seed.sql.gz | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

echo "================================"
echo "Restore complete! The database is now populated with the local seed data."
