# 🎯 COMPLETE OPTIWMS SYSTEM - ALL LINKS & WORKFLOWS

## 🌐 MAIN APPLICATION ENTRY POINT
**Start Here:** http://localhost:3006

---

## 📊 DASHBOARD & MANAGEMENT LINKS

| Feature | URL | Description |
|---------|-----|-------------|
| **Main Dashboard** | http://localhost:3006 | Home page with KPIs |
| **Warehouse Admin** | http://localhost:3006/admin/warehouses | View/manage warehouse layout |
| **Warehouse Layout** | http://localhost:3006/admin/warehouses | All 72 racks visualization |
| **Orders Management** | http://localhost:3006/admin/tasks | Create/view/manage orders |
| **Workers** | http://localhost:3006/admin/workers | Manage warehouse workers |
| **Returns** | http://localhost:3006/admin/returns | Handle product returns |

---

## 🚀 PATHFINDING & PICKING WORKFLOW

### Step 1: CREATE ORDER
**URL:** http://localhost:3006/admin/tasks
- Create new order
- Add items and locations
- Copy ORDER_ID

### Step 2: GENERATE PICKING ROUTE (WITH ALL 72 RACKS)
**URL:** http://localhost:3006/pathfinding?orderId=ORDER_ID
- Shows all 72 warehouse racks
- ENTRY point at warehouse entrance
- Interactive visualization
- Generate optimal route
- Confirm route

### Step 3: EXECUTE PICKING
**URL:** http://localhost:3006/picking?orderId=ORDER_ID
- Step-by-step picking instructions
- Track picked items
- Confirm completion
- Generate picking report

---

## 🔧 BACKEND & API LINKS

### MAIN BACKEND API
| Resource | URL | Status |
|----------|-----|--------|
| **Backend Server** | http://localhost:8080 | ✅ Running |
| **Health Check** | http://localhost:8080/actuator/health | ✅ UP |
| **System Info** | http://localhost:8080/actuator/info | ℹ️ System details |

### API DOCUMENTATION
| Resource | URL | Description |
|----------|-----|-------------|
| **Swagger UI** | http://localhost:8080/swagger-ui.html | API documentation |
| **OpenAPI JSON** | http://localhost:8080/v3/api-docs | OpenAPI spec |

### WAREHOUSE API ENDPOINTS
| Endpoint | URL | Method | Purpose |
|----------|-----|--------|---------|
| **Get Warehouse Graph** | http://localhost:8080/api/pathfinding/warehouse/graph | GET | Fetch all 72 racks + edges |
| **Find Path** | http://localhost:8080/api/pathfinding/find-path | POST | Calculate optimal route |
| **Storage Locations** | http://localhost:8080/api/admin/locations | GET | Get all rack locations |

---

## 🤖 AI MICROSERVICES

### LOGISTIC AGENT (Central Hub)
| Resource | URL | Status |
|----------|-----|--------|
| **Logistic Agent** | http://localhost:3001 | ✅ Running |
| **Health Check** | http://localhost:3001/health | ✅ Healthy |
| **API Docs** | http://localhost:3001/docs | 📖 Available |

### AI SERVICE ENDPOINTS
| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **Forecast Service** | 8082 | http://localhost:8082 | Demand forecasting |
| **Path Optimization** | 8081 | http://localhost:8081 | Route optimization |
| **Slotting Service** | 8083 | http://localhost:8083 | Optimal bin placement |
| **Orchestrator** | 8084 | http://localhost:8084 | Service coordination |

### LOGISTIC AGENT API ROUTES
| Endpoint | URL | Purpose |
|----------|-----|---------|
| **Orders** | http://localhost:3001/api/orders | Order processing |
| **Warehouse** | http://localhost:3001/api/warehouse | Warehouse operations |
| **Analytics** | http://localhost:3001/api/analytics | Dashboard metrics |
| **Sync** | http://localhost:3001/api/sync | Data synchronization |

---

## 💾 DATABASE & INFRASTRUCTURE

| Service | Connection | Status |
|---------|-----------|--------|
| **PostgreSQL** | localhost:5434 | ✅ Connected |
| **Database** | optiwms | ✅ Ready |
| **User** | optiwms_user | ✅ Active |

---

## 📋 COMPLETE PICKING WORKFLOW EXAMPLE

### 1. CREATE ORDER (GET ORDER_ID)
```bash
Visit: http://localhost:3006/admin/tasks
Create order with items:
- Item 1: Location A-01-01-1-A, Qty: 2
- Item 2: Location B-05-02-1-B, Qty: 1
Copy your ORDER_ID from response
```

### 2. OPTIMIZE ROUTE (SEE ALL 72 RACKS)
```bash
Visit: http://localhost:3006/pathfinding?orderId=YOUR_ORDER_ID
- See complete warehouse with all 72 racks
- ENTRY point: warehouse entrance
- Route: ENTRY → A-01-01-1-A → B-05-02-1-B → EXIT
- Confirm route
```

### 3. EXECUTE PICKING
```bash
Visit: http://localhost:3006/picking?orderId=YOUR_ORDER_ID
- Go to A-01-01-1-A
- Pick 2 units
- Go to B-05-02-1-B
- Pick 1 unit
- Proceed to exit
- Complete order
```

---

## 🔌 SERVICE HEALTH CHECKS

### Quick Test Commands
```powershell
# Backend
curl http://localhost:8080/actuator/health

# Logistic Agent
curl http://localhost:3001/health

# Warehouse Graph (All 72 Racks)
curl http://localhost:8080/api/pathfinding/warehouse/graph

# Frontend
curl http://localhost:3006
```

---

## 📱 USER INTERFACE PATHS

### Admin Routes
| Page | URL | Features |
|------|-----|----------|
| Warehouse Admin | http://localhost:3006/admin/warehouses | Layout, racks, slotting |
| Orders/Tasks | http://localhost:3006/admin/tasks | Create, view, manage orders |
| Workers | http://localhost:3006/admin/workers | Manage picking staff |
| Returns | http://localhost:3006/admin/returns | Handle returns |
| Orders List | http://localhost:3006/orders | All orders view |
| Inventory | http://localhost:3006/inventory | Stock levels |
| Shipments | http://localhost:3006/shipments | Shipment tracking |

### Operational Routes
| Page | URL | Purpose |
|------|-----|---------|
| Pathfinding | http://localhost:3006/pathfinding | Calculate routes |
| Picking | http://localhost:3006/picking | Execute picking |
| Dashboard | http://localhost:3006 | Main dashboard |

---

## 🚨 CRITICAL PARAMETERS

### Pathfinding Query Parameters
```
?orderId=ORDER_ID&customerId=CUSTOMER_ID
```

### Picking Query Parameters
```
?orderId=ORDER_ID&customerId=CUSTOMER_ID
```

---

## 📊 WAREHOUSE LAYOUT DETAILS

### Rack Structure
```
Total Area: 72 unique racks
Format: AREA-ROW-BAY-LEVEL-POSITION
Example: A-01-01-1-A means:
  - Area: A
  - Row: 01
  - Bay: 01
  - Level: 1
  - Position: A
```

### Node Types in Visualization
- 🟡 **ENTRY** - Warehouse entrance (starting point)
- 🟢 **Racks** - 72 storage racks (picking targets)
- 🔴 **EXIT** - Warehouse exit (ending point)
- 🔵 **Path** - Optimal picking route (cyan colored)

---

## ✅ COMPLETE SYSTEM CHECKLIST

- ✅ Backend (8080) - Running
- ✅ Frontend (3006) - Running
- ✅ Logistic Agent (3001) - Running
- ✅ Forecast Service (8082) - Connected
- ✅ Path Optimization (8081) - Connected
- ✅ Slotting Service (8083) - Connected
- ✅ Orchestrator (8084) - Connected
- ✅ PostgreSQL - Connected
- ✅ All 72 Warehouse Racks - Loaded
- ✅ Pathfinding Routes - Working
- ✅ Picking Interface - Ready
- ✅ APIs - Responding
- ✅ Visualization - Interactive

---

## 🎯 QUICK START CHECKLIST

1. ✅ **Open Dashboard:** http://localhost:3006
2. ✅ **View Warehouse:** http://localhost:3006/admin/warehouses
3. ✅ **Create Order:** http://localhost:3006/admin/tasks
4. ✅ **Get ORDER_ID** (e.g., `12345`)
5. ✅ **Generate Route:** http://localhost:3006/pathfinding?orderId=12345
6. ✅ **See All 72 Racks** - Visual confirmation
7. ✅ **Confirm Route** - Button on page
8. ✅ **Execute Picking:** http://localhost:3006/picking?orderId=12345
9. ✅ **Complete Order** - Follow picking instructions

---

## 🎉 SYSTEM STATUS

**All services operational and fully integrated!**

**Start your warehouse operations:** http://localhost:3006

