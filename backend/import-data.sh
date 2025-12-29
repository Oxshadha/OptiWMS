#!/bin/bash

# Script to run migration and import CSV data
# Usage: ./import-data.sh

set -e

echo "=========================================="
echo "OptiWMS Data Import Script"
echo "=========================================="

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
CSV_DIR="$PROJECT_ROOT/frontend/Database Documents"

echo "Project root: $PROJECT_ROOT"
echo "CSV directory: $CSV_DIR"
echo ""

# Check if CSV files exist
if [ ! -f "$CSV_DIR/Item code and descriptions.csv" ]; then
    echo "ERROR: Item code and descriptions.csv not found in $CSV_DIR"
    exit 1
fi

if [ ! -f "$CSV_DIR/Active stock.csv" ]; then
    echo "ERROR: Active stock.csv not found in $CSV_DIR"
    exit 1
fi

echo "✅ CSV files found"
echo ""

# Step 1: Start database (if not running)
echo "Step 1: Checking database..."
if ! docker ps | grep -q optiwms-db; then
    echo "Starting database..."
    cd "$PROJECT_ROOT/infra"
    docker-compose up -d db
    echo "Waiting for database to be ready..."
    sleep 5
else
    echo "✅ Database is running"
fi
echo ""

# Step 2: Run migration (by starting the app)
echo "Step 2: Running migration V4..."
echo "This will happen automatically when the app starts"
echo ""

# Step 3: Build the project
echo "Step 3: Building project..."
cd "$SCRIPT_DIR"
./gradlew build -x test
echo "✅ Build complete"
echo ""

# Step 4: Start the application in background to run migration
echo "Step 4: Starting application to run migration..."
./gradlew :core-api:bootRun > /tmp/optiwms-startup.log 2>&1 &
APP_PID=$!
echo "Application starting (PID: $APP_PID)"
echo "Waiting for application to start..."
sleep 15

# Check if app started successfully
if ! curl -s http://localhost:8080/actuator/health > /dev/null; then
    echo "⚠️  Application may not be fully started. Waiting a bit more..."
    sleep 10
fi

if curl -s http://localhost:8080/actuator/health > /dev/null; then
    echo "✅ Application is running"
else
    echo "❌ Application failed to start. Check logs: /tmp/optiwms-startup.log"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi
echo ""

# Step 5: Get or create a warehouse
echo "Step 5: Setting up warehouse..."
WAREHOUSE_RESPONSE=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses)
if [ "$(echo $WAREHOUSE_RESPONSE | jq 'length')" -eq "0" ]; then
    echo "Creating default warehouse..."
    WAREHOUSE_ID=$(curl -s -X POST -u admin:admin123 \
        -H "Content-Type: application/json" \
        -d '{"code":"WH-001","name":"Colombo Main Warehouse","city":"Colombo","country":"Sri Lanka","status":"active"}' \
        http://localhost:8080/api/master/warehouses | jq -r '.id')
    echo "✅ Created warehouse: $WAREHOUSE_ID"
else
    WAREHOUSE_ID=$(echo $WAREHOUSE_RESPONSE | jq -r '.[0].id')
    echo "✅ Using existing warehouse: $WAREHOUSE_ID"
fi
echo ""

# Step 6: Import materials
echo "Step 6: Importing materials from CSV..."
MATERIALS_CSV="$CSV_DIR/Item code and descriptions.csv"
IMPORT_RESPONSE=$(curl -s -X POST -u admin:admin123 \
    -H "Content-Type: application/json" \
    -d "{\"csvPath\":\"$MATERIALS_CSV\"}" \
    http://localhost:8080/api/integration/import/materials)

if [ "$(echo $IMPORT_RESPONSE | jq -r '.success')" = "true" ]; then
    IMPORTED=$(echo $IMPORT_RESPONSE | jq -r '.imported')
    echo "✅ Imported $IMPORTED materials"
else
    echo "❌ Failed to import materials: $(echo $IMPORT_RESPONSE | jq -r '.error')"
fi
echo ""

# Step 7: Import inventory
echo "Step 7: Importing inventory from CSV..."
INVENTORY_CSV="$CSV_DIR/Active stock.csv"
INVENTORY_RESPONSE=$(curl -s -X POST -u admin:admin123 \
    -H "Content-Type: application/json" \
    -d "{\"csvPath\":\"$INVENTORY_CSV\",\"warehouseId\":\"$WAREHOUSE_ID\"}" \
    http://localhost:8080/api/integration/import/inventory)

if [ "$(echo $INVENTORY_RESPONSE | jq -r '.success')" = "true" ]; then
    PROCESSED=$(echo $INVENTORY_RESPONSE | jq -r '.materialsProcessed')
    CREATED=$(echo $INVENTORY_RESPONSE | jq -r '.inventoryCreated')
    echo "✅ Processed $PROCESSED materials, created $CREATED inventory records"
else
    echo "❌ Failed to import inventory: $(echo $INVENTORY_RESPONSE | jq -r '.error')"
fi
echo ""

# Step 8: Update non-pallet materials
if [ -f "$CSV_DIR/Raw matrilas not store in pallets.csv" ]; then
    echo "Step 8: Updating non-pallet materials..."
    NON_PALLET_CSV="$CSV_DIR/Raw matrilas not store in pallets.csv"
    NON_PALLET_RESPONSE=$(curl -s -X POST -u admin:admin123 \
        -H "Content-Type: application/json" \
        -d "{\"csvPath\":\"$NON_PALLET_CSV\"}" \
        http://localhost:8080/api/integration/import/non-pallet-materials)
    
    if [ "$(echo $NON_PALLET_RESPONSE | jq -r '.success')" = "true" ]; then
        UPDATED=$(echo $NON_PALLET_RESPONSE | jq -r '.updated')
        echo "✅ Updated $UPDATED non-pallet materials"
    else
        echo "⚠️  Failed to update non-pallet materials: $(echo $NON_PALLET_RESPONSE | jq -r '.error')"
    fi
    echo ""
fi

# Step 9: Summary
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "Application is running on http://localhost:8080"
echo "To stop the application, run: kill $APP_PID"
echo ""
echo "You can now:"
echo "1. Test the API: curl -u admin:admin123 http://localhost:8080/api/master/materials"
echo "2. Check inventory: curl -u admin:admin123 http://localhost:8080/api/inventory"
echo ""

