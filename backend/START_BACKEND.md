# How to Start the Backend

## Prerequisites
1. Database must be running (PostgreSQL)
2. JDK 21 or 25 installed
3. Gradle wrapper available

## Steps

### 1. Start Database (if not running)
```bash
cd infra
docker-compose up db -d
```

### 2. Start Backend
```bash
cd backend
./gradlew bootRun
```

### 3. Verify Backend is Running
```bash
# Check health endpoint
curl http://localhost:8080/actuator/health

# Or open in browser
open http://localhost:8080/actuator/health
```

## Expected Output

When backend starts successfully, you should see:
- "Started OptiWmsApplication" message
- Flyway migrations executed
- "Tomcat started on port(s): 8080"

## Troubleshooting

### Port 8080 already in use
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### Database connection error
- Check database is running: `docker ps`
- Check database credentials in `application.yml`
- Verify port 5434 is accessible

### Gradle issues
```bash
# Clean and rebuild
./gradlew clean build

# Run with debug
./gradlew bootRun --debug
```

## Using Docker (Alternative)

```bash
cd infra
docker-compose up backend -d
docker-compose logs -f backend
```

