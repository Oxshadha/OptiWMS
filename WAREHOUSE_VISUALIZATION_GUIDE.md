# 🎯 WAREHOUSE VISUALIZATION & PATHFINDING - COMPLETE GUIDE

## ✨ NEW FEATURE: Interactive Warehouse Visualization

Your OptiWMS now has a **complete warehouse visualization system** with interactive pathfinding! This is the original layout you requested, fully connected to the system.

---

## 🚀 HOW TO ACCESS

### Option 1: From Navigation Menu
1. Open **http://localhost:3000**
2. Click **"Warehouses"** in the left sidebar
3. Select **"Visualization & Pathfinding"**

### Option 2: Direct URL
👉 **http://localhost:3000/pathfinding**

---

## 📊 WHAT YOU'LL SEE

### Warehouse Layout View
```
┌─────────────────────────────────────────────┐
│  Warehouse Visualization                    │
│  Interactive pathfinding visualization      │
├─────────────────────────────────────────────┤
│                                             │
│    ENTRY (Green)                            │
│       ↓                                      │
│    A1 → A2 → A3  (Orange racks)            │
│    ↓              ↓                         │
│    B1 → B2 → B3 (Orange racks)            │
│       ↑                                      │
│    EXIT (Red)                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Color Legend
- 🟢 **Green (Entry)** - Warehouse entrance/starting point
- 🔴 **Red (Exit)** - Warehouse exit/drop-off point
- 🟠 **Orange (Racks)** - Storage racks with products
- 🔵 **Cyan (Path)** - Optimized picking route
- ⚫ **Purple (Blocked)** - Unavailable/blocked areas
- 🟡 **Yellow (Start)** - Starting location for current path
- 🩷 **Pink (End)** - End location for current path

---

## 🎮 INTERACTIVE FEATURES

### Path Visualization
The visualization shows:
1. **Warehouse Layout** - All racks, entry, exit positioned accurately
2. **Dynamic Pathfinding** - Real-time path calculation between locations
3. **Cost Calculation** - Shows distance/cost of selected route
4. **Node Details** - Hover over nodes to see location information

### Control Panel
The control panel allows you to:
- 📍 **Select Start Location** - Choose entry point
- 📍 **Select End Location** - Choose destination
- ⚙️ **Set Constraints** - Avoid certain areas
- 🔍 **Find Optimal Path** - Calculate best route
- 📊 **View Results** - See path details and cost

### Zoom & Pan
- 🔍 **Zoom In/Out** - Use zoom buttons to adjust view
- ✋ **Pan** - Click and drag to move around warehouse
- 🔄 **Reset View** - Return to default zoom/pan

---

## 🛣️ PATH OPTIMIZATION ALGORITHMS

The system uses **A* pathfinding** with these features:

### Algorithm Details
- **Heuristic:** Euclidean distance
- **Cost Calculation:** Manhattan distance + elevation cost
- **Optimization:** Minimizes walking distance
- **Constraints:** Respects blocked/unavailable zones

### Performance Metrics
- **Path Length:** Total distance from start to end
- **Node Count:** Number of decisions/waypoints
- **Execution Time:** How fast the algorithm runs
- **Cost:** Total distance/effort score

---

## 🔄 DATA SOURCES

### Backend Integration
The visualization connects to:

**API Endpoint:** `/api/warehouse/graph`
```
{
  "name": "Warehouse Name",
  "nodes": [
    {
      "id": "A1",
      "row": 2,
      "col": 2,
      "type": "rack",
      "walkable": true
    }
  ],
  "edges": [
    {
      "from": "ENTRY",
      "to": "A1",
      "cost": 2.0
    }
  ]
}
```

**Fallback:** If API is unavailable, uses comprehensive default warehouse layout

---

## 📝 USE CASES

### 1. **Picking Route Optimization**
- Find the optimal path for warehouse workers
- Minimize walking distance
- Reduce picking time

### 2. **Warehouse Layout Planning**
- Visualize rack positions
- Plan warehouse reorganization
- Identify bottlenecks

### 3. **Training & Documentation**
- Show new workers the layout
- Demonstrate picking routes
- Explain warehouse procedures

### 4. **Performance Analysis**
- Compare different routes
- Analyze picking efficiency
- Identify improvement areas

---

## 🔧 TECHNICAL DETAILS

### Components Used
1. **WarehouseVisualization** - Canvas-based rendering
2. **PathVisualizer** - Grid visualization with A*
3. **ControlPanel** - User controls and settings
4. **PathfindingEngine** - Client-side A* implementation

### Features
- ✅ Real-time visualization
- ✅ Interactive controls
- ✅ Multiple algorithms (A*, Dijkstra fallback)
- ✅ Constraint handling
- ✅ Performance metrics
- ✅ Mobile responsive
- ✅ Keyboard shortcuts

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 🎯 QUICK EXAMPLES

### Example 1: Simple Pick
```
Start: ENTRY
End: A1
Expected: Shortest path from entrance to Rack A1
```

### Example 2: Multi-location Pick
```
Start: ENTRY
End: B3
Via: A2, B1
Expected: Optimized route visiting multiple racks
```

### Example 3: With Constraints
```
Start: ENTRY
End: EXIT
Avoid: B1, B2 (maintenance)
Expected: Route avoiding blocked areas
```

---

## 📱 KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| **+** | Zoom in |
| **-** | Zoom out |
| **R** | Reset view |
| **Spacebar** | Find path |
| **C** | Clear selection |
| **H** | Show help |

---

## 🐛 TROUBLESHOOTING

### Visualization Not Showing?
1. ✅ Check browser console (F12) for errors
2. ✅ Verify all services running (see `QUICK_START_ALL_FIXED.md`)
3. ✅ Clear browser cache: `Ctrl+Shift+Delete`
4. ✅ Hard refresh: `Ctrl+F5`

### Path Not Found?
1. ✅ Verify start and end locations are walkable
2. ✅ Check if there's a route between locations
3. ✅ Remove constraints blocking the path
4. ✅ Check server logs for API errors

### Performance Issues?
1. ✅ Reduce zoom level
2. ✅ Try a smaller warehouse
3. ✅ Close other browser tabs
4. ✅ Check system resources

### Wrong Layout?
1. ✅ Verify warehouse selection
2. ✅ Check backend `/api/warehouse/graph` endpoint
3. ✅ Reload page to refresh data
4. ✅ Check database connection

---

## 📊 PERFORMANCE METRICS

The system displays:
- **Path Length:** Total distance units
- **Node Count:** Number of waypoints
- **Execution Time:** Algorithm runtime in MS
- **Cost Score:** Weighted path cost
- **Efficiency:** Distance optimization percentage

---

## 🔐 PERMISSIONS

**Role Access:**
- ✅ System Admin - Full access
- ✅ Warehouse Manager - Full access
- ✅ Inbound Coordinator - Read-only
- ✅ Outbound Coordinator - Read-only
- ❌ Other roles - Limited access

---

## 🚀 ADVANCED FEATURES

### Custom Warehouse Layouts
You can configure custom layouts by:
1. Creating warehouse nodes in the database
2. Defining edges between nodes
3. Setting node types (entry, rack, exit, etc.)
4. Configuring costs and constraints

### Integration with Orders
The visualization integrates with orders:
- Select an order to see picking list
- Get optimized picking route
- Track picking progress
- Confirm route completion

---

## 📚 API REFERENCE

### Get Warehouse Graph
```bash
GET /api/warehouse/graph
Authorization: Bearer {token}
```

**Response:**
```json
{
  "name": "Warehouse 1",
  "nodes": [...],
  "edges": [...],
  "properties": {
    "width": 10,
    "height": 6,
    "unit": "meters"
  }
}
```

### Find Path
```bash
POST /api/pathfinding/find
Authorization: Bearer {token}

{
  "start": "ENTRY",
  "end": "A1",
  "constraints": {
    "avoid_nodes": [],
    "max_steps": 100
  }
}
```

---

## ✅ SYSTEM STATUS

All visualization components are **ACTIVE AND RUNNING**:

| Component | Status | Port |
|-----------|--------|------|
| Frontend | ✅ Running | 3000 |
| Backend API | ✅ Running | 8080 |
| Database | ✅ Running | 5434 |
| Path Optimization AI | ✅ Running | 8081 |

**Everything connected and ready to use!** 🎉

---

## 🎓 NEXT STEPS

1. **Open the Visualization** → http://localhost:3000/pathfinding
2. **Select Start & End** → Use the control panel
3. **Find Path** → Click "Find Optimal Path"
4. **View Results** → See the visualization update
5. **Export/Share** → Download or share the route

---

**Last Updated:** April 6, 2026  
**Status:** ✅ FULLY OPERATIONAL - All original features restored and connected
