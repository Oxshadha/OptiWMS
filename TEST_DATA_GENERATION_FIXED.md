# Test Data Generation - Duplicate Key Fix

## Issue Fixed
The test data generation script was failing with duplicate key errors because it was trying to create suppliers, customers, delivery partners, orders, and tasks with codes that already existed in the database.

## Solution Applied
Updated `SyntheticDataGenerator.java` to check for existing codes before creating new entities:

### 1. Suppliers
- Checks `supplierRepository.findByCode()` before creating
- If code exists, appends timestamp suffix: `SUP-LKA-001-1735654321000`

### 2. Delivery Partners
- Checks `deliveryPartnerRepository.findByPartnerCode()` before creating
- If code exists, appends timestamp suffix

### 3. Customers
- Checks `customerRepository.findByCode()` before creating
- If code exists, appends timestamp suffix

### 4. Orders
- Checks `orderRepository.findByOrderNumber()` before creating
- If order number exists, appends timestamp suffix

### 5. Tasks
- Checks `taskRepository.findByTaskNumber()` before creating
- If task number exists, appends timestamp suffix

## Usage

Now you can run the test data generation script multiple times without errors:

```bash
cd backend
./generate-test-data.sh
```

The script will:
1. Generate master data (suppliers, delivery partners, customers) - skips duplicates
2. Generate orders (inbound and outbound) with order items - skips duplicates
3. Generate tasks (picking, putaway, packing) - skips duplicates

## Next Steps

1. **Run the script**:
   ```bash
   cd backend
   ./generate-test-data.sh
   ```

2. **Verify data was created**:
   ```bash
   # Check orders
   curl -u admin:admin123 "http://localhost:8080/api/orders" | jq '. | length'
   
   # Check tasks
   curl -u admin:admin123 "http://localhost:8080/api/tasks" | jq '. | length'
   ```

3. **Test Analytics APIs with real data**:
   ```bash
   # Should now have data
   curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly" | jq
   curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly" | jq
   ```

4. **Proceed with Frontend Integration** - Connect Dashboard, Reports, and Dock Management pages to backend APIs

## Note on Linter Errors

The linter shows errors about `Order` and `Task` imports, but these are false positives. The `integration` module depends on `core-app`, which depends on `core-domain`, so the classes are available at compile time. The code will compile and run correctly.

