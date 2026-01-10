# OptiWMS API Documentation

Simple API reference for core WMS operations.

## Base URL
```
http://localhost:8080/api
```

## Authentication
All endpoints (except `/auth/login`) require JWT token in header:
```
Authorization: Bearer <access_token>
```

---

## Core Operations Flow

### 1. Purchase Order (PO) → Receiving (GRN)

#### Get Order by Number
```
GET /operations/receiving/order/{orderNumber}
```
**Purpose:** Get order details for receiving

#### Receive Order
```
POST /operations/receiving/receive
```
**Body:**
```json
{
  "orderNumber": "PO-001",
  "items": [
    {
      "materialId": "uuid",
      "quantity": "10",
      "locationCode": ""
    }
  ]
}
```
**Purpose:** Record received items, creates inventory, triggers putaway task

---

### 2. Putaway

#### Get Putaway Tasks
```
GET /tasks?type=putaway&status=pending
```
**Purpose:** List pending putaway tasks

#### Complete Putaway
```
POST /operations/putaway/complete/{taskId}
```
**Body:**
```json
{
  "locationCode": "A-01-01-01",
  "lpn": "LPN-001"
}
```
**Purpose:** Complete putaway, updates inventory location

---

### 3. Picking

#### Get Picking Tasks
```
GET /tasks?type=picking&status=pending
```
**Purpose:** List pending picking tasks

#### Complete Picking
```
POST /operations/picking/complete/{taskId}
```
**Body:**
```json
{
  "pickedQuantity": 10,
  "locationCode": "A-01-01-01"
}
```
**Purpose:** Complete picking, updates inventory

---

### 4. Dispatch

#### Get Orders Ready for Dispatch
```
GET /orders?status=picked&type=outbound
```
**Purpose:** List orders ready for dispatch

#### Create Shipment
```
POST /operations/shipments
```
**Body:**
```json
{
  "orderId": "uuid",
  "carrier": "FedEx",
  "trackingNumber": "TRACK-001"
}
```
**Purpose:** Create shipment for dispatch

---

## Location Services

### Suggest Putaway Location
```
POST /operations/locations/suggest-putaway
```
**Body:**
```json
{
  "warehouseId": "uuid",
  "materialId": "uuid",
  "quantity": 10,
  "materialType": "pallet"
}
```
**Response:**
```json
{
  "suggestedLocation": "A-01-01-01",
  "reason": "First available location",
  "aiEnhanced": false
}
```
**Purpose:** Get location suggestion (falls back to rules if AI unavailable)

---

## Master Data

### Warehouses
```
GET    /master/warehouses          # List all
GET    /master/warehouses/{id}     # Get one
POST   /master/warehouses          # Create
PUT    /master/warehouses/{id}     # Update
DELETE /master/warehouses/{id}     # Delete
```

### Materials
```
GET    /master/materials           # List all
GET    /master/materials/{id}      # Get one
POST   /master/materials           # Create
PUT    /master/materials/{id}      # Update
```

### Locations
```
GET    /master/locations           # List all
GET    /master/locations/{code}     # Get by code
POST   /master/locations           # Create
PUT    /master/locations/{id}      # Update
```

---

## Inventory

```
GET    /inventory                  # List all
GET    /inventory/warehouse/{id}   # By warehouse
GET    /inventory/material/{id}    # By material
POST   /inventory                  # Create/Update
```

---

## Tasks

```
GET    /tasks                      # List (with filters)
GET    /tasks/{id}                 # Get one
POST   /tasks                      # Create
PUT    /tasks/{id}                 # Update
PUT    /tasks/{id}/assign          # Assign worker
```

**Query Params:**
- `type`: putaway, picking, packing
- `status`: pending, in_progress, completed
- `assignedTo`: worker UUID

---

## Orders

```
GET    /orders                     # List all
GET    /orders/{id}                # Get one
GET    /orders/number/{number}     # Get by number
POST   /orders                     # Create
PUT    /orders/{id}/status         # Update status
```

---

## Authentication

```
POST   /auth/login                 # Login
POST   /auth/refresh               # Refresh token
GET    /auth/me                    # Get current user
POST   /auth/logout                # Logout
```

---

## AI Services (Optional)

### Demand Forecast
```
GET /ai-services/demand-forecasting/forecast?materialId={id}&period=30d
```

### Optimal Storage
```
POST /ai-services/optimal-storage/suggest
Body: { "warehouseId": "uuid", "materialId": "uuid", "quantity": 10 }
```

### Optimal Picking Path
```
POST /ai-services/optimal-picking-path/suggest
Body: { "warehouseId": "uuid", "taskIds": ["uuid1", "uuid2"] }
```

**Note:** All AI services are optional. System works without them using fallback rules.
