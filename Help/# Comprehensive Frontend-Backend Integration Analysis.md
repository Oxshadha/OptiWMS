\# Comprehensive Frontend-Backend Integration Analysis

\#\# Executive Summary

This document provides a complete analysis of:  
1\. \*\*All pages using mock data\*\* (66+ pages identified)  
2\. \*\*Missing backend APIs\*\* required for frontend features  
3\. \*\*Database compatibility\*\* issues and missing tables/fields  
4\. \*\*Implementation roadmap\*\* to connect everything to real data

\*\*Current Status:\*\*  
\- ✅ \*\*Connected to Real Data:\*\* 8 pages (Inventory, Warehouses, Inbound/Outbound Orders, Suppliers, Customers, Workers, Tasks)  
\- ❌ \*\*Using Mock Data:\*\* 58+ pages (88% of frontend)  
\- ❌ \*\*Missing APIs:\*\* \~40+ endpoints needed  
\- ⚠️ \*\*Database Gaps:\*\* Several tables/fields missing for full feature support

\---

\#\# 1\. Pages with Mock Data (Complete Inventory)

\#\#\# Admin Pages (30+ pages)

\#\#\#\# ✅ Connected to Real Data  
1\. \*\*Inventory\*\* (\`/admin/inventory\`) \- ✅ Fully connected  
2\. \*\*Warehouses\*\* (\`/admin/warehouses\`) \- ✅ Connected (locations API)  
3\. \*\*Orders \- Inbound\*\* (\`/admin/orders/inbound\`) \- ✅ Connected  
4\. \*\*Orders \- Outbound\*\* (\`/admin/orders/outbound\`) \- ✅ Connected  
5\. \*\*Suppliers\*\* (\`/admin/suppliers\`) \- ✅ Connected  
6\. \*\*Customers\*\* (\`/admin/customers\`) \- ✅ Connected  
7\. \*\*Workers\*\* (\`/admin/workers\`) \- ✅ Connected  
8\. \*\*Tasks\*\* (\`/admin/tasks\`) \- ✅ Connected

\#\#\#\# ❌ Using Mock Data

\*\*Dashboard & Analytics:\*\*  
\- \*\*Dashboard\*\* (\`/admin/dashboard\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Orders chart: \`ordersData\` (hardcoded array)  
 \- Order summary pie chart: \`summaryData\` (hardcoded)  
 \- Top selling products: Hardcoded list  
 \- Inventory overview stats: Hardcoded numbers (4,236, 2,778, 147, 537\)  
 \- Order statistics: Hardcoded "156 orders this month"  
 \- \*\*Missing APIs:\*\* \`/api/dashboard/kpis\`, \`/api/dashboard/orders-chart\`, \`/api/dashboard/top-products\`, \`/api/dashboard/inventory-overview\`

\- \*\*Labor Productivity\*\* (\`/admin/labor-productivity\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Worker productivity metrics: \`mockProductivityMetrics\` array  
 \- Leaderboard: \`mockLeaderboard\` array  
 \- Charts: All use mock data  
 \- \*\*Missing APIs:\*\* \`/api/analytics/worker-productivity\`, \`/api/analytics/leaderboard\`

\- \*\*Reports\*\* (\`/admin/reports\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Reports list: \`reports\` array (6 hardcoded reports)  
 \- Report generation: Mock download  
 \- Report scheduling: No API  
 \- Custom reports: No API  
 \- \*\*Missing APIs:\*\* \`/api/reports\`, \`/api/reports/generate\`, \`/api/reports/schedule\`, \`/api/reports/custom\`

\*\*Operations:\*\*  
\- \*\*Stock Transfers\*\* (\`/admin/stock-transfers\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Transfers list: \`mockTransfers\` array (3 items)  
 \- \*\*Backend API exists:\*\* \`/api/operations/stock-transfers\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Shipments\*\* (\`/admin/shipments\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Shipments list: \`shipments\` array (5 items)  
 \- \*\*Backend API exists:\*\* \`/api/shipments\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Returns\*\* (\`/admin/returns\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Returns list: \`returns\` array (4 items)  
 \- \*\*Backend API exists:\*\* \`/api/returns\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Packing\*\* (\`/admin/packing\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Packing records: \`mockPackingRecords\` array (3 items)  
 \- \*\*Backend API exists:\*\* \`/api/operations/packing\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Cycle Counts\*\* (\`/admin/cycle-counts\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Cycle counts: \`cycleCounts\` array (3 items)  
 \- \*\*Backend API exists:\*\* \`/api/operations/cycle-counts\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Quality Checks\*\* (\`/admin/quality-checks\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Quality checks: \`qualityChecks\` array (3 items)  
 \- \*\*Missing APIs:\*\* \`/api/quality-checks\`, \`/api/quality-checks/{id}/approve\`, \`/api/quality-checks/{id}/reject\`  
 \- \*\*Database:\*\* \`quality\_check\_logs\` table exists ✅

\- \*\*Anomalies\*\* (\`/admin/anomalies\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Anomalies: \`anomalies\` array (4 items)  
 \- \*\*Missing APIs:\*\* \`/api/anomalies\`, \`/api/anomalies/{id}/resolve\`  
 \- \*\*Database:\*\* \`ai\_anomaly\_detections\` table exists ✅

\- \*\*Dock Management\*\* (\`/admin/dock-management\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Dock doors: \`mockDockDoors\` array (5 items)  
 \- Appointments: \`mockAppointments\` array (2 items)  
 \- Yard trailers: \`mockYardTrailers\` array  
 \- \*\*Missing APIs:\*\* \`/api/dock-management/doors\`, \`/api/dock-management/appointments\`, \`/api/dock-management/yard-trailers\`  
 \- \*\*Database:\*\* No dock management tables ❌

\*\*Master Data:\*\*  
\- \*\*Products\*\* (\`/admin/products\`) \- ❌ \*\*MOCK DATA\*\* (needs verification \- may be same as materials)  
\- \*\*Raw Materials\*\* (\`/admin/raw-materials\`) \- ⚠️ \*\*PARTIAL\*\* (uses materials API but has fallback mock)  
\- \*\*Delivery Partners\*\* (\`/admin/delivery-partners\`) \- ❌ \*\*MOCK DATA\*\* (backend API exists, needs connection)  
\- \*\*Admins\*\* (\`/admin/admins\`) \- ❌ \*\*MOCK DATA\*\* (needs verification \- may use users API)

\*\*Settings & Others:\*\*  
\- \*\*Notifications\*\* (\`/admin/notifications\`) \- ❌ \*\*MOCK DATA\*\*  
\- \*\*Settings\*\* (\`/admin/settings\`) \- Static page  
\- \*\*Help\*\* (\`/admin/help\`) \- Static page  
\- \*\*SOPs\*\* (\`/admin/sops\`) \- Static page

\#\#\# Worker Pages (20+ pages)

\#\#\#\# ✅ Connected to Real Data  
1\. \*\*Receiving\*\* (\`/worker/receiving\`) \- ✅ Connected  
2\. \*\*Picking\*\* (\`/worker/picking\`) \- ✅ Connected  
3\. \*\*Putaway\*\* (\`/worker/putaway\`) \- ✅ Connected

\#\#\#\# ❌ Using Mock Data

\- \*\*Leaderboard\*\* (\`/worker/leaderboard\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Leaderboard: \`mockLeaderboard\` array  
 \- Achievements: \`mockAchievements\` array  
 \- \*\*Missing APIs:\*\* \`/api/analytics/leaderboard\`, \`/api/analytics/achievements\`

\- \*\*Packing\*\* (\`/worker/packing\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Orders: \`orders\` array (2 mock orders)  
 \- \*\*Backend API exists:\*\* \`/api/operations/packing\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Cycle Count\*\* (\`/worker/cycle-count\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Tasks: \`cycleCountTasks\` array (2 items)  
 \- \*\*Backend API exists:\*\* \`/api/operations/cycle-counts\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Stock Transfer\*\* (\`/worker/stock-transfer\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Warehouses: Hardcoded array  
 \- \*\*Backend API exists:\*\* \`/api/operations/stock-transfers\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Shipments\*\* (\`/worker/shipments\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Shipments: \`shipments\` array (3 items)  
 \- \*\*Backend API exists:\*\* \`/api/shipments\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Returns\*\* (\`/worker/returns\`) \- ❌ \*\*ALL MOCK DATA\*\*  
 \- Returns: \`returns\` array (2 items)  
 \- \*\*Backend API exists:\*\* \`/api/returns\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Tasks\*\* (\`/worker/tasks\`) \- ❌ \*\*MOCK DATA\*\*  
 \- Tasks: Hardcoded array  
 \- \*\*Backend API exists:\*\* \`/api/tasks\` ✅  
 \- \*\*Action:\*\* Connect to existing API

\- \*\*Profile\*\* (\`/worker/profile\`) \- ⚠️ \*\*PARTIAL\*\*  
 \- Stats: Hardcoded ("1,247", "1,189", "95.3%")  
 \- \*\*Missing APIs:\*\* \`/api/workers/{id}/stats\`

\---

\#\# 2\. Missing Backend APIs

\#\#\# Analytics & Reporting APIs (HIGH PRIORITY)

\`\`\`java  
*// Analytics Controller \- MISSING*  
@RestController  
@RequestMapping("/api/analytics")  
public class AnalyticsController {  
   *// Worker Productivity*  
   @GetMapping("/worker-productivity")  
   List\<WorkerProductivityMetrics\> getWorkerProductivity(  
       @RequestParam(required \= false) String *period*,  
       @RequestParam(required \= false) String *warehouseId*  
   );  
    
   @GetMapping("/leaderboard")  
   List\<LeaderboardEntry\> getLeaderboard(  
       @RequestParam String *period*, *// "weekly" | "monthly"*  
       @RequestParam(required \= false) String *warehouseId*  
   );  
    
   *// Dashboard KPIs*  
   @GetMapping("/dashboard/kpis")  
   DashboardKPIs getDashboardKPIs(  
       @RequestParam(required \= false) String *warehouseId*,  
       @RequestParam(required \= false) String *period*  
   );  
    
   @GetMapping("/dashboard/orders-chart")  
   List\<OrderChartData\> getOrdersChart(  
       @RequestParam String *period*, *// "daily" | "weekly" | "monthly"*  
       @RequestParam(required \= false) String *warehouseId*  
   );  
    
   @GetMapping("/dashboard/top-products")  
   List\<TopProduct\> getTopProducts(  
       @RequestParam(required \= false) Integer *limit*,  
       @RequestParam(required \= false) String *warehouseId*  
   );  
    
   @GetMapping("/dashboard/inventory-overview")  
   InventoryOverview getInventoryOverview(  
       @RequestParam(required \= false) String *warehouseId*  
   );  
    
   *// Worker Stats*  
   @GetMapping("/workers/{workerId}/stats")  
   WorkerStats getWorkerStats(@PathVariable String *workerId*);  
    
   @GetMapping("/workers/{workerId}/achievements")  
   List\<Achievement\> getWorkerAchievements(@PathVariable String *workerId*);  
}  
\`\`\`

\#\#\# Reports API (HIGH PRIORITY)

\`\`\`java  
*// Reports Controller \- MISSING*  
@RestController  
@RequestMapping("/api/reports")  
public class ReportsController {  
   @GetMapping  
   List\<Report\> getAllReports(  
       @RequestParam(required \= false) String *type*,  
       @RequestParam(required \= false) String *status*  
   );  
    
   @GetMapping("/{id}")  
   Report getReportById(@PathVariable UUID *id*);  
    
   @PostMapping("/generate")  
   Report generateReport(@RequestBody GenerateReportRequest *request*);  
    
   @GetMapping("/{id}/download")  
   ResponseEntity\<Resource\> downloadReport(@PathVariable UUID *id*);  
    
   @PostMapping("/schedule")  
   ScheduledReport scheduleReport(@RequestBody ScheduleReportRequest *request*);  
    
   @PostMapping("/custom")  
   CustomReport createCustomReport(@RequestBody CreateCustomReportRequest *request*);  
}  
\`\`\`

\#\#\# Quality Checks API (MEDIUM PRIORITY)

\`\`\`java  
*// Quality Checks Controller \- MISSING*  
@RestController  
@RequestMapping("/api/quality-checks")  
public class QualityCheckController {  
   @GetMapping  
   List\<QualityCheck\> getAllQualityChecks(  
       @RequestParam(required \= false) String *warehouseId*,  
       @RequestParam(required \= false) String *status*  
   );  
    
   @GetMapping("/{id}")  
   QualityCheck getQualityCheckById(@PathVariable UUID *id*);  
    
   @PostMapping  
   QualityCheck createQualityCheck(@RequestBody CreateQualityCheckRequest *request*);  
    
   @PostMapping("/{id}/approve")  
   QualityCheck approveQualityCheck(  
       @PathVariable UUID *id*,  
       @RequestBody ApproveQualityCheckRequest *request*  
   );  
    
   @PostMapping("/{id}/reject")  
   QualityCheck rejectQualityCheck(  
       @PathVariable UUID *id*,  
       @RequestBody RejectQualityCheckRequest *request*  
   );  
}  
\`\`\`

\#\#\# Anomalies API (MEDIUM PRIORITY)

\`\`\`java  
*// Anomalies Controller \- MISSING*  
@RestController  
@RequestMapping("/api/anomalies")  
public class AnomalyController {  
   @GetMapping  
   List\<Anomaly\> getAllAnomalies(  
       @RequestParam(required \= false) String *warehouseId*,  
       @RequestParam(required \= false) String *severity*,  
       @RequestParam(required \= false) String *status*  
   );  
    
   @GetMapping("/{id}")  
   Anomaly getAnomalyById(@PathVariable UUID *id*);  
    
   @PostMapping("/{id}/resolve")  
   Anomaly resolveAnomaly(  
       @PathVariable UUID *id*,  
       @RequestBody ResolveAnomalyRequest *request*  
   );  
    
   @PostMapping("/{id}/mark-investigating")  
   Anomaly markInvestigating(@PathVariable UUID *id*);  
}  
\`\`\`

\#\#\# Dock Management API (MEDIUM PRIORITY)

\`\`\`java  
*// Dock Management Controller \- MISSING*  
@RestController  
@RequestMapping("/api/dock-management")  
public class DockManagementController {  
   *// Dock Doors*  
   @GetMapping("/doors")  
   List\<DockDoor\> getAllDockDoors(  
       @RequestParam String *warehouseId*  
   );  
    
   @GetMapping("/doors/{id}")  
   DockDoor getDockDoorById(@PathVariable UUID *id*);  
    
   @PostMapping("/doors")  
   DockDoor createDockDoor(@RequestBody CreateDockDoorRequest *request*);  
    
   @PutMapping("/doors/{id}")  
   DockDoor updateDockDoor(@PathVariable UUID *id*, @RequestBody UpdateDockDoorRequest *request*);  
    
   *// Appointments*  
   @GetMapping("/appointments")  
   List\<DockAppointment\> getAllAppointments(  
       @RequestParam(required \= false) String *warehouseId*,  
       @RequestParam(required \= false) String *status*  
   );  
    
   @PostMapping("/appointments")  
   DockAppointment createAppointment(@RequestBody CreateAppointmentRequest *request*);  
    
   @PostMapping("/appointments/{id}/check-in")  
   DockAppointment checkIn(@PathVariable UUID *id*);  
    
   @PostMapping("/appointments/{id}/check-out")  
   DockAppointment checkOut(@PathVariable UUID *id*);  
    
   *// Yard Trailers*  
   @GetMapping("/yard-trailers")  
   List\<YardTrailer\> getYardTrailers(  
       @RequestParam String *warehouseId*  
   );  
    
   @PostMapping("/yard-trailers")  
   YardTrailer createYardTrailer(@RequestBody CreateYardTrailerRequest *request*);  
}  
\`\`\`

\#\#\# Products API (LOW PRIORITY \- if separate from Materials)

\`\`\`java  
*// Products Controller \- MISSING (if products are separate from materials)*  
@RestController  
@RequestMapping("/api/products")  
public class ProductController {  
   *// Similar to MaterialController but for finished goods*  
   *// Check if products are just materials with material\_type='product'*  
   *// If so, use MaterialController with filter*  
}  
\`\`\`

\#\#\# Admin Management API (LOW PRIORITY)

\`\`\`java  
*// Admin Management Controller \- MISSING (may use UserController with role filter)*  
@RestController  
@RequestMapping("/api/admins")  
public class AdminController {  
   @GetMapping  
   List\<Admin\> getAllAdmins();  
    
   @PostMapping  
   Admin createAdmin(@RequestBody CreateAdminRequest *request*);  
    
   @PutMapping("/{id}")  
   Admin updateAdmin(@PathVariable UUID *id*, @RequestBody UpdateAdminRequest *request*);  
    
   @DeleteMapping("/{id}")  
   void deleteAdmin(@PathVariable UUID *id*);  
}  
\`\`\`

\---

\#\# 3\. Database Compatibility Analysis

\#\#\# ✅ Tables That Exist and Support Frontend Features

1\. \*\*materials\*\* \- ✅ Complete (supports products and raw materials via \`material\_type\`)  
2\. \*\*inventory\*\* \- ✅ Complete  
3\. \*\*locations\*\* \- ✅ Complete  
4\. \*\*warehouses\*\* \- ✅ Complete  
5\. \*\*suppliers\*\* \- ✅ Complete (with international support)  
6\. \*\*customers\*\* \- ✅ Complete (with international support)  
7\. \*\*delivery\_partners\*\* \- ✅ Complete (with international support)  
8\. \*\*orders\*\* \- ✅ Complete  
9\. \*\*tasks\*\* \- ✅ Complete  
10\. \*\*users\*\* \- ✅ Complete (supports workers and admins)  
11\. \*\*supply\_plans\*\* \- ✅ Complete  
12\. \*\*material\_planning\*\* \- ✅ Complete  
13\. \*\*grns\*\* \- ✅ Complete  
14\. \*\*quality\_check\_logs\*\* \- ✅ Complete  
15\. \*\*ai\_anomaly\_detections\*\* \- ✅ Complete  
16\. \*\*ai\_demand\_forecasts\*\* \- ✅ Complete  
17\. \*\*ai\_sourcing\_recommendations\*\* \- ✅ Complete  
18\. \*\*ai\_slotting\_recommendations\*\* \- ✅ Complete  
19\. \*\*ai\_path\_recommendations\*\* \- ✅ Complete

\#\#\# ❌ Missing Database Tables

1\. \*\*dock\_doors\*\* \- ❌ \*\*MISSING\*\*  
  \`\`\`sql  
  CREATE TABLE dock\_doors (  
      id UUID PRIMARY KEY,  
      door\_number VARCHAR(50) NOT NULL,  
      warehouse\_id UUID REFERENCES warehouses(id),  
      location VARCHAR(100),  
      status VARCHAR(20), *\-- available, occupied, reserved, maintenance*  
      current\_appointment\_id UUID,  
      created\_at TIMESTAMP DEFAULT NOW()  
  );  
  \`\`\`

2\. \*\*dock\_appointments\*\* \- ❌ \*\*MISSING\*\*  
  \`\`\`sql  
  CREATE TABLE dock\_appointments (  
      id UUID PRIMARY KEY,  
      appointment\_number VARCHAR(50) UNIQUE NOT NULL,  
      dock\_door\_id UUID REFERENCES dock\_doors(id),  
      warehouse\_id UUID REFERENCES warehouses(id),  
      appointment\_type VARCHAR(20), *\-- inbound, outbound*  
      scheduled\_start TIMESTAMP NOT NULL,  
      scheduled\_end TIMESTAMP NOT NULL,  
      actual\_start TIMESTAMP,  
      actual\_end TIMESTAMP,  
      inbound\_order\_id UUID REFERENCES orders(id),  
      supplier\_id UUID REFERENCES suppliers(id),  
      carrier\_name VARCHAR(200),  
      trailer\_number VARCHAR(50),  
      status VARCHAR(20), *\-- scheduled, checked\_in, in\_progress, completed, cancelled*  
      created\_at TIMESTAMP DEFAULT NOW()  
  );  
  \`\`\`

3\. \*\*yard\_trailers\*\* \- ❌ \*\*MISSING\*\*  
  \`\`\`sql  
  CREATE TABLE yard\_trailers (  
      id UUID PRIMARY KEY,  
      trailer\_number VARCHAR(50) UNIQUE NOT NULL,  
      warehouse\_id UUID REFERENCES warehouses(id),  
      carrier\_name VARCHAR(200),  
      inbound\_order\_id UUID REFERENCES orders(id),  
      supplier\_id UUID REFERENCES suppliers(id),  
      arrived\_at TIMESTAMP,  
      wait\_time\_minutes INTEGER,  
      status VARCHAR(20), *\-- waiting, assigned, unloading, completed*  
      assigned\_dock\_door\_id UUID REFERENCES dock\_doors(id),  
      created\_at TIMESTAMP DEFAULT NOW()  
  );  
  \`\`\`

4\. \*\*reports\*\* \- ❌ \*\*MISSING\*\* (for report management)  
  \`\`\`sql  
  CREATE TABLE reports (  
      id UUID PRIMARY KEY,  
      report\_name VARCHAR(200) NOT NULL,  
      report\_type VARCHAR(50), *\-- inbound, outbound, inventory, sales, analytics, customer*  
      description TEXT,  
      report\_config JSONB, *\-- Custom report configuration*  
      generated\_at TIMESTAMP,  
      file\_size\_bytes BIGINT,  
      file\_path VARCHAR(500),  
      created\_by UUID REFERENCES users(id),  
      created\_at TIMESTAMP DEFAULT NOW()  
  );  
  \`\`\`

5\. \*\*scheduled\_reports\*\* \- ❌ \*\*MISSING\*\*  
  \`\`\`sql  
  CREATE TABLE scheduled\_reports (  
      id UUID PRIMARY KEY,  
      report\_type VARCHAR(50) NOT NULL,  
      frequency VARCHAR(20), *\-- daily, weekly, monthly*  
      scheduled\_time TIME,  
      email\_recipients TEXT\[\], *\-- Array of email addresses*  
      is\_active BOOLEAN DEFAULT TRUE,  
      last\_generated\_at TIMESTAMP,  
      next\_generation\_at TIMESTAMP,  
      created\_by UUID REFERENCES users(id),  
      created\_at TIMESTAMP DEFAULT NOW()  
  );  
  \`\`\`

6\. \*\*worker\_achievements\*\* \- ❌ \*\*MISSING\*\* (for gamification)  
  \`\`\`sql  
  CREATE TABLE worker\_achievements (  
      id UUID PRIMARY KEY,  
      worker\_id UUID REFERENCES users(id),  
      achievement\_type VARCHAR(50), *\-- speed\_demon, perfect\_week, century\_club, etc.*  
      earned\_at TIMESTAMP DEFAULT NOW(),  
      metadata JSONB *\-- Additional achievement data*  
  );  
  \`\`\`

7\. \*\*packing\_records\*\* \- ⚠️ \*\*CHECK\*\* (may be in operations or separate table)  
  \- Check if packing data is stored in tasks or needs separate table  
  \- Current: Packing may be tracked via tasks with task\_type='packing'

\#\#\# ⚠️ Database Fields That May Need Enhancement

1\. \*\*tasks\*\* table \- May need additional fields for:  
  \- Packing-specific data (box dimensions, weight, tracking number)  
  \- Cycle count-specific data (expected vs counted quantities)  
  \- Worker performance tracking (start time, end time, duration)

2\. \*\*orders\*\* table \- May need:  
  \- Sales/revenue data for dashboard  
  \- Customer lifetime value calculation fields

3\. \*\*inventory\*\* table \- Already has most fields, but may need:  
  \- Movement history (for velocity scoring)  
  \- ABC classification

\---

\#\# 4\. Implementation Roadmap

\#\#\# Phase 1: Connect Existing APIs (Week 1-2) \- \*\*QUICK WINS\*\*

\*\*Priority: HIGH\*\* \- These APIs already exist, just need frontend connection

1\. \*\*Stock Transfers\*\* ✅ API exists  
  \- Connect \`/admin/stock-transfers\` to \`/api/operations/stock-transfers\`  
  \- Connect \`/worker/stock-transfer\` to API

2\. \*\*Shipments\*\* ✅ API exists  
  \- Connect \`/admin/shipments\` to \`/api/shipments\`  
  \- Connect \`/worker/shipments\` to API

3\. \*\*Returns\*\* ✅ API exists  
  \- Connect \`/admin/returns\` to \`/api/returns\`  
  \- Connect \`/worker/returns\` to API

4\. \*\*Packing\*\* ✅ API exists  
  \- Connect \`/admin/packing\` to \`/api/operations/packing\`  
  \- Connect \`/worker/packing\` to API

5\. \*\*Cycle Counts\*\* ✅ API exists  
  \- Connect \`/admin/cycle-counts\` to \`/api/operations/cycle-counts\`  
  \- Connect \`/worker/cycle-count\` to API

6\. \*\*Tasks\*\* ✅ API exists  
  \- Connect \`/worker/tasks\` to \`/api/tasks\`

7\. \*\*Delivery Partners\*\* ✅ API exists  
  \- Connect \`/admin/delivery-partners\` to \`/api/delivery-partners\`

\*\*Estimated Time:\*\* 2 weeks  
\*\*Impact:\*\* 10+ pages connected to real data

\#\#\# Phase 2: Create Analytics & Dashboard APIs (Week 3-4) \- \*\*HIGH VALUE\*\*

\*\*Priority: HIGH\*\* \- Critical for dashboard and KPIs

1\. \*\*Create AnalyticsController\*\*  
  \- Worker productivity metrics  
  \- Leaderboard  
  \- Worker stats  
  \- Achievements

2\. \*\*Create DashboardController\*\*  
  \- Dashboard KPIs  
  \- Orders chart data  
  \- Top products  
  \- Inventory overview

3\. \*\*Create database views/functions for:\*\*  
  \- Order statistics aggregation  
  \- Worker productivity calculations  
  \- Top products ranking

4\. \*\*Connect frontend:\*\*  
  \- Dashboard page  
  \- Labor productivity page  
  \- Worker leaderboard

\*\*Estimated Time:\*\* 2 weeks  
\*\*Impact:\*\* 3 critical pages with real data

\#\#\# Phase 3: Create Reports API (Week 5\) \- \*\*MEDIUM PRIORITY\*\*

1\. \*\*Create ReportsController\*\*  
  \- Report generation  
  \- Report scheduling  
  \- Custom reports

2\. \*\*Create database tables:\*\*  
  \- \`reports\`  
  \- \`scheduled\_reports\`

3\. \*\*Implement report generation service:\*\*  
  \- PDF generation  
  \- Excel export  
  \- CSV export

4\. \*\*Connect frontend:\*\*  
  \- Reports page

\*\*Estimated Time:\*\* 1 week  
\*\*Impact:\*\* 1 page with full functionality

\#\#\# Phase 4: Create Quality Checks & Anomalies APIs (Week 6\) \- \*\*MEDIUM PRIORITY\*\*

1\. \*\*Create QualityCheckController\*\*  
  \- CRUD operations  
  \- Approve/reject endpoints

2\. \*\*Create AnomalyController\*\*  
  \- List anomalies  
  \- Resolve anomalies

3\. \*\*Connect frontend:\*\*  
  \- Quality checks page  
  \- Anomalies page

\*\*Estimated Time:\*\* 1 week  
\*\*Impact:\*\* 2 pages connected

\#\#\# Phase 5: Create Dock Management System (Week 7\) \- \*\*LOW PRIORITY\*\*

1\. \*\*Create database tables:\*\*  
  \- \`dock\_doors\`  
  \- \`dock\_appointments\`  
  \- \`yard\_trailers\`

2\. \*\*Create DockManagementController\*\*  
  \- Dock door management  
  \- Appointment scheduling  
  \- Yard trailer tracking

3\. \*\*Connect frontend:\*\*  
  \- Dock management page

\*\*Estimated Time:\*\* 1 week  
\*\*Impact:\*\* 1 page connected

\#\#\# Phase 6: Remaining Pages (Week 8+) \- \*\*CLEANUP\*\*

1\. \*\*Products page\*\* \- Verify if separate from materials (likely same)  
2\. \*\*Admins page\*\* \- Verify if separate from users (likely use users API with role filter)  
3\. \*\*Notifications page\*\* \- Create notifications API if needed  
4\. \*\*Worker profile stats\*\* \- Connect to analytics API

\*\*Estimated Time:\*\* 1-2 weeks  
\*\*Impact:\*\* 3-4 pages connected

\---

\#\# 5\. Database Migration Scripts Needed

\#\#\# Migration V5: Dock Management Tables

\`\`\`sql  
*\-- V5\_\_dock\_management\_tables.sql*

CREATE TABLE IF NOT EXISTS dock\_doors (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   door\_number VARCHAR(50) NOT NULL,  
   warehouse\_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,  
   location VARCHAR(100),  
   status VARCHAR(20) DEFAULT 'available', *\-- available, occupied, reserved, maintenance*  
   current\_appointment\_id UUID,  
   created\_at TIMESTAMP DEFAULT NOW(),  
   updated\_at TIMESTAMP DEFAULT NOW(),  
   UNIQUE(warehouse\_id, door\_number)  
);

CREATE TABLE IF NOT EXISTS dock\_appointments (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   appointment\_number VARCHAR(50) UNIQUE NOT NULL,  
   dock\_door\_id UUID REFERENCES dock\_doors(id) ON DELETE SET NULL,  
   warehouse\_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,  
   appointment\_type VARCHAR(20) NOT NULL, *\-- inbound, outbound*  
   scheduled\_start TIMESTAMP NOT NULL,  
   scheduled\_end TIMESTAMP NOT NULL,  
   actual\_start TIMESTAMP,  
   actual\_end TIMESTAMP,  
   inbound\_order\_id UUID REFERENCES orders(id),  
   outbound\_order\_id UUID REFERENCES orders(id),  
   supplier\_id UUID REFERENCES suppliers(id),  
   carrier\_name VARCHAR(200),  
   trailer\_number VARCHAR(50),  
   status VARCHAR(20) DEFAULT 'scheduled', *\-- scheduled, checked\_in, in\_progress, completed, cancelled*  
   notes TEXT,  
   created\_at TIMESTAMP DEFAULT NOW(),  
   updated\_at TIMESTAMP DEFAULT NOW()  
);

CREATE TABLE IF NOT EXISTS yard\_trailers (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   trailer\_number VARCHAR(50) UNIQUE NOT NULL,  
   warehouse\_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,  
   carrier\_name VARCHAR(200),  
   inbound\_order\_id UUID REFERENCES orders(id),  
   supplier\_id UUID REFERENCES suppliers(id),  
   arrived\_at TIMESTAMP,  
   wait\_time\_minutes INTEGER,  
   status VARCHAR(20) DEFAULT 'waiting', *\-- waiting, assigned, unloading, completed*  
   assigned\_dock\_door\_id UUID REFERENCES dock\_doors(id),  
   created\_at TIMESTAMP DEFAULT NOW(),  
   updated\_at TIMESTAMP DEFAULT NOW()  
);

CREATE INDEX IF NOT EXISTS idx\_dock\_doors\_warehouse ON dock\_doors(warehouse\_id);  
CREATE INDEX IF NOT EXISTS idx\_dock\_doors\_status ON dock\_doors(status);  
CREATE INDEX IF NOT EXISTS idx\_dock\_appointments\_warehouse ON dock\_appointments(warehouse\_id);  
CREATE INDEX IF NOT EXISTS idx\_dock\_appointments\_status ON dock\_appointments(status);  
CREATE INDEX IF NOT EXISTS idx\_dock\_appointments\_door ON dock\_appointments(dock\_door\_id);  
CREATE INDEX IF NOT EXISTS idx\_dock\_appointments\_scheduled\_start ON dock\_appointments(scheduled\_start);  
CREATE INDEX IF NOT EXISTS idx\_yard\_trailers\_warehouse ON yard\_trailers(warehouse\_id);  
CREATE INDEX IF NOT EXISTS idx\_yard\_trailers\_status ON yard\_trailers(status);

*\-- Trigger for updated\_at*  
CREATE TRIGGER update\_dock\_doors\_updated\_at BEFORE UPDATE ON dock\_doors  
   FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();

CREATE TRIGGER update\_dock\_appointments\_updated\_at BEFORE UPDATE ON dock\_appointments  
   FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();

CREATE TRIGGER update\_yard\_trailers\_updated\_at BEFORE UPDATE ON yard\_trailers  
   FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();  
\`\`\`

\#\#\# Migration V6: Reports Tables

\`\`\`sql  
*\-- V6\_\_reports\_tables.sql*

CREATE TABLE IF NOT EXISTS reports (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   report\_name VARCHAR(200) NOT NULL,  
   report\_type VARCHAR(50) NOT NULL, *\-- inbound, outbound, inventory, sales, analytics, customer*  
   description TEXT,  
   report\_config JSONB, *\-- Custom report configuration*  
   generated\_at TIMESTAMP,  
   file\_size\_bytes BIGINT,  
   file\_path VARCHAR(500),  
   created\_by UUID REFERENCES users(id),  
   created\_at TIMESTAMP DEFAULT NOW()  
);

CREATE TABLE IF NOT EXISTS scheduled\_reports (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   report\_type VARCHAR(50) NOT NULL,  
   frequency VARCHAR(20) NOT NULL, *\-- daily, weekly, monthly*  
   scheduled\_time TIME NOT NULL,  
   email\_recipients TEXT\[\] NOT NULL,  
   is\_active BOOLEAN DEFAULT TRUE,  
   last\_generated\_at TIMESTAMP,  
   next\_generation\_at TIMESTAMP,  
   created\_by UUID REFERENCES users(id),  
   created\_at TIMESTAMP DEFAULT NOW(),  
   updated\_at TIMESTAMP DEFAULT NOW()  
);

CREATE INDEX IF NOT EXISTS idx\_reports\_type ON reports(report\_type);  
CREATE INDEX IF NOT EXISTS idx\_reports\_created\_by ON reports(created\_by);  
CREATE INDEX IF NOT EXISTS idx\_reports\_generated\_at ON reports(generated\_at);  
CREATE INDEX IF NOT EXISTS idx\_scheduled\_reports\_active ON scheduled\_reports(is\_active);  
CREATE INDEX IF NOT EXISTS idx\_scheduled\_reports\_next\_generation ON scheduled\_reports(next\_generation\_at);

CREATE TRIGGER update\_scheduled\_reports\_updated\_at BEFORE UPDATE ON scheduled\_reports  
   FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();  
\`\`\`

\#\#\# Migration V7: Worker Achievements

\`\`\`sql  
*\-- V7\_\_worker\_achievements.sql*

CREATE TABLE IF NOT EXISTS worker\_achievements (  
   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
   worker\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
   achievement\_type VARCHAR(50) NOT NULL, *\-- speed\_demon, perfect\_week, century\_club, early\_bird, night\_owl*  
   earned\_at TIMESTAMP DEFAULT NOW(),  
   metadata JSONB, *\-- Additional achievement data*  
   UNIQUE(worker\_id, achievement\_type, DATE(earned\_at))  
);

CREATE INDEX IF NOT EXISTS idx\_worker\_achievements\_worker ON worker\_achievements(worker\_id);  
CREATE INDEX IF NOT EXISTS idx\_worker\_achievements\_type ON worker\_achievements(achievement\_type);  
CREATE INDEX IF NOT EXISTS idx\_worker\_achievements\_earned\_at ON worker\_achievements(earned\_at);  
\`\`\`

\---

\#\# 6\. Frontend API Clients to Create/Update

\#\#\# New API Clients Needed

1\. \*\*\`frontend/lib/api/analytics.ts\`\*\* \- ✅ EXISTS but needs implementation  
  \`\`\`typescript  
  export const analyticsApi \= {  
    getWorkerProductivity: (*period*?: string) \=\> Promise\<WorkerProductivityMetrics\[\]\>,  
    getLeaderboard: (*period*: string) \=\> Promise\<LeaderboardEntry\[\]\>,  
    getDashboardKPIs: (*warehouseId*?: string) \=\> Promise\<DashboardKPIs\>,  
    getOrdersChart: (*period*: string) \=\> Promise\<OrderChartData\[\]\>,  
    getTopProducts: (*limit*?: number) \=\> Promise\<TopProduct\[\]\>,  
    getInventoryOverview: () \=\> Promise\<InventoryOverview\>,  
    getWorkerStats: (*workerId*: string) \=\> Promise\<WorkerStats\>,  
    getWorkerAchievements: (*workerId*: string) \=\> Promise\<Achievement\[\]\>,  
  };  
  \`\`\`

2\. \*\*\`frontend/lib/api/reports.ts\`\*\* \- ❌ MISSING  
  \`\`\`typescript  
  export const reportsApi \= {  
    getAll: (*type*?: string) \=\> Promise\<Report\[\]\>,  
    getById: (*id*: string) \=\> Promise\<Report\>,  
    generate: (*request*: GenerateReportRequest) \=\> Promise\<Report\>,  
    download: (*id*: string) \=\> Promise\<Blob\>,  
    schedule: (*request*: ScheduleReportRequest) \=\> Promise\<ScheduledReport\>,  
    createCustom: (*request*: CreateCustomReportRequest) \=\> Promise\<CustomReport\>,  
  };  
  \`\`\`

3\. \*\*\`frontend/lib/api/quality-checks.ts\`\*\* \- ❌ MISSING  
  \`\`\`typescript  
  export const qualityChecksApi \= {  
    getAll: (*warehouseId*?: string) \=\> Promise\<QualityCheck\[\]\>,  
    getById: (*id*: string) \=\> Promise\<QualityCheck\>,  
    create: (*request*: CreateQualityCheckRequest) \=\> Promise\<QualityCheck\>,  
    approve: (*id*: string, *request*: ApproveRequest) \=\> Promise\<QualityCheck\>,  
    reject: (*id*: string, *request*: RejectRequest) \=\> Promise\<QualityCheck\>,  
  };  
  \`\`\`

4\. \*\*\`frontend/lib/api/anomalies.ts\`\*\* \- ❌ MISSING  
  \`\`\`typescript  
  export const anomaliesApi \= {  
    getAll: (*filters*?: AnomalyFilters) \=\> Promise\<Anomaly\[\]\>,  
    getById: (*id*: string) \=\> Promise\<Anomaly\>,  
    resolve: (*id*: string, *request*: ResolveRequest) \=\> Promise\<Anomaly\>,  
    markInvestigating: (*id*: string) \=\> Promise\<Anomaly\>,  
  };  
  \`\`\`

5\. \*\*\`frontend/lib/api/dock-management.ts\`\*\* \- ❌ MISSING  
  \`\`\`typescript  
  export const dockManagementApi \= {  
    getDoors: (*warehouseId*: string) \=\> Promise\<DockDoor\[\]\>,  
    getDoorById: (*id*: string) \=\> Promise\<DockDoor\>,  
    createDoor: (*request*: CreateDockDoorRequest) \=\> Promise\<DockDoor\>,  
    updateDoor: (*id*: string, *request*: UpdateDockDoorRequest) \=\> Promise\<DockDoor\>,  
    getAppointments: (*warehouseId*?: string) \=\> Promise\<DockAppointment\[\]\>,  
    createAppointment: (*request*: CreateAppointmentRequest) \=\> Promise\<DockAppointment\>,  
    checkIn: (*id*: string) \=\> Promise\<DockAppointment\>,  
    checkOut: (*id*: string) \=\> Promise\<DockAppointment\>,  
    getYardTrailers: (*warehouseId*: string) \=\> Promise\<YardTrailer\[\]\>,  
  };  
  \`\`\`

\#\#\# API Clients to Update

1\. \*\*\`frontend/lib/api/operations.ts\`\*\* \- ✅ EXISTS  
  \- Verify all endpoints are present for stock transfers, shipments, returns, packing, cycle counts

2\. \*\*\`frontend/lib/api/shipments.ts\`\*\* \- ✅ EXISTS (verify completeness)

3\. \*\*\`frontend/lib/api/returns.ts\`\*\* \- ✅ EXISTS (verify completeness)

4\. \*\*\`frontend/lib/api/delivery-partners.ts\`\*\* \- ✅ EXISTS (verify connection)

\---

\#\# 7\. Quick Wins \- Pages That Can Be Connected Immediately

These pages have backend APIs ready, just need frontend connection:

1\. ✅ \*\*Stock Transfers\*\* \- \`/api/operations/stock-transfers\` exists  
2\. ✅ \*\*Shipments\*\* \- \`/api/shipments\` exists  
3\. ✅ \*\*Returns\*\* \- \`/api/returns\` exists  
4\. ✅ \*\*Packing\*\* \- \`/api/operations/packing\` exists  
5\. ✅ \*\*Cycle Counts\*\* \- \`/api/operations/cycle-counts\` exists  
6\. ✅ \*\*Worker Tasks\*\* \- \`/api/tasks\` exists  
7\. ✅ \*\*Delivery Partners\*\* \- \`/api/delivery-partners\` exists

\*\*Estimated Time to Connect:\*\* 1-2 days per page  
\*\*Total Impact:\*\* 7 pages with real data (admin \+ worker versions \= 10+ page connections)

\---

\#\# 8\. Critical Missing Features

\#\#\# High Priority

1\. \*\*Dashboard KPIs\*\* \- No API, all hardcoded  
2\. \*\*Analytics/Reports\*\* \- No API, all hardcoded  
3\. \*\*Worker Leaderboard\*\* \- No API, all hardcoded  
4\. \*\*Quality Checks Management\*\* \- Table exists, no API  
5\. \*\*Anomaly Management\*\* \- Table exists, no API

\#\#\# Medium Priority

1\. \*\*Dock Management\*\* \- No tables, no API  
2\. \*\*Report Scheduling\*\* \- No tables, no API  
3\. \*\*Worker Achievements\*\* \- No tables, no API

\#\#\# Low Priority

1\. \*\*Products\*\* (if separate from materials \- likely not needed)  
2\. \*\*Admin Management\*\* (if separate from users \- likely use users API)  
3\. \*\*Notifications\*\* (if needed)

\---

\#\# 9\. Database Schema Compatibility Summary

\#\#\# ✅ Fully Compatible  
\- Materials/Products  
\- Inventory  
\- Locations  
\- Warehouses  
\- Suppliers  
\- Customers  
\- Delivery Partners  
\- Orders  
\- Tasks  
\- Users/Workers/Admins  
\- Quality Check Logs  
\- Anomaly Detections

\#\#\# ⚠️ Partially Compatible  
\- Packing (may need additional fields in tasks table)  
\- Cycle Counts (may need additional fields in tasks table)  
\- Worker Performance (needs aggregation queries)

\#\#\# ❌ Missing Tables  
\- Dock Doors  
\- Dock Appointments  
\- Yard Trailers  
\- Reports  
\- Scheduled Reports  
\- Worker Achievements

\---

\#\# 10\. Recommended Implementation Order

\#\#\# Week 1-2: Quick Wins (Connect Existing APIs)  
1\. Stock Transfers (admin \+ worker)  
2\. Shipments (admin \+ worker)  
3\. Returns (admin \+ worker)  
4\. Packing (admin \+ worker)  
5\. Cycle Counts (admin \+ worker)  
6\. Worker Tasks  
7\. Delivery Partners

\#\#\# Week 3-4: Analytics & Dashboard  
1\. Create AnalyticsController  
2\. Create DashboardController  
3\. Connect Dashboard page  
4\. Connect Labor Productivity page  
5\. Connect Worker Leaderboard

\#\#\# Week 5: Reports  
1\. Create ReportsController  
2\. Create database tables  
3\. Connect Reports page

\#\#\# Week 6: Quality & Anomalies  
1\. Create QualityCheckController  
2\. Create AnomalyController  
3\. Connect respective pages

\#\#\# Week 7: Dock Management  
1\. Create database tables  
2\. Create DockManagementController  
3\. Connect Dock Management page

\#\#\# Week 8+: Cleanup  
1\. Remaining pages (Products, Admins, Notifications)  
2\. Performance optimization  
3\. Testing

\---

\#\# 11\. Estimated Effort

| Phase | Pages | APIs Needed | DB Tables Needed | Estimated Time |  
|-------|-------|-------------|-------------------|----------------|  
| Phase 1 | 7 | 0 (exist) | 0 | 1-2 weeks |  
| Phase 2 | 3 | 8 | 0 | 2 weeks |  
| Phase 3 | 1 | 6 | 2 | 1 week |  
| Phase 4 | 2 | 6 | 0 | 1 week |  
| Phase 5 | 1 | 8 | 3 | 1 week |  
| Phase 6 | 3+ | 3+ | 1 | 1-2 weeks |  
| \*\*Total\*\* | \*\*17+\*\* | \*\*31+\*\* | \*\*6\*\* | \*\*7-9 weeks\*\* |

\---

\#\# 12\. Next Steps

1\. \*\*Immediate Action:\*\* Start Phase 1 (connect existing APIs) \- Quick wins  
2\. \*\*This Week:\*\* Create AnalyticsController and DashboardController  
3\. \*\*Next Week:\*\* Create Reports API and database tables  
4\. \*\*Following Weeks:\*\* Continue with remaining phases

\---

\#\# 13\. Files to Create/Update

\#\#\# Backend Files to Create

\*\*Controllers:\*\*  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/analytics/AnalyticsController.java\`  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/dashboard/DashboardController.java\`  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/reports/ReportsController.java\`  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/quality/QualityCheckController.java\`  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/anomalies/AnomalyController.java\`  
\- \`backend/core-api/src/main/java/com/optiwms/coreapi/dock/DockManagementController.java\`

\*\*Services:\*\*  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/analytics/AnalyticsService.java\`  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/dashboard/DashboardService.java\`  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/reports/ReportsService.java\`  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/quality/QualityCheckService.java\`  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/anomalies/AnomalyService.java\`  
\- \`backend/core-app/src/main/java/com/optiwms/coreapp/dock/DockManagementService.java\`

\*\*Repositories (if needed):\*\*  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/DockDoorRepository.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/DockAppointmentRepository.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/YardTrailerRepository.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/reports/ReportRepository.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/reports/ScheduledReportRepository.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/workers/WorkerAchievementRepository.java\`

\*\*Entities:\*\*  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/DockDoorEntity.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/DockAppointmentEntity.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/dock/YardTrailerEntity.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/reports/ReportEntity.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/reports/ScheduledReportEntity.java\`  
\- \`backend/infra/src/main/java/com/optiwms/infra/workers/WorkerAchievementEntity.java\`

\*\*Domain Models:\*\*  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/dock/DockDoor.java\`  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/dock/DockAppointment.java\`  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/dock/YardTrailer.java\`  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/reports/Report.java\`  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/reports/ScheduledReport.java\`  
\- \`backend/core-domain/src/main/java/com/optiwms/domain/workers/WorkerAchievement.java\`

\*\*Migrations:\*\*  
\- \`backend/infra/src/main/resources/db/migration/V5\_\_dock\_management\_tables.sql\`  
\- \`backend/infra/src/main/resources/db/migration/V6\_\_reports\_tables.sql\`  
\- \`backend/infra/src/main/resources/db/migration/V7\_\_worker\_achievements.sql\`

\#\#\# Frontend Files to Create/Update

\*\*New API Clients:\*\*  
\- \`frontend/lib/api/reports.ts\` \- ❌ MISSING  
\- \`frontend/lib/api/quality-checks.ts\` \- ❌ MISSING  
\- \`frontend/lib/api/anomalies.ts\` \- ❌ MISSING  
\- \`frontend/lib/api/dock-management.ts\` \- ❌ MISSING

\*\*Update Existing API Clients:\*\*  
\- \`frontend/lib/api/analytics.ts\` \- ✅ EXISTS (needs implementation)  
\- \`frontend/lib/api/operations.ts\` \- ✅ EXISTS (verify completeness)  
\- \`frontend/lib/api/shipments.ts\` \- ✅ EXISTS (verify completeness)  
\- \`frontend/lib/api/returns.ts\` \- ✅ EXISTS (verify completeness)  
\- \`frontend/lib/api/delivery-partners.ts\` \- ✅ EXISTS (verify connection)

\*\*Pages to Update (Connect to APIs):\*\*  
\- \`frontend/app/admin/dashboard/page.tsx\` \- Connect to dashboard API  
\- \`frontend/app/admin/labor-productivity/page.tsx\` \- Connect to analytics API  
\- \`frontend/app/admin/reports/page.tsx\` \- Connect to reports API  
\- \`frontend/app/admin/stock-transfers/page.tsx\` \- Connect to operations API  
\- \`frontend/app/admin/shipments/page.tsx\` \- Connect to shipments API  
\- \`frontend/app/admin/returns/page.tsx\` \- Connect to returns API  
\- \`frontend/app/admin/packing/page.tsx\` \- Connect to packing API  
\- \`frontend/app/admin/cycle-counts/page.tsx\` \- Connect to cycle-counts API  
\- \`frontend/app/admin/quality-checks/page.tsx\` \- Connect to quality-checks API  
\- \`frontend/app/admin/anomalies/page.tsx\` \- Connect to anomalies API  
\- \`frontend/app/admin/dock-management/page.tsx\` \- Connect to dock-management API  
\- \`frontend/app/admin/delivery-partners/page.tsx\` \- Connect to delivery-partners API  
\- \`frontend/app/worker/leaderboard/page.tsx\` \- Connect to analytics API  
\- \`frontend/app/worker/packing/page.tsx\` \- Connect to packing API  
\- \`frontend/app/worker/cycle-count/page.tsx\` \- Connect to cycle-counts API  
\- \`frontend/app/worker/stock-transfer/page.tsx\` \- Connect to stock-transfers API  
\- \`frontend/app/worker/shipments/page.tsx\` \- Connect to shipments API  
\- \`frontend/app/worker/returns/page.tsx\` \- Connect to returns API  
\- \`frontend/app/worker/tasks/page.tsx\` \- Connect to tasks API  
\- \`frontend/app/worker/profile/page.tsx\` \- Connect to analytics API for stats

\---

\#\# 14\. Testing Checklist

\#\#\# Phase 1 Testing  
\- \[ \] Stock Transfers API connection (admin \+ worker)  
\- \[ \] Shipments API connection (admin \+ worker)  
\- \[ \] Returns API connection (admin \+ worker)  
\- \[ \] Packing API connection (admin \+ worker)  
\- \[ \] Cycle Counts API connection (admin \+ worker)  
\- \[ \] Tasks API connection (worker)  
\- \[ \] Delivery Partners API connection

\#\#\# Phase 2 Testing  
\- \[ \] Dashboard KPIs display correctly  
\- \[ \] Orders chart shows real data  
\- \[ \] Top products shows real data  
\- \[ \] Inventory overview shows real stats  
\- \[ \] Worker productivity metrics accurate  
\- \[ \] Leaderboard displays correctly  
\- \[ \] Worker stats on profile page

\#\#\# Phase 3 Testing  
\- \[ \] Report generation works  
\- \[ \] Report download works  
\- \[ \] Report scheduling works  
\- \[ \] Custom report creation works

\#\#\# Phase 4 Testing  
\- \[ \] Quality checks CRUD operations  
\- \[ \] Quality check approval/rejection  
\- \[ \] Anomaly listing and filtering  
\- \[ \] Anomaly resolution

\#\#\# Phase 5 Testing  
\- \[ \] Dock door management  
\- \[ \] Appointment scheduling  
\- \[ \] Yard trailer tracking

\---

\#\# 15\. Performance Considerations

\#\#\# Database Indexes  
\- Ensure all foreign keys are indexed  
\- Add indexes for frequently queried fields (status, warehouse\_id, dates)  
\- Consider composite indexes for common query patterns

\#\#\# API Optimization  
\- Use pagination for large datasets  
\- Implement caching for dashboard KPIs  
\- Use database views for complex aggregations  
\- Consider materialized views for heavy analytics queries

\#\#\# Frontend Optimization  
\- Implement pagination for large lists  
\- Use React Query or SWR for data fetching and caching  
\- Lazy load heavy components  
\- Optimize re-renders with React.memo

\---

\#\# 16\. Conclusion

This comprehensive analysis reveals that:  
\- \*\*8 pages\*\* are cu  
