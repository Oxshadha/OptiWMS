# 📱 OPTIWMS - COMPLETE ACCESS GUIDE & ALL LINKS

## 🎯 START HERE

### ⭐ MAIN FEATURES
```
Dashboard:     http://localhost:3000
Pathfinding:   http://localhost:3000/pathfinding
API Docs:      http://localhost:8080/api-docs
```

---

## 🌐 COMPLETE LINK DIRECTORY

### 🏠 MAIN ENTRY POINTS

| Link | Purpose | Port |
|------|---------|------|
| **http://localhost:3000** | Main Dashboard | 3000 |
| **http://localhost:3000/pathfinding** | Warehouse Visualization & Pathfinding | 3000 |
| **http://localhost:8080/api-docs** | Backend API Documentation | 8080 |

---

## 📊 DASHBOARD PAGES

### Overview & Management
| Page | URL | Description |
|------|-----|-------------|
| Dashboard | http://localhost:3000/admin/dashboard | Main overview and KPIs |
| Warehouses | http://localhost:3000/admin/warehouses | Warehouse layout and management |
| Visualization | http://localhost:3000/pathfinding | **Pathfinding & Layout** ⭐ |

### Operations
| Page | URL | Description |
|------|-----|-------------|
| Orders | http://localhost:3000/admin/orders | All orders |
| Inbound Orders | http://localhost:3000/admin/orders/inbound | Incoming orders |
| Outbound Orders | http://localhost:3000/admin/orders/outbound | Outgoing orders |
| Shipments | http://localhost:3000/admin/shipments | Shipment tracking |
| Packing | http://localhost:3000/admin/packing | Packing operations |

### Inventory & Stock
| Page | URL | Description |
|------|-----|-------------|
| Inventory | http://localhost:3000/admin/inventory | Stock levels |
| Products | http://localhost:3000/admin/materials | Product catalog |
| Stock Transfers | http://localhost:3000/admin/stock-transfers | Stock movement |
| Cycle Counts | http://localhost:3000/admin/cycle-counts | Inventory counts |
| Raw Materials | http://localhost:3000/admin/raw-materials | Raw materials management |

### Planning & Forecasting
| Page | URL | Description |
|------|-----|-------------|
| Forecasts | http://localhost:3000/admin/forecasts | Demand forecasting |
| Supply Plans | http://localhost:3000/admin/supply-plans | Supply planning |
| Tasks | http://localhost:3000/admin/tasks | Operational tasks |

### Administration
| Page | URL | Description |
|------|-----|-------------|
| Settings | http://localhost:3000/admin/settings | System settings |
| Workers | http://localhost:3000/admin/workers | Worker management |
| Labor Productivity | http://localhost:3000/admin/labor-productivity | Labor analytics |
| Delivery Partners | http://localhost:3000/admin/delivery-partners | Partner management |
| Suppliers | http://localhost:3000/admin/suppliers | Supplier directory |
| Customers | http://localhost:3000/admin/customers | Customer data |
| Reports | http://localhost:3000/admin/reports | Export reports |
| Help | http://localhost:3000/admin/help | System help |

---

## 🔌 BACKEND API ENDPOINTS

### API Documentation & Health
| Endpoint | URL | Purpose |
|----------|-----|---------|
| Swagger UI | http://localhost:8080/api-docs | API Documentation |
| Health Check | http://localhost:8080/api/health | Backend status |
| API Base | http://localhost:8080/api | Base API URL |

### API Collections (Swagger Documented)
- **Warehouse API** - Warehouse operations and layout
- **Orders API** - Order management
- **Inventory API** - Stock management
- **Location API** - Location/bin operations
- **Analytics API** - Metrics and reporting
- **AI Services API** - Pathfinding and optimization

---

## 🤖 AI MICROSERVICES ENDPOINTS

### Service Health Checks
| Service | Port | Health Endpoint |
|---------|------|-----------------|
| Path Optimization | 8081 | http://localhost:8081/health |
| Forecast Service | 8082 | http://localhost:8082/health |
| Slotting Service | 8083 | http://localhost:8083/api/slotting/health |
| Orchestrator | 8084 | http://localhost:8084/health |

### Service APIs
| Service | Port | Main Endpoint |
|---------|------|--------------|
| Path Optimization | 8081 | http://localhost:8081/api/pathfinding |
| Forecast Service | 8082 | http://localhost:8082/api/forecast |
| Slotting Service | 8083 | http://localhost:8083/api/slotting/recommendations |
| Orchestrator | 8084 | http://localhost:8084/api/orchestrate |

---

## 💾 DATABASE ACCESS

### Connection Information
```
Host:       localhost
Port:       5434
Database:   optiwms
User:       optiwms
Password:   optiwms
```

### Connection Commands
```bash
# Connect to database
psql -U optiwms -h localhost -p 5434 optiwms

# Connection string for tools
postgresql://optiwms:optiwms@localhost:5434/optiwms
```

---

## 🔐 LOGIN CREDENTIALS

### Default Admin Account
```
Email:    admin@optiwms.com
Password: admin123
```

### Access Features
- ✅ Full system access
- ✅ All warehouse operations
- ✅ User management
- ✅ Settings configuration
- ✅ Report generation

---

## 📋 QUICK REFERENCE TABLE

### All Ports & Services
```
┌─────────────────────────────────────────────────────┐
│ Port  │ Service           │ URL                     │
├─────────────────────────────────────────────────────┤
│ 3000  │ Frontend          │ http://localhost:3000   │
│ 8080  │ Backend API       │ http://localhost:8080   │
│ 8081  │ Path Optimization │ http://localhost:8081   │
│ 8082  │ Forecast          │ http://localhost:8082   │
│ 8083  │ Slotting          │ http://localhost:8083   │
│ 8084  │ Orchestrator      │ http://localhost:8084   │
│ 5434  │ Database          │ localhost:5434          │
└─────────────────────────────────────────────────────┘
```

---

## 🎮 FEATURE-SPECIFIC LINKS

### 🏭 Warehouse Management
```
Warehouse List:     http://localhost:3000/admin/warehouses
Visualization:      http://localhost:3000/pathfinding
Rack Details:       http://localhost:3000/admin/warehouses#racklist
Location Editor:    http://localhost:3000/admin/warehouses#locations
```

### 📦 Order Management
```
All Orders:         http://localhost:3000/admin/orders
Inbound:            http://localhost:3000/admin/orders/inbound
Outbound:           http://localhost:3000/admin/orders/outbound
Picking:            http://localhost:3000/picking
```

### 🛣️ Pathfinding & Optimization
```
Pathfinding UI:     http://localhost:3000/pathfinding
Path API:           http://localhost:8081/api/pathfinding
Find Path Endpoint: POST http://localhost:8080/api/pathfinding/find
```

### 📊 Analytics & Reporting
```
Dashboard:          http://localhost:3000/admin/dashboard
Forecasts:          http://localhost:3000/admin/forecasts
Labor Productivity: http://localhost:3000/admin/labor-productivity
Export Reports:     http://localhost:3000/admin/reports
```

### 🤖 AI Services
```
Slotting:           http://localhost:8083/api/slotting/recommendations
Forecasting:        http://localhost:8082/api/forecast
Path Optimization:  http://localhost:8081/api/pathfinding
Orchestration:      http://localhost:8084/api/orchestrate
```

---

## 🚀 COMMON WORKFLOWS

### Workflow 1: View Warehouse & Plan Picking Route
```
1. Go to: http://localhost:3000
2. Login with: admin@optiwms.com / admin123
3. Click: Warehouses → Visualization & Pathfinding
4. View: Interactive warehouse layout
5. Select: Start and End locations
6. Click: Find Optimal Path
7. Result: View optimized picking route
```

### Workflow 2: Check Orders & Plan Shipments
```
1. Dashboard: http://localhost:3000/admin/dashboard
2. Orders: http://localhost:3000/admin/orders
3. Select Order: Click on order ID
4. Plan: Create picking tasks
5. Ship: http://localhost:3000/admin/shipments
6. Deliver: Assign delivery partner
```

### Workflow 3: Check Inventory Levels
```
1. Inventory: http://localhost:3000/admin/inventory
2. View: Current stock levels
3. Forecast: http://localhost:3000/admin/forecasts
4. Plan: Based on demand prediction
5. Reorder: http://localhost:3000/admin/supply-plans
```

### Workflow 4: Monitor Performance
```
1. Dashboard: http://localhost:3000/admin/dashboard
2. Analytics: View KPIs
3. Labor: http://localhost:3000/admin/labor-productivity
4. Reports: http://localhost:3000/admin/reports
5. Export: Download data
```

---

## ✅ WHAT'S AVAILABLE

| Feature | Status | Link |
|---------|--------|------|
| Dashboard | ✅ Active | http://localhost:3000 |
| Warehouse Visualization | ✅ Active | http://localhost:3000/pathfinding |
| Pathfinding | ✅ Active | http://localhost:3000/pathfinding |
| Order Management | ✅ Active | http://localhost:3000/admin/orders |
| Inventory | ✅ Active | http://localhost:3000/admin/inventory |
| Forecasting | ✅ Active | http://localhost:3000/admin/forecasts |
| API Documentation | ✅ Active | http://localhost:8080/api-docs |
| Database | ✅ Active | localhost:5434 |
| AI Services | ✅ Active | Ports 8081-8084 |

---

## 🔧 SYSTEM STATUS CHECKS

### Check All Services Running
```bash
# Frontend
curl http://localhost:3000

# Backend
curl http://localhost:8080/api-docs

# Database
psql -U optiwms -h localhost -p 5434 optiwms

# AI Services
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/api/slotting/health
curl http://localhost:8084/health
```

---

## 📱 MOBILE ACCESS

### Mobile Dashboard
```
Same URLs work on mobile:
- http://localhost:3000 (from mobile on same network)
- Replace 'localhost' with your machine's IP address
- Example: http://192.168.x.x:3000
```

---

## 🎓 DOCUMENTATION REFERENCES

All comprehensive documentation available in project root:
- `WAREHOUSE_VISUALIZATION_GUIDE.md` - Pathfinding features
- `COMPLETE_SYSTEM_STATUS.md` - Full system overview
- `SYSTEM_FULLY_OPERATIONAL.md` - Features & connections
- `QUICK_START_ALL_FIXED.md` - Quick reference

---

## 🚨 TROUBLESHOOTING LINKS

### If Page Won't Load
```
1. Check: http://localhost:3000 loads?
2. Check API: http://localhost:8080/api-docs accessible?
3. Check DB: psql connection working?
4. Refresh: Ctrl+F5 (hard refresh)
5. Clear: Browser cache Ctrl+Shift+Delete
```

### If Pathfinding Shows Error
```
1. Verify: http://localhost:8080/api-docs loads
2. Check: Backend health endpoint
3. Reload: Page refresh
4. Check: Browser console for errors
```

---

## 📞 SUPPORT

**All services running on:**
- Frontend: **http://localhost:3000**
- Backend: **http://localhost:8080**
- Database: **localhost:5434**
- AI Services: **localhost:8081-8084**

**If issues occur:**
1. Check service status
2. Verify database connection
3. Check browser console (F12)
4. Review service logs
5. Hard refresh (Ctrl+F5)

---

## 🎯 IMPORTANT LINKS (BOOKMARKS RECOMMENDED)

🌟 **MAIN DASHBOARD:** http://localhost:3000
🌟 **PATHFINDING:** http://localhost:3000/pathfinding
🌟 **API DOCS:** http://localhost:8080/api-docs
🌟 **DATABASE:** localhost:5434

---

**Last Updated:** April 7, 2026
**All Systems Operational:** ✅ YES
**Ready to Use:** ✅ YES
