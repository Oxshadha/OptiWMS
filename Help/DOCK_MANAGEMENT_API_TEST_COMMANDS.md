# Dock Management API Test Commands

## Prerequisites

1. **Backend must be running:**
   ```bash
   cd backend
   ./gradlew :core-api:bootRun
   ```

2. **Database must be running:**
   ```bash
   cd infra
   docker-compose up -d db
   ```

3. **Get a warehouse ID first** (needed for most operations):
   ```bash
   curl -u admin:admin123 http://localhost:8080/api/master/warehouses | jq '.[0].id'
   ```
   Save this UUID for use in the commands below.

---

## Dock Doors API

### 1. Get All Dock Doors
```bash
# Get all doors
curl -u admin:admin123 http://localhost:8080/api/dock-management/doors

# Get doors for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/dock-management/doors?warehouseId=YOUR_WAREHOUSE_ID"
```

### 2. Get Dock Door by ID
```bash
curl -u admin:admin123 http://localhost:8080/api/dock-management/doors/DOCK_DOOR_ID
```

### 3. Create Dock Door
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "doorNumber": "DOCK-01",
    "warehouseId": "YOUR_WAREHOUSE_ID",
    "location": "North Side",
    "status": "available"
  }' \
  http://localhost:8080/api/dock-management/doors
```

### 4. Update Dock Door
```bash
curl -X PUT -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "doorNumber": "DOCK-01",
    "warehouseId": "YOUR_WAREHOUSE_ID",
    "location": "North Side - Updated",
    "status": "occupied",
    "currentAppointmentId": null
  }' \
  http://localhost:8080/api/dock-management/doors/DOCK_DOOR_ID
```

---

## Dock Appointments API

### 1. Get All Appointments
```bash
# Get all appointments
curl -u admin:admin123 http://localhost:8080/api/dock-management/appointments

# Get appointments for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/dock-management/appointments?warehouseId=YOUR_WAREHOUSE_ID"

# Get appointments by status
curl -u admin:admin123 "http://localhost:8080/api/dock-management/appointments?warehouseId=YOUR_WAREHOUSE_ID&status=scheduled"

# Get appointments by warehouse and status
curl -u admin:admin123 "http://localhost:8080/api/dock-management/appointments?warehouseId=YOUR_WAREHOUSE_ID&status=checked_in"
```

### 2. Get Appointment by ID
```bash
curl -u admin:admin123 http://localhost:8080/api/dock-management/appointments/APPOINTMENT_ID
```

### 3. Create Dock Appointment
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentNumber": "APT-2024-001",
    "dockDoorId": "DOCK_DOOR_ID",
    "warehouseId": "YOUR_WAREHOUSE_ID",
    "appointmentType": "inbound",
    "scheduledStart": "2024-12-31T09:00:00",
    "scheduledEnd": "2024-12-31T11:00:00",
    "supplierId": "SUPPLIER_ID",
    "carrierName": "ABC Logistics",
    "trailerNumber": "TRL-12345",
    "inboundOrderId": "ORDER_ID",
    "notes": "Priority shipment"
  }' \
  http://localhost:8080/api/dock-management/appointments
```

### 4. Check In Appointment
```bash
curl -X POST -u admin:admin123 \
  http://localhost:8080/api/dock-management/appointments/APPOINTMENT_ID/check-in
```

### 5. Check Out Appointment
```bash
curl -X POST -u admin:admin123 \
  http://localhost:8080/api/dock-management/appointments/APPOINTMENT_ID/check-out
```

---

## Yard Trailers API

### 1. Get All Yard Trailers
```bash
# Get all trailers
curl -u admin:admin123 http://localhost:8080/api/dock-management/yard-trailers

# Get trailers for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/dock-management/yard-trailers?warehouseId=YOUR_WAREHOUSE_ID"
```

### 2. Get Yard Trailer by ID
```bash
curl -u admin:admin123 http://localhost:8080/api/dock-management/yard-trailers/TRAILER_ID
```

### 3. Create Yard Trailer
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "trailerNumber": "TRL-67890",
    "warehouseId": "YOUR_WAREHOUSE_ID",
    "carrierName": "XYZ Transport",
    "inboundOrderId": "ORDER_ID",
    "supplierId": "SUPPLIER_ID",
    "status": "waiting",
    "assignedDockDoorId": null
  }' \
  http://localhost:8080/api/dock-management/yard-trailers
```

---

## Complete Test Workflow

### Step 1: Get Warehouse ID
```bash
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')
echo "Warehouse ID: $WAREHOUSE_ID"
```

### Step 2: Create a Dock Door
```bash
DOOR_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"doorNumber\": \"DOCK-01\",
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"location\": \"North Side\",
    \"status\": \"available\"
  }" \
  http://localhost:8080/api/dock-management/doors)

DOOR_ID=$(echo $DOOR_RESPONSE | jq -r '.id')
echo "Dock Door ID: $DOOR_ID"
```

### Step 3: Create an Appointment
```bash
APPT_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"appointmentNumber\": \"APT-$(date +%s)\",
    \"dockDoorId\": \"$DOOR_ID\",
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"appointmentType\": \"inbound\",
    \"scheduledStart\": \"2024-12-31T09:00:00\",
    \"scheduledEnd\": \"2024-12-31T11:00:00\",
    \"carrierName\": \"Test Carrier\",
    \"trailerNumber\": \"TRL-TEST-001\",
    \"status\": \"scheduled\"
  }" \
  http://localhost:8080/api/dock-management/appointments)

APPT_ID=$(echo $APPT_RESPONSE | jq -r '.id')
echo "Appointment ID: $APPT_ID"
```

### Step 4: Check In Appointment
```bash
curl -X POST -u admin:admin123 \
  http://localhost:8080/api/dock-management/appointments/$APPT_ID/check-in | jq
```

### Step 5: Check Out Appointment
```bash
curl -X POST -u admin:admin123 \
  http://localhost:8080/api/dock-management/appointments/$APPT_ID/check-out | jq
```

### Step 6: Create Yard Trailer
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"trailerNumber\": \"TRL-$(date +%s)\",
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"carrierName\": \"Test Carrier\",
    \"status\": \"waiting\"
  }" \
  http://localhost:8080/api/dock-management/yard-trailers | jq
```

---

## Pretty Print with jq

Add `| jq` to any command for formatted JSON output:

```bash
curl -u admin:admin123 http://localhost:8080/api/dock-management/doors | jq
```

---

## Error Testing

### Test Invalid Door Creation (duplicate door number)
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "doorNumber": "DOCK-01",
    "warehouseId": "YOUR_WAREHOUSE_ID",
    "location": "South Side",
    "status": "available"
  }' \
  http://localhost:8080/api/dock-management/doors
# Should return 400 Bad Request
```

### Test Not Found
```bash
curl -u admin:admin123 \
  http://localhost:8080/api/dock-management/doors/00000000-0000-0000-0000-000000000000
# Should return 404 Not Found
```

---

## Quick Health Check

```bash
# Check if backend is running
curl http://localhost:8080/actuator/health

# Should return: {"status":"UP"}
```

---

## Notes

- **Authentication:** Uses Basic Auth with `admin:admin123` (default credentials)
- **UUIDs:** Replace `YOUR_WAREHOUSE_ID`, `DOCK_DOOR_ID`, etc. with actual UUIDs from your database
- **Dates:** Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss`
- **jq:** Install with `brew install jq` (Mac) or `apt-get install jq` (Linux) for pretty JSON output

---

## Example Response Formats

### Dock Door Response:
```json
{
  "id": "uuid-here",
  "doorNumber": "DOCK-01",
  "warehouseId": "uuid-here",
  "location": "North Side",
  "status": "available",
  "currentAppointmentId": null
}
```

### Dock Appointment Response:
```json
{
  "id": "uuid-here",
  "appointmentNumber": "APT-2024-001",
  "dockDoorId": "uuid-here",
  "warehouseId": "uuid-here",
  "appointmentType": "inbound",
  "scheduledStart": "2024-12-31T09:00:00",
  "scheduledEnd": "2024-12-31T11:00:00",
  "actualStart": null,
  "actualEnd": null,
  "inboundOrderId": null,
  "outboundOrderId": null,
  "supplierId": null,
  "carrierName": "ABC Logistics",
  "trailerNumber": "TRL-12345",
  "status": "scheduled",
  "notes": "Priority shipment"
}
```

### Yard Trailer Response:
```json
{
  "id": "uuid-here",
  "trailerNumber": "TRL-67890",
  "warehouseId": "uuid-here",
  "carrierName": "XYZ Transport",
  "inboundOrderId": null,
  "supplierId": null,
  "arrivedAt": "2024-12-30T14:00:00",
  "waitTimeMinutes": null,
  "status": "waiting",
  "assignedDockDoorId": null
}
```

