# Running the Backend - Troubleshooting Guide

## Quick Start

```bash
cd backend
./gradlew :core-api:bootRun
```

## If Main Class Error Persists

### Option 1: Use Spring Boot's auto-detection
The main class should be auto-detected. If not, try:

```bash
./gradlew :core-api:bootRun --args="--spring.main.web-application-type=servlet"
```

### Option 2: Build JAR and run directly
```bash
./gradlew :core-api:bootJar
java -jar core-api/build/libs/core-api-0.1.0-SNAPSHOT.jar
```

### Option 3: Check if main class exists
```bash
./gradlew :core-api:classes
ls -la core-api/build/classes/java/main/com/optiwms/coreapi/
```

## Common Issues

### 1. Main Class Not Found
**Solution**: The main class is configured in `build.gradle.kts`. Verify:
- File exists: `core-api/src/main/java/com/optiwms/coreapi/OptiWmsApplication.java`
- Package matches: `package com.optiwms.coreapi;`
- Has main method: `public static void main(String[] args)`

### 2. Database Connection Error
**Check**:
- Database is running: `docker ps | grep optiwms-db`
- Connection string in `application.yml` matches database port
- Credentials are correct

### 3. Port 8080 Already in Use
```bash
lsof -i :8080
kill -9 <PID>
```

### 4. Gradle Wrapper Issues
```bash
chmod +x gradlew
./gradlew --version
```

## Verify Backend is Running

```bash
# Check health endpoint
curl http://localhost:8080/actuator/health

# Check if process is running
ps aux | grep OptiWmsApplication
```

## Using Docker (Alternative)

If local setup is problematic, use Docker:

```bash
cd infra
docker-compose up backend -d
docker-compose logs -f backend
```

