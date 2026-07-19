#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BOOT_JAR="$BACKEND_DIR/core-api/build/libs/core-api-0.1.0-SNAPSHOT.jar"

if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN="$(command -v docker)"
elif [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
  DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
else
  echo "Docker CLI was not found. Start/install Docker Desktop and retry." >&2
  exit 1
fi

echo "Building the Spring Boot JAR with the host Gradle dependency cache..."
(
  cd "$BACKEND_DIR"
  ./gradlew :core-api:bootJar --no-daemon
)

if [[ ! -s "$BOOT_JAR" ]]; then
  echo "Expected boot JAR was not created: $BOOT_JAR" >&2
  exit 1
fi

echo "Packaging and starting the backend without resolving Maven dependencies inside Docker..."
"$DOCKER_BIN" compose \
  -f "$ROOT_DIR/infra/docker-compose.yml" \
  -f "$ROOT_DIR/infra/docker-compose.runtime.yml" \
  up -d --build backend

echo "Backend runtime image built from: $BOOT_JAR"
