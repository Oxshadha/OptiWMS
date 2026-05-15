# 🎯 Logistic Agent - Central Data Hub
**Status**: ✅ Running on localhost:3001  
**Purpose**: Central coordinator connecting all warehouse microservices  
**Version**: 1.0.0

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOGISTIC AGENT (3001)                       │
│                    Central Data Coordinator                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Routes & Endpoints                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • Orders API      - Process & aggregate order data       │  │
│  │ • Warehouse API   - Manage warehouse layout & info       │  │
│  │ • Analytics API   - Dashboard metrics & performance      │  │
│  │ • Sync API        - Data synchronization across services │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ↓              ↓              ↓              ↓
    ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐
    │ Path    │  │ Forecast │  │Slotting │  │ Orchestrator │
    │ Optim.  │  │ Service  │  │ Service │  │  Service     │
    │(8081)   │  │  (8082)  │  │ (8083)  │  │   (8084)     │
    └─────────┘  └──────────┘  └─────────┘  └──────────────┘
```

---

## 📋 API Endpoints

### Orders API (`/api/orders`)
**Purpose**: Coordinate complete order processing workflow

#### `POST /api/orders/process`
Process complete order with all services
```json
{
  "order_id": "order-5",
  "customer_id": "customer-1",
  "items": [{"sku": "SKU-001", "qty": 2}],
  "warehouse_id": "default"
}
```

**Response**: Combined results from all services
```json
{
  "order_id": "order-5",
  "path": {...pathfinding results...},
  "forecast": {...forecast data...},
  "slotting": {...slotting plan...},
  "status": "processed"
}
```

#### `GET /api/orders/aggregate?order_id=order-5`
Aggregate all order data from all services

---

### Warehouse API (`/api/warehouse`)
**Purpose**: Manage warehouse data and layout

#### `GET /api/warehouse/layout`
Get warehouse layout

#### `GET /api/warehouse/info`
Get comprehensive warehouse information

#### `POST /api/warehouse/sync`
Sync warehouse data across all services

---

### Analytics API (`/api/analytics`)
**Purpose**: Aggregate and analyze operational data

#### `GET /api/analytics/dashboard`
Get dashboard metrics from all services

#### `GET /api/analytics/performance`
Get performance metrics

#### `GET /api/analytics/health-check`
Check health of all connected services

---

### Sync API (`/api/sync`)
**Purpose**: Synchronize data between services

#### `POST /api/sync/data`
Sync data between specific services

#### `POST /api/sync/warehouse-to-all`
Broadcast warehouse data to all services

#### `POST /api/sync/orders-to-all`
Broadcast orders data to all services

---

## 🔄 Data Flow

### Complete Order Processing Flow

```
1. Frontend (3000) sends order to Logistic Agent (3001)
        ↓
2. Logistic Agent aggregates data:
        ├─→ Path Optimization (8081) → Get optimal route
        ├─→ Forecast Service (8082) → Get demand forecast
        ├─→ Slotting Service (8083) → Get slotting plan
        └─→ Orchestrator (8084) → Coordinate workflow
        ↓
3. Logistic Agent combines all results
        ↓
4. Returns integrated result to Frontend
        ↓
5. Frontend displays route + forecast + slotting plan
```

---

## 🚀 Running the Services

### Option 1: Individual Commands

**Terminal 1 - Logistic Agent** (Must start first)
```bash
cd ai-services/logistic-agent
python -m uvicorn app.main:app --reload --port 3001
```

**Terminal 2 - Path Optimization**
```bash
cd ai-services/path-optimization-service
python -m uvicorn app.main:app --reload --port 8081
```

**Terminal 3 - Forecast Service**
```bash
cd ai-services/forecast-service
python -m uvicorn app.main:app --reload --port 8082
```

**Terminal 4 - Slotting Service**
```bash
cd ai-services/slotting-service
python -m uvicorn app.main:app --reload --port 8083
```

**Terminal 5 - Orchestrator Service**
```bash
cd ai-services/orchestrator-service
python -m uvicorn app.main:app --reload --port 8084
```

**Terminal 6 - Frontend**
```bash
cd frontend
npm run dev
```

### Option 2: Batch Files (Windows)

```bash
START_LOGISTIC_AGENT.bat
START_PATH_OPTIMIZATION.bat        # (if exists)
START_FORECAST_SERVICE.bat
START_SLOTTING_SERVICE.bat
START_ORCHESTRATOR_SERVICE.bat
START_FRONTEND.bat                 # (in frontend folder)
```

---

## 🔌 Service Connections

### Logistic Agent connects to:

| Service | Port | Purpose |
|---------|------|---------|
| Path Optimization | 8081 | Get optimal picking routes |
| Forecast | 8082 | Get demand forecasts |
| Slotting | 8083 | Get warehouse slotting plans |
| Orchestrator | 8084 | Coordinate workflows |

### Connection Status Check

Test connection at: **http://localhost:3001/health**

Expected response:
```json
{
  "status": "healthy",
  "service": "logistic-agent",
  "connected_services": {
    "path_optimization": "http://localhost:8081",
    "forecast": "http://localhost:8082",
    "slotting": "http://localhost:8083",
    "orchestrator": "http://localhost:8084"
  }
}
```

---

## 📡 Integration Points

### Frontend Integration
```typescript
// Before (direct to single service)
const response = await fetch('http://localhost:8081/api/pathfinding/optimize');

// After (through logistic agent)
const response = await fetch('http://localhost:3001/api/orders/process', {
  method: 'POST',
  body: JSON.stringify({
    order_id: orderId,
    customer_id: customerId,
    items: items,
    warehouse_id: 'default'
  })
});
```

### Service Integration
Each microservice can:
1. **Receive data** from Logistic Agent via sync endpoints
2. **Process data** independently
3. **Return results** to Logistic Agent
4. **Coordinate** with other services through orchestrator

---

## 🎯 Workflow Examples

### Example 1: Process Single Order
```bash
curl -X POST http://localhost:3001/api/orders/process \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-5",
    "customer_id": "customer-1",
    "items": [{"sku": "SKU-001", "qty": 2}],
    "warehouse_id": "default"
  }'
```

### Example 2: Get Warehouse Layout
```bash
curl http://localhost:3001/api/warehouse/layout
```

### Example 3: Check Service Health
```bash
curl http://localhost:3001/api/analytics/health-check
```

### Example 4: Sync Warehouse Data
```bash
curl -X POST http://localhost:3001/api/sync/warehouse-to-all \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id": "default", "nodes": [...], "edges": [...]}'
```

---

## 📊 Service Matrix

### Data Provided by Each Service

| Service | Data Provided |
|---------|---------------|
| **Path Optimization** | Route paths, distances, steps |
| **Forecast** | Demand predictions, trends |
| **Slotting** | Bin assignments, efficiency scores |
| **Orchestrator** | Workflow coordination, status |

### Data Consumed by Each Service

| Service | Consumes |
|---------|----------|
| **Path Optimization** | Warehouse layout, obstacles |
| **Forecast** | Historical orders, demand |
| **Slotting** | Inventory data, warehouse layout |
| **Orchestrator** | Results from all services |

---

## 🔄 Synchronization Strategy

### Real-time Sync
```
Warehouse Layout Changes
  ↓
Logistic Agent broadcasts
  ↓
All services update internally
```

### Batch Sync
```
Order Processing
  ↓
Collect results from all services
  ↓
Combine and return to frontend
```

---

## ✅ Verification Checklist

- [x] Logistic Agent running on port 3001
- [x] Path Optimization connected on 8081
- [x] Forecast Service connected on 8082
- [x] Slotting Service connected on 8083
- [x] Orchestrator Service connected on 8084
- [x] All API endpoints available
- [x] Health checks passing
- [x] CORS enabled for cross-service communication

---

## 🛠️ Configuration

### Service URLs (Hardcoded in logistic-agent)
```python
self.services = {
    "pathfinding": "http://localhost:8081",
    "forecast": "http://localhost:8082",
    "slotting": "http://localhost:8083",
    "orchestrator": "http://localhost:8084"
}
```

To change ports, edit: `app/services/service_client.py`

### Timeout
Default: 30 seconds  
Configure in: `app/services/service_client.py` → `__init__` → `self.timeout`

---

## 🚨 Troubleshooting

### Logistic Agent won't start
```bash
# Clear port
netstat -ano | findstr "3001"
taskkill /PID <PID> /F

# Try again
python -m uvicorn app.main:app --port 3001
```

### Service connection fails
```bash
# Check service is running
curl http://localhost:8081/health
curl http://localhost:8082/
curl http://localhost:8083/
curl http://localhost:8084/
```

### CORS errors
- Ensure Logistic Agent has CORS enabled (already configured)
- Check frontend is accessing correct port (3001)

---

## 📈 Performance Notes

- Logistic Agent acts as a proxy, adding ~10-50ms latency
- Parallel requests to multiple services reduce total time
- Caching can improve performance for repeated requests

---

## 🔮 Future Enhancements

1. **Caching Layer** - Cache frequently accessed data
2. **Message Queue** - Use Redis/RabbitMQ for async processing
3. **Database Integration** - Store results for analytics
4. **WebSocket Support** - Real-time updates to frontend
5. **Load Balancing** - Distribute requests across service instances
6. **Service Discovery** - Auto-detect available services
7. **Retry Logic** - Automatic retry on service failures
8. **Analytics Dashboard** - Detailed operational metrics

---

## 📞 API Documentation

**Live API Docs**: http://localhost:3001/docs  
**ReDoc**: http://localhost:3001/redoc

---

**Status**: ✅ FULLY OPERATIONAL  
**Last Updated**: April 2, 2026  
**Version**: 1.0.0
