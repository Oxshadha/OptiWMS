# WMS Complete Flow Documentation

## End-to-End Flow: PO → GRN → Putaway → Picking → Dispatch

This document describes the complete warehouse management flow and how it works with or without AI services.

---

## Flow Overview

```
┌─────────────┐
│ Purchase    │
│ Order (PO)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Receiving    │ ← AI: Demand Forecast (optional)
│ (GRN)       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Putaway     │ ← AI: Optimal Storage (optional)
│             │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Picking     │ ← AI: Optimal Path (optional)
│             │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Dispatch    │
│ (Shipment)  │
└─────────────┘
```

---

## 1. Purchase Order (PO) → Receiving (GRN)

### Step 1.1: PO Created
- **Source:** ERP System or Manual Entry
- **API:** `POST /api/orders`
- **Status:** `pending`

### Step 1.2: Receiving Process
**Worker Action:**
1. Scan/Enter PO Number
2. System fetches order: `GET /api/operations/receiving/order/{orderNumber}`
3. Worker enters received quantities
4. Submit: `POST /api/operations/receiving/receive`

**What Happens:**
- ✅ Order status → `received`
- ✅ Inventory created/updated
- ✅ Putaway task automatically created
- ✅ **AI Enhancement (Optional):** Demand forecast checked for quantity validation

**Without AI:**
- System works normally
- No demand forecast validation
- Standard receiving process

---

## 2. Putaway

### Step 2.1: Putaway Task Created
- **Trigger:** Automatically after receiving
- **Status:** `pending`
- **Contains:** Material, quantity, warehouse

### Step 2.2: Location Suggestion

**API:** `POST /api/operations/putaway/suggest-location`

**Request:**
```json
{
  "warehouseId": "uuid",
  "materialId": "uuid",
  "quantity": 10,
  "materialType": "pallet"
}
```

**Response (with AI):**
```json
{
  "suggestedLocation": "A-01-01-01",
  "reason": "AI-optimized: High turnover item, near entrance",
  "aiEnhanced": true
}
```

**Response (without AI - fallback):**
```json
{
  "suggestedLocation": "A-01-01-01",
  "reason": "Same material consolidation - existing location",
  "aiEnhanced": false
}
```

### Step 2.3: Location Selection Rules (Fallback)

When AI unavailable, system uses industry-standard rules:

1. **Consolidation Rule:** Same material → same location (if capacity available)
2. **Zone-Based Rule:** Fast-moving items → high-accessibility locations
3. **First Available:** FIFO for empty locations
4. **Capacity Check:** Avoid overfilling locations

### Step 2.4: Complete Putaway

**Worker Action:**
1. Scan LPN (License Plate Number)
2. Scan/Select location (suggestion shown, can override)
3. Submit: `POST /api/operations/putaway/complete/{taskId}`

**What Happens:**
- ✅ Task status → `completed`
- ✅ Inventory location updated
- ✅ Material ready for picking

---

## 3. Picking

### Step 3.1: Picking Task Created
- **Trigger:** Outbound order created
- **Status:** `pending`
- **Contains:** Material, quantity, source location

### Step 3.2: Optimal Path Suggestion (Optional)

**AI Service:** `POST /ai-services/optimal-picking-path/suggest`

**Request:**
```json
{
  "warehouseId": "uuid",
  "taskIds": ["task1", "task2", "task3"]
}
```

**Response:**
```json
{
  "optimalPath": ["A-01-01-01", "A-02-03-02", "B-01-01-01"],
  "estimatedTime": 15,
  "distance": 120
}
```

**Without AI:**
- System uses location code sorting (A→Z)
- Worker follows natural warehouse flow
- No path optimization

### Step 3.3: Complete Picking

**Worker Action:**
1. View picking tasks
2. Follow suggested path (if AI available) or natural flow
3. Scan location, pick quantity
4. Submit: `POST /api/operations/picking/complete/{taskId}`

**What Happens:**
- ✅ Task status → `completed`
- ✅ Inventory quantity reduced
- ✅ Order status → `picked`
- ✅ Ready for packing

---

## 4. Dispatch

### Step 4.1: Packing (Optional Step)
- Pack items into boxes
- Generate packing slip
- Create shipment

### Step 4.2: Create Shipment

**API:** `POST /api/operations/shipments`

**Request:**
```json
{
  "orderId": "uuid",
  "carrier": "FedEx",
  "trackingNumber": "TRACK-001"
}
```

### Step 4.3: Dispatch
- Shipment status → `shipped`
- Order status → `dispatched`
- Tracking information updated

---

## AI Services Integration

### Architecture Pattern: **Adapter with Fallback**

```
┌─────────────────┐
│  Core WMS       │
│  Service        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Adapter     │ ← Centralized AI integration
│  (Optional)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────┐
│  AI  │  │Rules │
│Service│  │Fallback│
└──────┘  └──────┘
```

### Key Principles:

1. **Non-Blocking:** AI calls timeout after 2 seconds
2. **Graceful Degradation:** Always falls back to rules
3. **Centralized:** All AI calls go through `AIServiceAdapter`
4. **Optional:** System works 100% without AI

---

## AI Services Planned

### 1. Demand Forecasting (with Seasonality)
- **When Used:** During receiving, validate quantities
- **Fallback:** No validation, accept all quantities
- **Integration Point:** ReceivingService

### 2. Min-Max Inventory Suggesting
- **When Used:** Inventory review, reorder suggestions
- **Fallback:** Manual reorder point management
- **Integration Point:** InventoryService

### 3. Optimal Storage (Genetic Algorithm)
- **When Used:** Putaway location suggestion
- **Fallback:** Rule-based location assignment
- **Integration Point:** LocationSuggestionService

### 4. Optimal Picking/Putaway Paths
- **When Used:** Task sequencing for workers
- **Fallback:** Location code sorting
- **Integration Point:** TaskService

### 5. Procurement Agent Workflow
- **When Used:** ERP sends product → suggest storage decision
- **Fallback:** Manual review and decision
- **Integration Point:** ReceivingService, OrderService

---

## Configuration

### Enable/Disable AI Services

**application.yml:**
```yaml
ai:
  services:
    enabled: false  # Set to true when AI services available
    base-url: http://localhost:8081
    timeout: 2000  # milliseconds
```

### Service Health Check

System automatically checks AI service health:
- If unavailable → uses fallback immediately
- No blocking or waiting
- Logs warning but continues operation

---

## Industry Best Practices Applied

1. **Separation of Concerns:** AI logic separate from core WMS
2. **Fail-Safe Design:** Always works without AI
3. **Centralized Integration:** Single adapter for all AI services
4. **Non-Blocking:** AI calls don't block core operations
5. **Observable:** Logs AI usage and fallback events
6. **Configurable:** Easy to enable/disable AI services

---

## Testing Scenarios

### Scenario 1: Full Flow with AI
1. PO created → Receiving → AI suggests location → Putaway → AI suggests path → Picking → Dispatch
2. **Expected:** AI suggestions used, system works optimally

### Scenario 2: Full Flow without AI
1. PO created → Receiving → Rule-based location → Putaway → Natural path → Picking → Dispatch
2. **Expected:** System works normally, no AI suggestions

### Scenario 3: AI Service Fails Mid-Operation
1. Receiving → AI call times out → Rule-based location → Putaway
2. **Expected:** Graceful fallback, operation continues

---

## Future Enhancements

1. **Caching:** Cache AI suggestions for similar scenarios
2. **Retry Logic:** Retry AI calls with exponential backoff
3. **Metrics:** Track AI vs rule-based performance
4. **A/B Testing:** Compare AI suggestions vs manual decisions
5. **Feedback Loop:** Learn from worker overrides of AI suggestions
