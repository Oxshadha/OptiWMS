# Quick Start - OptiWMS Backend

## 🚀 Easiest Way to Start

### Option 1: Use the Build Script (Recommended)
```bash
cd backend
./build-and-run.sh
```

### Option 2: Gradle (Fixed - Should Work Now)
```bash
cd backend
./gradlew :core-api:bootRun
```

### Option 3: Maven
```bash
cd backend
mvn clean install -DskipTests
mvn -pl core-api spring-boot:run
```

## ✅ What Was Fixed

1. **Flyway PostgreSQL 16 Support**: Added `flyway-database-postgresql` dependency
2. **Duplicate Repository Config**: Removed from InfraConfig
3. **Main Class Configuration**: Properly set in build files

## 🔍 Verify It's Working

Once started, test:
```bash
# Health check
curl http://localhost:8080/actuator/health

# Warehouses API (with auth)
curl -u admin:admin123 http://localhost:8080/api/master/warehouses
```

## 📝 Expected Output

You should see:
1. ✅ Building project
2. ✅ Flyway executing migrations (V1, V2)
3. ✅ "Started OptiWmsApplication"
4. ✅ "Tomcat started on port(s): 8080"

## 🐛 If Still Having Issues

1. **Check database is running**:
   ```bash
   docker ps | grep optiwms-db
   ```

2. **Check port 8080**:
   ```bash
   lsof -i :8080
   ```

3. **View detailed logs**:
   ```bash
   # Gradle
   ./gradlew :core-api:bootRun --info
   
   # Maven
   mvn -pl core-api spring-boot:run -X
   ```

## 💡 Recommendation

**Try Gradle first** - I've fixed the Flyway issue. If that doesn't work, use the build script which will automatically choose the right tool.

