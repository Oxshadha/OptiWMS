# OptiWMS Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Java (need 21+)
java -version

# Check Node.js (need 20+)
node -v

# Check Docker
docker --version
```

## 🚀 3-Step Setup

### Step 1: Clone & Start Database
```bash
git clone <your-repo-url>
cd OptiWMS/infra
docker-compose up -d db
```

### Step 2: Start Backend
```bash
cd ../backend
./gradlew :core-api:bootRun
```
Wait for: `Started OptiWmsApplication` and `Found 8 JPA repository interfaces`

### Step 3: Start Frontend
```bash
# New terminal
cd frontend
npm install
npm run dev
```

## ✅ Verify

1. **Backend**: http://localhost:8080/actuator/health → `{"status":"UP"}`
2. **Frontend**: http://localhost:3000 → Should load
3. **Test API**: 
   ```bash
   curl -u admin:admin123 http://localhost:8080/api/master/warehouses
   ```

## 🎯 You're Ready!

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Default login: `admin` / `admin123`

**For detailed setup, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)**
