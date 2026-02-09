# Test Data Generation & Frontend Integration Plan

## ✅ Completed

### 1. Quantity Integer Conversion
- Database migration V8 created and applied
- All backend code updated to use Integer quantities
- Frontend updated to display integers
- All compilation errors fixed

### 2. Test Data Generation Backend
- Extended `SyntheticDataGenerator` to create:
  - Orders (inbound and outbound) with order items
  - Tasks (picking, putaway, packing)
- Added API endpoints:
  - `POST /api/integration/synthetic/orders`
  - `POST /api/integration/synthetic/tasks`
  - `POST /api/integration/synthetic/all-with-operations`
- Created `generate-test-data.sh` script

## 📋 Next Steps

### Step 1: Generate Test Data (Option B)

Run the test data generation script:
```bash
cd backend
./generate-test-data.sh
```

This will create:
- 15 suppliers, 10 delivery partners, 30 customers
- 10 inbound orders + 15 outbound orders (with order items)
- 20 picking tasks + 15 putaway tasks + 10 packing tasks

### Step 2: Verify Test Data

Test the Analytics APIs with real data:
```bash
# Check dashboard KPIs
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis" | jq

# Check worker productivity (should have data now)
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly" | jq

# Check leaderboard (should have data now)
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly" | jq

# Check orders chart
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=monthly" | jq
```

### Step 3: Frontend Integration (Option A)

#### 3.1 Analytics/Dashboard Page
**File**: `frontend/app/(admin)/dashboard/page.tsx`

**Tasks**:
- [ ] Connect to `/api/analytics/dashboard/kpis`
- [ ] Connect to `/api/analytics/dashboard/inventory-overview`
- [ ] Connect to `/api/analytics/dashboard/top-products`
- [ ] Connect to `/api/analytics/dashboard/orders-chart`
- [ ] Replace mock data with real API calls
- [ ] Add loading states and error handling

#### 3.2 Reports Page
**File**: `frontend/app/admin/reports/page.tsx` (if exists)

**Tasks**:
- [ ] Connect to `/api/reports` (GET all reports)
- [ ] Connect to `/api/reports/generate` (POST generate report)
- [ ] Connect to `/api/reports/custom` (POST custom report)
- [ ] Connect to `/api/reports/schedule` (POST schedule report)
- [ ] Connect to `/api/reports/scheduled` (GET scheduled reports)
- [ ] Add report download functionality
- [ ] Add report scheduling UI

#### 3.3 Dock Management Page
**File**: `frontend/app/admin/dock-management/page.tsx` (if exists)

**Tasks**:
- [ ] Connect to `/api/dock/doors` (GET all dock doors)
- [ ] Connect to `/api/dock/appointments` (GET/POST appointments)
- [ ] Connect to `/api/dock/yard-trailers` (GET/POST yard trailers)
- [ ] Add dock door status management
- [ ] Add appointment scheduling UI
- [ ] Add yard trailer tracking

#### 3.4 Update All Pages for Integer Quantities
**Files**: All frontend pages displaying quantities

**Tasks**:
- [ ] Verify all quantity displays use `Math.ceil()` or integer formatting
- [ ] Update any remaining decimal displays
- [ ] Test all quantity-related operations

## 🎯 Recommended Order

1. **First**: Generate test data (Step 1) - This gives you data to work with
2. **Second**: Verify APIs work with test data (Step 2) - Confirm everything is working
3. **Third**: Start frontend integration (Step 3) - Begin with Dashboard/Analytics page

## 📝 API Endpoints Summary

### Test Data Generation
- `POST /api/integration/synthetic/all` - Generate master data
- `POST /api/integration/synthetic/orders` - Generate orders
- `POST /api/integration/synthetic/tasks` - Generate tasks
- `POST /api/integration/synthetic/all-with-operations` - Generate everything

### Analytics APIs
- `GET /api/analytics/dashboard/kpis` - Dashboard KPIs
- `GET /api/analytics/dashboard/inventory-overview` - Inventory overview
- `GET /api/analytics/dashboard/top-products` - Top products
- `GET /api/analytics/dashboard/orders-chart` - Orders chart data
- `GET /api/analytics/worker-productivity` - Worker productivity
- `GET /api/analytics/leaderboard` - Worker leaderboard
- `GET /api/analytics/workers/{id}/stats` - Worker stats
- `GET /api/analytics/workers/{id}/achievements` - Worker achievements

### Reports APIs
- `GET /api/reports` - List all reports
- `POST /api/reports/generate` - Generate report
- `POST /api/reports/custom` - Create custom report
- `POST /api/reports/schedule` - Schedule report
- `GET /api/reports/scheduled` - List scheduled reports

### Dock Management APIs
- `GET /api/dock/doors` - List dock doors
- `POST /api/dock/doors` - Create dock door
- `GET /api/dock/appointments` - List appointments
- `POST /api/dock/appointments` - Create appointment
- `GET /api/dock/yard-trailers` - List yard trailers
- `POST /api/dock/yard-trailers` - Create yard trailer

## 🚀 Quick Start

1. **Generate test data**:
   ```bash
   cd backend
   ./generate-test-data.sh
   ```

2. **Verify it worked**:
   ```bash
   curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis" | jq
   ```

3. **Start frontend integration** - Begin with the Dashboard page

## 📌 Notes

- All quantities are now integers (rounded up from demand forecasts)
- Test data uses realistic distributions for Sri Lankan WMS
- Orders include order items with integer quantities
- Tasks are linked to orders where applicable
- Workers are randomly assigned to tasks

