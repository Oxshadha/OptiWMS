# Warehouse Status: "active"

## What "active" Means

In OptiWMS, `active` is a **status field** for warehouses that indicates:

- ✅ Warehouse is operational
- ✅ Can receive inventory
- ✅ Can ship orders
- ✅ Workers can be assigned
- ✅ All operations are enabled

## Default Warehouses (All Active)

From the seed data (`V2__seed_initial_data.sql`):

1. **WH-001** - Colombo Main Warehouse (Colombo, Sri Lanka) - `active`
2. **WH-002** - Kandy Distribution Center (Kandy, Sri Lanka) - `active`
3. **WH-003** - Galle Warehouse (Galle, Sri Lanka) - `active`

## Other Possible Status Values

Based on the schema, warehouse status can be:
- `active` - Fully operational
- `inactive` - Temporarily disabled
- `maintenance` - Under maintenance
- `closed` - Permanently closed

## Check Warehouse Status via API

```bash
# Get all warehouses
curl -u admin:admin123 http://localhost:8080/api/master/warehouses

# Expected response:
# [
#   {
#     "id": "...",
#     "code": "WH-001",
#     "name": "Colombo Main Warehouse",
#     "status": "active"
#   },
#   ...
# ]
```

## Check Database Directly

```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT code, name, status FROM warehouses;"
```

Expected output:
```
   code   |            name             | status 
----------+-----------------------------+--------
 WH-001   | Colombo Main Warehouse      | active
 WH-002   | Kandy Distribution Center   | active
 WH-003   | Galle Warehouse             | active
```

