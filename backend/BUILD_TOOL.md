# Build Tool: Gradle

OptiWMS backend uses **Gradle** as the build tool.

## Quick Start

```bash
cd backend

# Build the project
./gradlew clean build -x test

# Run the application
./gradlew :core-api:bootRun
```

## Project Structure

This is a **multi-module Gradle project**:

- `core-api` - Main Spring Boot application (REST API)
- `core-app` - Application services layer
- `core-domain` - Domain models
- `infra` - Infrastructure layer (JPA, repositories, database migrations)
- `integration` - External integrations

## Build Files

- `build.gradle.kts` - Root build configuration
- `settings.gradle.kts` - Project structure definition
- `gradle.properties` - Gradle properties
- `gradlew` / `gradlew.bat` - Gradle wrapper (Unix/Windows)

## Dependencies

All dependencies are managed in `build.gradle.kts`. The project uses:
- Spring Boot 3.3.0
- Java 21
- PostgreSQL 16
- Flyway 10.21.0 (database migrations)
- Hibernate/JPA

## Running the Application

The application will:
1. Connect to PostgreSQL on `localhost:5434`
2. Run Flyway migrations automatically
3. Start on `http://localhost:8080`

## API Endpoints

- Health: `http://localhost:8080/actuator/health`
- Warehouses: `http://localhost:8080/api/master/warehouses` (requires auth: admin/admin123)

## Troubleshooting

If you encounter issues:
1. Ensure PostgreSQL is running: `docker-compose -f infra/docker-compose.yml ps`
2. Check database connection in `core-api/src/main/resources/application.yml`
3. View logs for detailed error messages

