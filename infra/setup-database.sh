#!/bin/bash
# OptiWMS Database Setup Script for Mac/Linux
# This script ensures the database exists and is properly configured

echo "========================================="
echo "OptiWMS Database Setup"
echo "========================================="
echo ""

# Check if Docker is running
echo "Checking Docker status..."
if ! docker ps > /dev/null 2>&1; then
    echo "ERROR: Docker is not running or not installed!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check if database container is running
echo "Checking database container..."
if docker ps --filter "name=optiwms-db" --format "{{.Status}}" | grep -q "Up"; then
    echo "✓ Database container is running"
else
    echo "Starting database container..."
    cd "$(dirname "$0")"
    docker-compose up -d db
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to start database container!"
        exit 1
    fi
    echo "Waiting for database to be ready..."
    sleep 10
fi

# Wait for database to be ready
echo "Waiting for database to accept connections..."
max_retries=30
retry_count=0
db_ready=false

while [ $retry_count -lt $max_retries ] && [ "$db_ready" = false ]; do
    if docker exec optiwms-db pg_isready -U optiwms > /dev/null 2>&1; then
        db_ready=true
        echo "✓ Database is ready"
    else
        retry_count=$((retry_count + 1))
        echo "  Retrying... ($retry_count/$max_retries)"
        sleep 2
    fi
done

if [ "$db_ready" = false ]; then
    echo "ERROR: Database did not become ready in time!"
    exit 1
fi

# Check if database exists
echo "Checking if database 'optiwms' exists..."
if docker exec optiwms-db psql -U optiwms -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw optiwms; then
    echo "✓ Database 'optiwms' exists"
else
    echo "Database 'optiwms' does not exist. Creating it..."
    if docker exec optiwms-db psql -U optiwms -c "CREATE DATABASE optiwms;" > /dev/null 2>&1; then
        echo "✓ Database 'optiwms' created successfully"
    else
        # Try connecting to postgres database first
        echo "Attempting to create database via postgres database..."
        if docker exec optiwms-db psql -U optiwms -d postgres -c "CREATE DATABASE optiwms;" > /dev/null 2>&1; then
            echo "✓ Database 'optiwms' created successfully"
        else
            echo "ERROR: Failed to create database!"
            echo "You may need to create it manually:"
            echo "  docker exec -it optiwms-db psql -U optiwms -d postgres"
            echo "  CREATE DATABASE optiwms;"
            exit 1
        fi
    fi
fi

# Verify connection
echo "Verifying database connection..."
if docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT version();" > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "WARNING: Could not verify connection, but database exists"
fi

echo ""
echo "========================================="
echo "Database setup complete!"
echo "========================================="
echo ""
echo "You can now start the backend with:"
echo "  cd backend"
echo "  ./gradlew :core-api:bootRun"
echo ""

