#!/bin/bash
# Test script to build and run backend

cd "$(dirname "$0")"

echo "=== Cleaning build ==="
./gradlew clean

echo ""
echo "=== Building project ==="
./gradlew build -x test

echo ""
echo "=== Starting application ==="
./gradlew :core-api:bootRun

