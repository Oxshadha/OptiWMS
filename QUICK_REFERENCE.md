# ⚡ Quick Reference Commands

**Use this file for quick copy-paste commands to run the system**

---

## 🚀 Start Everything (Use Separate Terminals)

### Terminal 1: Logistic Agent (Central Hub) - START FIRST
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\logistic-agent"
python -m uvicorn app.main:app --reload --port 3001
```

### Terminal 2: Path Optimization Service
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\path-optimization-service"
python -m uvicorn app.main:app --reload --port 8081
```

### Terminal 3: Forecast Service
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\forecast-service"
python -m uvicorn app.main:app --reload --port 8082
```

### Terminal 4: Slotting Service
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\slotting-service"
python -m uvicorn app.main:app --reload --port 8083
```

### Terminal 5: Orchestrator Service
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\orchestrator-service"
python -m uvicorn app.main:app --reload --port 8084
```

### Terminal 6: Frontend
```powershell
cd "C:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\frontend"
npm run dev
```

---

## 🧪 Test Commands (Copy & Paste)

### Test 1: Health Check Logistic Agent
```bash
curl http://localhost:3001/health
```

### Test 2: Process Complete Order
```bash
curl -X POST http://localhost:3001/api/orders/process ^
  -H "Content-Type: application/json" ^
  -d "{\"order_id\":\"order-001\",\"customer_id\":\"customer-1\",\"items\":[{\"sku\":\"SKU-001\",\"qty\":2}],\"warehouse_id\":\"default\"}"
```

### Test 3: Get Warehouse Layout
```bash
curl http://localhost:3001/api/warehouse/layout
```

### Test 4: Get Dashboard Metrics
```bash
curl http://localhost:3001/api/analytics/dashboard
```

### Test 5: Check All Services Health
```bash
curl http://localhost:3001/api/analytics/health-check
```

### Test 6: Sync Warehouse Data
```bash
curl -X POST http://localhost:3001/api/sync/warehouse-to-all ^
  -H "Content-Type: application/json" ^
  -d "{\"warehouse_id\":\"default\"}"
```

---

## 🌐 Quick Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |
| **Logistic Agent** | http://localhost:3001 |
| Logistic API Docs | http://localhost:3001/docs |
| Path Optimization API | http://localhost:8081/docs |
| Forecast API Docs | http://localhost:8082/docs |
| Slotting API Docs | http://localhost:8083/docs |
| Orchestrator API Docs | http://localhost:8084/docs |

---

## 🛑 Stop Services

### Kill Port 3001 (Logistic Agent)
```powershell
netstat -ano | findstr "3001"
taskkill /PID <PID> /F
```

### Kill All Python Services
```powershell
Get-Process python | Stop-Process -Force
```

### Kill Specific Port (Replace 3001 with any port)
```powershell
netstat -ano | findstr ":3001"
taskkill /PID <PID> /F
```

---

## 📝 Configuration Checklist

- [x] Logistic Agent running on 3001
- [x] Path Optimization running on 8081
- [x] Forecast Service running on 8082
- [x] Slotting Service running on 8083
- [x] Orchestrator running on 8084
- [x] Frontend running on 3000
- [x] All services connected
- [x] CORS enabled
- [x] API documentation available

---

## 🔍 Monitor Service Status

```bash
# Check all services at once
curl -s http://localhost:3001/api/analytics/health-check | python -m json.tool
```

---

## 📊 Common Payloads

### Order Processing Payload
```json
{
  "order_id": "order-005",
  "customer_id": "customer-1",
  "items": [
    {"sku": "SKU-001", "qty": 2},
    {"sku": "SKU-002", "qty": 1},
    {"sku": "SKU-003", "qty": 3}
  ],
  "warehouse_id": "default"
}
```

### Warehouse Sync Payload
```json
{
  "warehouse_id": "default",
  "nodes": [
    {"id": "ENTRY", "x": 0, "y": 0},
    {"id": "A1", "x": 5, "y": 5},
    {"id": "B2", "x": 10, "y": 5},
    {"id": "EXIT", "x": 20, "y": 10}
  ],
  "edges": [
    {"from": "ENTRY", "to": "A1", "distance": 7.07},
    {"from": "A1", "to": "B2", "distance": 5},
    {"from": "B2", "to": "EXIT", "distance": 11.18}
  ]
}
```

---

## 🎯 Typical Workflow

1. **Start Services** (in this order):
   ```
   Terminal 1: Logistic Agent (3001)
   Terminal 2: Path Optimization (8081)
   Terminal 3: Forecast (8082)
   Terminal 4: Slotting (8083)
   Terminal 5: Orchestrator (8084)
   Terminal 6: Frontend (3000)
   ```

2. **Verify Health**:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/analytics/health-check
   ```

3. **Access Frontend**:
   ```
   Open: http://localhost:3000
   Navigate to: Admin > Warehouses
   ```

4. **Process Order**:
   ```bash
   curl -X POST http://localhost:3001/api/orders/process \
     -H "Content-Type: application/json" \
     -d '{"order_id":"order-1","customer_id":"customer-1","items":[{"sku":"SKU-001","qty":2}],"warehouse_id":"default"}'
   ```

5. **View Results** in Frontend Dashboard

---

## 💡 Tips

- **Error with port?** Kill process: `taskkill /PID <number> /F`
- **Want to see logs?** Keep terminal visible
- **API not responding?** Check health endpoint first
- **Need documentation?** Visit `/docs` on any service
- **Stuck?** Check logs in terminal where service runs

---

## 📞 Service Endpoints Matrix

| Endpoint | Service | Port | Method |
|----------|---------|------|--------|
| `/health` | All | Various | GET |
| `/docs` | All | Various | GET |
| `/api/orders/process` | Logistic Agent | 3001 | POST |
| `/api/warehouse/layout` | Logistic Agent | 3001 | GET |
| `/api/analytics/dashboard` | Logistic Agent | 3001 | GET |
| `/api/sync/warehouse-to-all` | Logistic Agent | 3001 | POST |

---

**Save this file for quick reference!** ⭐
