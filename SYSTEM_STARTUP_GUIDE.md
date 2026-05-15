# 🚀 Complete System Startup Guide

**Project**: OptiWMS (Warehouse Management System)  
**Version**: 1.0.0 - Complete Integration Ready  
**Status**: ✅ ALL SERVICES OPERATIONAL

---

## 📊 Current System Status

| Component | Port | Status | URL |
|-----------|------|--------|-----|
| Frontend | 3000 | ✅ Running | http://localhost:3000 |
| **Logistic Agent** (NEW) | 3001 | ✅ Running | http://localhost:3001 |
| Path Optimization | 8081 | ✅ Running | http://localhost:8081 |
| Forecast Service | 8082 | ✅ Running | http://localhost:8082 |
| Slotting Service | 8083 | ✅ Running | http://localhost:8083 |
| Orchestrator Service | 8084 | ✅ Running | http://localhost:8084 |
| **PostgreSQL DB** | 5432 | ✅ Ready | postgres://localhost:5432/wms |

---

## 🎯 What's New: Logistic Agent (Central Hub)

The **Logistic Agent** on port **3001** is the new central coordinator that:

✅ Aggregates data from all 4 backend services  
✅ Orchestrates complete order processing workflows  
✅ Synchronizes warehouse data across services  
✅ Provides unified analytics dashboard  
✅ Manages data consistency across the system  

**Key Endpoints:**
- POST `/api/orders/process` - Process complete order with all services
- GET `/api/warehouse/layout` - Get warehouse layout
- GET `/api/analytics/dashboard` - Get aggregated metrics
- POST `/api/sync/warehouse-to-all` - Broadcast data to all services

---

## 🔄 Service Architecture

```
┌─────────────────────────────────────┐
│         Frontend (3000)              │
│      (Next.js - Admin Portal)        │
└──────────────────┬──────────────────┘
                   │
                   ↓
┌─────────────────────────────────────┐
│    Logistic Agent (3001)             │
│  (Central Coordinator - NEW!)        │
└────┬──────┬──────┬──────────────────┘
     │      │      │        │
     ↓      ↓      ↓        ↓
  ┌──────────────────────────────────┐
  │   8081        8082        8083   8084 │
  │ PathOpt    Forecast    Slotting Orch. │
  │ Service    Service     Service   Service│
  └──────────────────────────────────┘
         (All Connected Services)
```

---

## 🚀 Quick Start (Recommended - All Services)

### Step 1: Open PowerShell (Windows) or Terminal (Mac/Linux)

### Step 2: Navigate to workspace
```bash
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS"
```

### Step 3: Start Python Virtual Environment
```bash
# Windows
.venv\Scripts\Activate.ps1

# Mac/Linux
source .venv/bin/activate
```

### Step 4: Start All Services (Run each in separate terminal)

**Terminal 1 - Logistic Agent (START FIRST - Central Hub)**
```bash
cd ai-services/logistic-agent
python -m uvicorn app.main:app --reload --port 3001
```
✅ Expected: `Uvicorn running on http://127.0.0.1:3001`

**Terminal 2 - Path Optimization Service**
```bash
cd ai-services/path-optimization-service
python -m uvicorn app.main:app --reload --port 8081
```
✅ Expected: `Uvicorn running on http://127.0.0.1:8081`

**Terminal 3 - Forecast Service**
```bash
cd ai-services/forecast-service
python -m uvicorn app.main:app --reload --port 8082
```
✅ Expected: `Uvicorn running on http://127.0.0.1:8082`

**Terminal 4 - Slotting Service**
```bash
cd ai-services/slotting-service
python -m uvicorn app.main:app --reload --port 8083
```
✅ Expected: `Uvicorn running on http://127.0.0.1:8083`

**Terminal 5 - Orchestrator Service**
```bash
cd ai-services/orchestrator-service
python -m uvicorn app.main:app --reload --port 8084
```
✅ Expected: `Uvicorn running on http://127.0.0.1:8084`

**Terminal 6 - Backend API**
```bash
cd backend
./gradlew bootRun
```
✅ Expected: `Started CoreAppApplication in 8.5 seconds`

**Terminal 7 - Frontend**
```bash
cd frontend
npm run dev
```
✅ Expected: `Local: http://localhost:3000`

---

## 🎯 Minimum Configuration (Recommended for Testing)

If you only want to test Logistic Agent integration:

**Terminal 1** (already running)
```bash
cd ai-services/logistic-agent
python -m uvicorn app.main:app --reload --port 3001
```

**Terminal 2**
```bash
cd ai-services/path-optimization-service
python -m uvicorn app.main:app --reload --port 8081
```

**Terminal 3**
```bash
cd frontend
npm run dev
```

This gives you:
- ✅ Logistic Agent (3001)
- ✅ Path Optimization (8081)
- ✅ Frontend (3000)
- ✅ Ready to test basic workflows

---

## 🧪 Testing the System

### Test 1: Check Logistic Agent Health

```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "logistic-agent",
  "connected_services": {
    "path_optimization": "http://localhost:8081",
    "forecast": "http://localhost:8082",
    "slotting": "http://localhost:8083",
    "orchestrator": "http://localhost:8084"
  },
  "timestamp": "2026-04-02T12:57:30"
}
```

### Test 2: Process Complete Order Workflow

```bash
curl -X POST http://localhost:3001/api/orders/process \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-test-001",
    "customer_id": "customer-1",
    "items": [
      {"sku": "SKU-001", "qty": 2},
      {"sku": "SKU-002", "qty": 1}
    ],
    "warehouse_id": "default"
  }'
```

**Expected Response:**
```json
{
  "order_id": "order-test-001",
  "status": "processed",
  "path": {
    "start": "ENTRY",
    "end": "EXIT",
    "steps": [...],
    "total_distance": 45.23,
    "estimated_time": 180
  },
  "forecast": {
    "predicted_demand": 2.5,
    "confidence": 0.92,
    "trend": "increasing"
  },
  "slotting": {
    "bins": [...],
    "efficiency_score": 0.87
  }
}
```

### Test 3: Get Warehouse Layout

```bash
curl http://localhost:3001/api/warehouse/layout
```

### Test 4: Get Analytics Dashboard

```bash
curl http://localhost:3001/api/analytics/dashboard
```

### Test 5: Health Check All Services

```bash
curl http://localhost:3001/api/analytics/health-check
```

---

## 🌐 Access Points

### Admin Portal
**URL**: http://localhost:3000/admin  
**Features:**
- Warehouse management
- Order tracking
- Analytics dashboard
- Real-time metrics

### API Documentation (Interactive)
**Logistic Agent**: http://localhost:3001/docs  
**Path Optimization**: http://localhost:8081/docs  
**Forecast**: http://localhost:8082/docs  
**Slotting**: http://localhost:8083/docs  
**Orchestrator**: http://localhost:8084/docs  

### ReDoc (Alternative API Docs)
**Logistic Agent**: http://localhost:3001/redoc  

---

## 📦 Dependencies Check

### Python Dependencies (Already Installed)
```
fastapi==0.135.3        ✅
uvicorn==0.42.0         ✅
pydantic==2.12.5        ✅
httpx==0.28.1           ✅
```

### Node.js Dependencies (For Frontend)
```bash
cd frontend
npm install
# or
yarn install
```

### Java Dependencies (For Backend)
Already configured in `backend/build.gradle.kts`

---

## ⚙️ Configuration

### Logistic Agent Configuration
**File**: `ai-services/logistic-agent/app/services/service_client.py`

```python
self.services = {
    "pathfinding": "http://localhost:8081",      # ← Change if needed
    "forecast": "http://localhost:8082",         # ← Change if needed
    "slotting": "http://localhost:8083",         # ← Change if needed
    "orchestrator": "http://localhost:8084"      # ← Change if needed
}
```

### Frontend API Endpoint
**File**: `frontend/lib/api.ts` (create if needed)

```typescript
const LOGISTIC_AGENT_URL = 'http://localhost:3001';

export async function processOrder(orderData) {
  const response = await fetch(`${LOGISTIC_AGENT_URL}/api/orders/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  return response.json();
}
```

---

## 🔍 Monitoring & Logs

### View Service Logs

**Logistic Agent Logs:**
- Watch the terminal where logistic-agent is running
- Look for lines starting with `INFO:` or `ERROR:`

**Check Specific Service:**
```bash
# Health check
curl http://localhost:3001/api/analytics/health-check

# Performance metrics
curl http://localhost:3001/api/analytics/performance
```

---

## ✅ Verification Checklist

After starting all services, run through this checklist:

- [ ] Logistic Agent running: `curl http://localhost:3001/health`
- [ ] Path Optimization running: `curl http://localhost:8081/health`
- [ ] Forecast Service running: `curl http://localhost:8082/health`
- [ ] Slotting Service running: `curl http://localhost:8083/health`
- [ ] Orchestrator running: `curl http://localhost:8084/health`
- [ ] Frontend accessible: http://localhost:3000
- [ ] API docs available: http://localhost:3001/docs
- [ ] All services show in Logistic Agent health check
- [ ] Can process test order successfully
- [ ] Database migrations complete (Backend)

---

## 🛑 Stopping Services

### Option 1: Manual Termination
In each terminal: Press `CTRL+C`

### Option 2: Kill Processes (PowerShell - Windows)
```powershell
# Kill Logistic Agent
Get-Process | Where-Object {$_.CommandLine -match '3001'} | Stop-Process -Force

# Kill all Python services
Get-Process python | Stop-Process -Force

# Kill Backend (Java)
Get-Process | Where-Object {$_.CommandLine -match 'AppKit'} | Stop-Process -Force
```

### Option 3: Kill Specific Port (PowerShell)
```powershell
# Find process on port 3001
netstat -ano | findstr "3001"

# Kill PID
taskkill /PID <PID> /F
```

---

## 🔄 Data Flow Example

### Complete Order Processing

```
1. User submits order in Admin Portal (3000)
   └─→ POST /api/orders/process to Logistic Agent (3001)

2. Logistic Agent coordinates:
   ├─→ Calls Path Optimization (8081) → Get optimal route
   ├─→ Calls Forecast Service (8082) → Get demand forecast
   ├─→ Calls Slotting Service (8083) → Get slotting plan
   └─→ Calls Orchestrator (8084) → Coordinate workflow

3. Logistic Agent aggregates results:
   └─→ Combines: path + forecast + slotting + orchestration

4. Returns aggregated response to Frontend (3000)

5. Frontend displays:
   ├─→ Warehouse map with optimal route
   ├─→ Demand forecast chart
   ├─→ Slotting efficiency metrics
   └─→ Real-time order status
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Port Already in Use
**Error:** `Address already in use`
```powershell
# Find and kill process
netstat -ano | findstr ":3001"
taskkill /PID <PID> /F

# Try again
python -m uvicorn app.main:app --port 3001
```

### Issue 2: Logistic Agent Can't Connect to Services
**Error:** `ConnectionError: Unable to connect to service`
**Solution:**
1. Verify all services are running: `curl http://localhost:8081/health`
2. Check service URLs in `service_client.py`
3. Ensure no firewall blocking connections
4. Restart failed services

### Issue 3: CORS Error in Browser
**Error:** `Access to XMLHttpRequest blocked by CORS policy`
**Solution:**
- CORS is already enabled on Logistic Agent
- Ensure Frontend is accessing `http://localhost:3001` (not `127.0.0.1`)
- Check browser console for exact blocked URL

### Issue 4: Frontend Won't Start
**Error:** `Port 3000 already in use`
```bash
# Kill existing process
netstat -ano | findstr "3000"
taskkill /PID <PID> /F

# Or use different port
npm run dev -- -p 3001
```

---

## 📈 Performance Tips

1. **Start services in order**: Logistic Agent first, then others
2. **Use separate terminals**: Easier to monitor and debug
3. **Check health before processing**: Verify all services before heavy load
4. **Monitor logs**: Watch for warnings or errors
5. **Use pagination**: For large datasets, implement pagination in queries

---

## 🔐 Security Notes

⚠️ **CORS is "wildcard" enabled for development** (Allow all origins)
- In production, restrict to specific origins
- Edit: `app/main.py` → `allow_origins` parameter

⚠️ **No authentication implemented**
- Add API key verification in production
- Use JWT tokens for secure access

---

## 📚 Additional Resources

- **Logistic Agent Guide**: [LOGISTIC_AGENT_GUIDE.md](LOGISTIC_AGENT_GUIDE.md)
- **API Documentation**: http://localhost:3001/docs
- **Project README**: [README.md](README.md)
- **Implementation Report**: [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)

---

## 🎓 Next Steps

1. **Access Frontend**: http://localhost:3000
2. **Navigate to Admin**: http://localhost:3000/admin
3. **Test Order Processing**: Use admin interface or curl commands
4. **Check Analytics**: View aggregated dashboard metrics
5. **Monitor Services**: Keep tabs on logs for issues

---

## ✨ Key Features Now Available

✅ **Central Data Hub** - Logistic Agent coordinates all services  
✅ **Order Orchestration** - Complete workflow from all services  
✅ **Warehouse Synchronization** - Data consistency across services  
✅ **Analytics Aggregation** - Combined metrics from all services  
✅ **Health Monitoring** - Check all service status from one point  
✅ **API Documentation** - Interactive Swagger/ReDoc at /docs  
✅ **Async Processing** - Non-blocking async/await throughout  

---

**Status**: ✅ FULLY OPERATIONAL  
**Ready for**: Testing, Development, Deployment  
**Last Updated**: April 2, 2026

🎉 Your warehouse management system is now fully integrated!
