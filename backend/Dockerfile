# Multi-stage build for OptiWMS Backend
FROM gradle:8.9-jdk21 AS builder

WORKDIR /app

# Copy Gradle files first for better caching
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
# include the Gradle wrapper script (optional) and the gradle directory.
# note: the wrapper JAR itself is not checked in at the moment, so the
# build command below uses the preinstalled gradle binary from the base image.
# you can later add `gradle-wrapper.jar` to the repo and keep the `COPY gradle`
# step if you prefer to use `./gradlew`.
COPY gradlew ./
COPY gradle ./gradle

# Copy all source code
COPY core-api ./core-api
COPY core-app ./core-app
COPY core-domain ./core-domain
COPY infra ./infra
COPY integration ./integration

# Build the application using the image's Gradle installation
# (the wrapper JAR isn't present in this repo, so we rely on the
# preinstalled gradle binary instead)
RUN gradle build -x test --no-daemon

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the built JAR
COPY --from=builder /app/core-api/build/libs/*.jar app.jar

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
