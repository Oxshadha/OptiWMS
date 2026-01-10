# Tasks Page Testing Guide

## ✅ Status: 100% Connected to Backend

The Tasks page (`/admin/tasks`) is now fully connected to the backend API with **zero mock data**.

## 🧪 How to Test

### Prerequisites
1. **Backend must be running**: `cd backend && ./gradlew bootRun`
2. **Database must be populated** with test data (use `./generate-test-data-safe.sh`)

### Test Commands

#### 1. Test Tasks API
```bash
# Get all tasks
curl -u admin:admin http://localhost:8080/api/tasks | jq

# Get tasks by status
curl -u admin:admin "http://localhost:8080/api/tasks?status=pending" | jq
curl -u admin:admin "http://localhost:8080/api/tasks?status=in_progress" | jq
curl -u admin:admin "http://localhost:8080/api/tasks?status=completed" | jq

# Get tasks by type
curl -u admin:admin "http://localhost:8080/api/tasks?taskType=picking" | jq
curl -u admin:admin "http://localhost:8080/api/tasks?taskType=putaway" | jq
```

#### 2. Test Workers/Users API
```bash
# Get all users
curl -u admin:admin http://localhost:8080/api/users | jq

# Get workers by role (for task assignment)
curl -u admin:admin "http://localhost:8080/api/users?role=picker" | jq
curl -u admin:admin "http://localhost:8080/api/users?role=packer" | jq
curl -u admin:admin "http://localhost:8080/api/users?role=forklift_operator" | jq
curl -u admin:admin "http://localhost:8080/api/users?role=unloading_worker" | jq
curl -u admin:admin "http://localhost:8080/api/users?role=cycle_count_worker" | jq
```

#### 3. Test Warehouses API
```bash
# Get all warehouses
curl -u admin:admin http://localhost:8080/api/master/warehouses | jq
```

#### 4. Test Task Creation
```bash
# First, get a warehouse ID
WAREHOUSE_ID=$(curl -s -u admin:admin http://localhost:8080/api/master/warehouses | jq -r '.[0].id')

# Create a task
curl -u admin:admin -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"taskNumber\": \"TEST-TASK-$(date +%s)\",
    \"taskType\": \"picking\",
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"priority\": \"normal\",
    \"status\": \"pending\",
    \"notes\": \"Test task\"
  }" | jq
```

#### 5. Test Task Status Update
```bash
# Get a task ID
TASK_ID=$(curl -s -u admin:admin http://localhost:8080/api/tasks | jq -r '.[0].id')

# Update task status
curl -u admin:admin -X PUT "http://localhost:8080/api/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}' | jq
```

## 🎯 Frontend Testing

### Manual UI Tests

1. **Open Tasks Page**: Navigate to `http://localhost:3000/admin/tasks`

2. **Verify Data Loading**:
   - ✅ Tasks list should display (no loading spinner stuck)
   - ✅ Worker names should show (not "Unassigned" for all)
   - ✅ Warehouse names should show (not "Unknown")
   - ✅ Summary cards should show correct counts

3. **Test Create Task Modal**:
   - Click "Create Task" button
   - ✅ Warehouse dropdown should show real warehouses (not "Warehouse 1", "Warehouse 2")
   - ✅ Worker dropdown (when manual assignment selected) should show real workers
   - ✅ Create a task and verify it appears in the list

4. **Test Filters**:
   - Filter by task type (picking, putaway, etc.)
   - Filter by status (pending, in_progress, completed)
   - ✅ Filters should work correctly

5. **Test Task Details**:
   - Click on a task to view details
   - ✅ All information should be displayed correctly

## 📊 Expected Results

### ✅ All Connected:
- **Task List**: Fetches from `/api/tasks`
- **Task Creation**: Posts to `/api/tasks`
- **Worker Selection**: Fetches from `/api/users?role=...`
- **Warehouse Selection**: Fetches from `/api/master/warehouses`
- **User Data**: Fetches from `/api/users`
- **Warehouse Data**: Fetches from `/api/master/warehouses`

### ❌ No Mock Data:
- ✅ No `mockWorkers` array
- ✅ No hardcoded warehouse IDs
- ✅ All data comes from API calls

## 🐛 Troubleshooting

### Backend Not Running
```bash
cd backend
./gradlew bootRun
```

### No Data Showing
```bash
# Generate test data
cd backend
./generate-test-data-safe.sh
```

### API Errors
- Check backend logs for errors
- Verify database is running
- Check authentication credentials (admin/admin)

## ✅ Success Criteria

All tests pass when:
1. ✅ Tasks page loads without errors
2. ✅ Task list displays real data from database
3. ✅ Create Task modal shows real warehouses and workers
4. ✅ Task creation works and new task appears in list
5. ✅ No console errors in browser
6. ✅ All API calls return 200 status codes

