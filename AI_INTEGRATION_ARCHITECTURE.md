# AI Integration Architecture

## Overview

OptiWMS is designed to work **fluently without AI services**, with AI services as **optional enhancements** that can be integrated incrementally.

---

## Core Principle: **Graceful Degradation**

```
┌─────────────────────────────────────┐
│         Core WMS Operations         │
│  (Works 100% without AI)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      AI Service Adapter              │
│  (Centralized Integration Point)      │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
┌──────────┐   ┌──────────────┐
│   AI     │   │   Rule-Based │
│ Service  │   │   Fallback    │
│(Optional)│   │  (Always)    │
└──────────┘   └──────────────┘
```

---

## Architecture Components

### 1. **AIServiceAdapter** (Centralized)
- **Location:** `backend/core-app/operations/AIServiceAdapter.java`
- **Purpose:** Single point of integration for all AI services
- **Features:**
  - Non-blocking calls (2-second timeout)
  - Automatic fallback to rules
  - Health checking
  - Configurable enable/disable

### 2. **LocationSuggestionService** (Business Logic)
- **Location:** `backend/core-app/operations/LocationSuggestionService.java`
- **Purpose:** Location suggestion with AI fallback
- **Flow:**
  1. Try AI service (if enabled)
  2. Fall back to industry-standard rules
  3. Always returns a suggestion

### 3. **Rule-Based Fallback** (Industry Standards)
- **Consolidation:** Same material → same location
- **Zone-Based:** Fast-moving → high-accessibility
- **First Available:** FIFO for empty locations
- **Capacity Check:** Prevent overfilling

---

## AI Services Planned

### 1. Demand Forecasting (with Seasonality)
- **When:** During receiving, validate quantities
- **Fallback:** Accept all quantities
- **Integration:** `ReceivingService`

### 2. Min-Max Inventory Suggesting
- **When:** Inventory review, reorder suggestions
- **Fallback:** Manual reorder point management
- **Integration:** `InventoryService`

### 3. Optimal Storage (Genetic Algorithm)
- **When:** Putaway location suggestion
- **Fallback:** Rule-based location assignment
- **Integration:** `LocationSuggestionService` ✅ **IMPLEMENTED**

### 4. Optimal Picking/Putaway Paths
- **When:** Task sequencing for workers
- **Fallback:** Location code sorting
- **Integration:** `TaskService`

### 5. Procurement Agent Workflow
- **When:** ERP sends product → suggest storage decision
- **Fallback:** Manual review and decision
- **Integration:** `ReceivingService`, `OrderService`

---

## Configuration

### Enable AI Services

**application.yml:**
```yaml
ai:
  services:
    enabled: true  # Set to true when AI services available
    base-url: http://localhost:8081
    timeout: 2000  # milliseconds (non-blocking)
```

### Service Health Check

System automatically checks AI service health:
- **Available:** Uses AI suggestions
- **Unavailable:** Falls back to rules immediately
- **Timeout:** Falls back after 2 seconds
- **Error:** Logs warning, continues with rules

---

## API Contracts

### Location Suggestion API

**Endpoint:** `POST /api/operations/putaway/suggest-location`

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

**Response (without AI):**
```json
{
  "suggestedLocation": "A-01-01-01",
  "reason": "Same material consolidation - existing location",
  "aiEnhanced": false
}
```

---

## Industry Best Practices Applied

1. ✅ **Separation of Concerns:** AI logic separate from core WMS
2. ✅ **Fail-Safe Design:** Always works without AI
3. ✅ **Centralized Integration:** Single adapter for all AI services
4. ✅ **Non-Blocking:** AI calls don't block core operations
5. ✅ **Observable:** Logs AI usage and fallback events
6. ✅ **Configurable:** Easy to enable/disable AI services
7. ✅ **Incremental:** AI services can be added one at a time

---

## Implementation Status

### ✅ Completed
- [x] AI Service Adapter (centralized)
- [x] Location Suggestion Service with fallback
- [x] Rule-based location assignment
- [x] API endpoint for location suggestion
- [x] Configuration for AI services
- [x] Health checking mechanism

### 🔄 To Be Implemented
- [ ] Demand Forecasting integration
- [ ] Min-Max Inventory integration
- [ ] Optimal Picking Path integration
- [ ] Procurement Agent integration
- [ ] AI service caching
- [ ] Metrics and analytics

---

## Testing Scenarios

### Scenario 1: AI Available
1. Request location suggestion
2. AI service responds with suggestion
3. **Expected:** AI suggestion used, `aiEnhanced: true`

### Scenario 2: AI Unavailable
1. Request location suggestion
2. AI service times out or unavailable
3. **Expected:** Rule-based suggestion used, `aiEnhanced: false`

### Scenario 3: AI Service Fails Mid-Operation
1. Receiving operation in progress
2. AI service fails
3. **Expected:** Operation continues with rule-based fallback

---

## Future Enhancements

1. **Caching:** Cache AI suggestions for similar scenarios
2. **Retry Logic:** Retry AI calls with exponential backoff
3. **Metrics:** Track AI vs rule-based performance
4. **A/B Testing:** Compare AI suggestions vs manual decisions
5. **Feedback Loop:** Learn from worker overrides of AI suggestions
6. **Circuit Breaker:** Prevent cascading failures

---

## Migration Path

### Phase 1: Core WMS (Current)
- ✅ Complete WMS flow without AI
- ✅ Rule-based location assignment
- ✅ All operations functional

### Phase 2: AI Integration (Incremental)
- Add AI services one at a time
- Test each service independently
- Monitor performance and fallback rates

### Phase 3: Optimization
- Fine-tune AI algorithms
- Implement caching and optimization
- Add analytics and reporting

---

## Key Takeaways

1. **WMS works 100% without AI** - No dependency on AI services
2. **AI is enhancement, not requirement** - Optional optimization layer
3. **Centralized integration** - Easy to add new AI services
4. **Industry-standard fallback** - Uses proven WMS rules
5. **Incremental adoption** - Add AI services one at a time
