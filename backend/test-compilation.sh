#!/bin/bash
echo "=== Testing Backend Compilation ==="
cd /Users/k.e.oshada/Documents/OptiWMS/backend

echo "1. Compiling infra module..."
./gradlew :infra:compileJava 2>&1 | tail -5

echo "2. Compiling core-domain module..."
./gradlew :core-domain:compileJava 2>&1 | tail -5

echo "3. Compiling core-app module..."
./gradlew :core-app:compileJava 2>&1 | tail -5

echo "4. Compiling core-api module..."
./gradlew :core-api:compileJava 2>&1 | tail -5

echo "5. Checking for repository count..."
./gradlew :core-api:bootRun --dry-run 2>&1 | grep -i "repository" | head -3

echo "=== Compilation Test Complete ==="

