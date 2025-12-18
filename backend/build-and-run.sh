#!/bin/bash
# Simple build and run script for OptiWMS Backend

set -e

echo "=== Building OptiWMS Backend ==="
echo ""

# Check if Maven or Gradle
if [ -f "pom.xml" ] && command -v mvn &> /dev/null; then
    echo "Using Maven..."
    mvn clean install -DskipTests
    echo ""
    echo "=== Starting Application ==="
    mvn -pl core-api spring-boot:run
elif [ -f "gradlew" ]; then
    echo "Using Gradle..."
    ./gradlew clean build -x test
    echo ""
    echo "=== Starting Application ==="
    ./gradlew :core-api:bootRun
else
    echo "ERROR: Neither Maven nor Gradle found!"
    echo "Please install Maven or use Gradle wrapper"
    exit 1
fi

