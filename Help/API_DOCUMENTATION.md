# API Documentation

This document describes all API endpoints in the OptiWMS backend.

## Base URL
```
Development: http://localhost:8080
Production: [To be configured]
```

## Authentication

### Current Implementation
- **Type**: HTTP Basic Authentication
- **Default Credentials**:
  - Admin: `admin` / `admin123`
  - Worker: `worker` / `worker123`

### Request Format
```http
Authorization: Basic base64(username:password)
```

### Example
```javascript
const auth = btoa("admin:admin123");
fetch(url, {
  headers: {
    Authorization: `Basic ${auth}`
  }
});
```

## API Endpoints

### Master Data

#### Warehouses

##### GET /api/master/warehouses
Get list of all warehouses.

**Response:**
```json
[
  {
    "id": 1,
    "code": "WH-001",
    "name": "Main Warehouse",
    "status": "ACTIVE"
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

**Frontend Usage:**
```typescript
import { fetchWarehouses } from '@/lib/api';

const warehouses = await fetchWarehouses();
```

---

## API Structure

### Endpoint Naming Convention
- **Base Path**: `/api`
- **Resource Group**: `/master`, `/operations`, `/reports`, etc.
- **Resource**: Plural nouns (e.g., `warehouses`, `orders`, `items`)
- **Actions**: Use HTTP methods (GET, POST, PUT, DELETE)

### Standard Endpoints Pattern

#### List Resources
```
GET /api/{resource-group}/{resource}
```
Example: `GET /api/master/warehouses`

#### Get Single Resource
```
GET /api/{resource-group}/{resource}/{id}
```
Example: `GET /api/master/warehouses/1`

#### Create Resource
```
POST /api/{resource-group}/{resource}
Content-Type: application/json

{
  "field1": "value1",
  "field2": "value2"
}
```

#### Update Resource
```
PUT /api/{resource-group}/{resource}/{id}
Content-Type: application/json

{
  "field1": "updated_value"
}
```

#### Delete Resource
```
DELETE /api/{resource-group}/{resource}/{id}
```

## Planned Endpoints

### Master Data
- [ ] `GET /api/master/warehouses` ✅ (Implemented)
- [ ] `POST /api/master/warehouses`
- [ ] `PUT /api/master/warehouses/{id}`
- [ ] `DELETE /api/master/warehouses/{id}`
- [ ] `GET /api/master/locations`
- [ ] `GET /api/master/items`
- [ ] `GET /api/master/customers`

### Operations
- [ ] `GET /api/operations/orders`
- [ ] `POST /api/operations/orders`
- [ ] `GET /api/operations/orders/{id}`
- [ ] `PUT /api/operations/orders/{id}/status`
- [ ] `GET /api/operations/tasks`
- [ ] `POST /api/operations/tasks/assign`
- [ ] `GET /api/operations/tasks/{id}/path` (Optimal path)
- [ ] `POST /api/operations/picking/scan`
- [ ] `POST /api/operations/putaway/scan`

### Inventory
- [ ] `GET /api/inventory/items`
- [ ] `GET /api/inventory/items/{id}/stock`
- [ ] `POST /api/inventory/cycle-count`
- [ ] `GET /api/inventory/cycle-count/{id}/anomalies`

### Worker PWA
- [ ] `GET /api/worker/tasks`
- [ ] `GET /api/worker/tasks/{id}`
- [ ] `POST /api/worker/tasks/{id}/start`
- [ ] `POST /api/worker/tasks/{id}/complete`
- [ ] `POST /api/worker/tasks/{id}/scan`
- [ ] `GET /api/worker/tasks/{id}/optimal-path`
- [ ] `POST /api/worker/sync` (Offline sync)

### AI Services
- [ ] `POST /api/ai/demand-forecast`
- [ ] `GET /api/ai/inventory-optimization`
- [ ] `POST /api/ai/storage-suggestions`
- [ ] `POST /api/ai/path-optimization`
- [ ] `GET /api/ai/anomalies/database`
- [ ] `GET /api/ai/anomalies/clustering`

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `CONFLICT` - Resource conflict
- `INTERNAL_ERROR` - Server error

## Rate Limiting
(To be implemented)
- Default: 100 requests per minute per IP
- Authenticated: 1000 requests per minute per user

## Versioning
(To be implemented)
- Current: v1 (implicit)
- Future: `/api/v2/...`

## Frontend Integration

### API Client Location
`frontend/lib/api.ts`

### Adding New API Functions
```typescript
// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function fetchResource() {
  const res = await fetch(`${API_BASE}/api/resource`, {
    cache: "no-store",
    headers: {
      Authorization: "Basic " + btoa("admin:admin123"),
    },
  });
  if (!res.ok) throw new Error("Failed to load resource");
  return res.json();
}
```

### Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Testing Endpoints

### Using cURL
```bash
# Get warehouses
curl -u admin:admin123 http://localhost:8080/api/master/warehouses

# With JSON
curl -u admin:admin123 \
  -H "Content-Type: application/json" \
  -X POST http://localhost:8080/api/master/warehouses \
  -d '{"code":"WH-002","name":"Warehouse 2","status":"ACTIVE"}'
```

### Using Postman/Insomnia
1. Set Authorization: Basic Auth
2. Username: `admin`
3. Password: `admin123`
4. Base URL: `http://localhost:8080`

## Backend Implementation

### Controller Structure
```java
@RestController
@RequestMapping("/api/master/warehouses")
public class WarehouseController {
    
    @GetMapping
    public ResponseEntity<List<WarehouseDto>> list() {
        // Implementation
    }
    
    @PostMapping
    public ResponseEntity<WarehouseDto> create(@RequestBody CreateWarehouseRequest request) {
        // Implementation
    }
}
```

### DTO Pattern
- Use DTOs for API responses
- Separate request/response DTOs
- Use validation annotations

## Documentation Updates

**When adding new endpoints:**
1. Update this file with endpoint details
2. Add request/response examples
3. Update frontend `api.ts` if needed
4. Document in team chat/PR description

---

**Last Updated**: [Date]
**Maintained By**: Backend Team

