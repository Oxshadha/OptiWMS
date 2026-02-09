# How to Generate Realistic Storage Locations

## Quick Start

### Step 1: Get Your Warehouse ID

```sql
SELECT id, name, code 
FROM warehouses;
```

### Step 2: Generate Locations via API

**Endpoint**: `POST /api/integration/locations/generate/{warehouseId}`

**Using curl**:
```bash
curl -X POST http://localhost:8080/api/integration/locations/generate/7262019d-9bf4-4824-997c-d7b5c9158ef3 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Using Postman/Thunder Client**:
- Method: POST
- URL: `http://localhost:8080/api/integration/locations/generate/{warehouseId}`
- Headers: `Authorization: Bearer YOUR_TOKEN`

**Response**:
```json
{
  "success": true,
  "message": "Generated 2550 realistic storage locations with zones A, B, C, D",
  "locationCount": 2550
}
```

### Step 3: Verify in Database

```sql
-- Check zone distribution
SELECT 
    area,
    COUNT(*) as locations,
    MIN(accessibility_rating) as min_access,
    MAX(accessibility_rating) as max_access
FROM locations
WHERE zone_type = 'STORAGE'
  AND area IN ('A', 'B', 'C', 'D')
GROUP BY area
ORDER BY area;
```

**Expected Output**:
```
area | locations | min_access | max_access
-----|-----------|------------|------------
A    | 60        | 9          | 10
B    | 240       | 6          | 8
C    | 1800      | 4          | 6
D    | 450       | 1          | 3
```

### Step 4: View in 2D Map

1. Open warehouse admin page
2. Select your warehouse
3. View 2D map
4. Should see zones A, B, C, D with proper structure

---

## What Gets Created

### Zone A (High Accessibility)
- **60 locations** in format: `A-01-01-1-A` to `A-01-05-4-C`
- **Accessibility**: 9-10
- **For**: ABC-A items (fast movers)

### Zone B (Medium Accessibility)
- **240 locations** in format: `B-01-01-1-A` to `B-02-08-5-C`
- **Accessibility**: 6-8
- **For**: ABC-B items (medium movers)

### Zone C (Main Storage) ⭐
- **1,800 locations** in format: `C-01-01-1-A` to `C-10-12-5-C`
- **Accessibility**: 4-6
- **For**: ABC-C items and general storage
- **Most locations** - this is your main storage area

### Zone D (Low Accessibility)
- **450 locations** in format: `D-01-01-1-A` to `D-03-10-5-C`
- **Accessibility**: 1-3
- **For**: Slow movers, bulk storage

**Total**: 2,550 storage locations

---

## Location Code Examples

All locations follow format: `{AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}`

**Zone A**:
- `A-01-01-1-A`
- `A-01-01-2-B`
- `A-01-05-4-C`

**Zone C** (Main Storage):
- `C-01-01-1-A`
- `C-05-08-3-B`
- `C-10-12-5-C`

**Zone D**:
- `D-01-01-1-A`
- `D-02-07-4-B`
- `D-03-10-5-C`

---

## Notes

- **Only generates missing zones**: If Zone A already exists, it won't regenerate
- **Idempotent**: Safe to run multiple times
- **Generalized**: Works for any warehouse type
- **ABC/FMS Ready**: Structure supports future classification

---

## Troubleshooting

### Error: "403 Forbidden"
- **Solution**: Make sure you're using an ADMIN role token
- Check SecurityConfig allows `/api/integration/**` for ADMIN

### Error: "Warehouse not found"
- **Solution**: Verify warehouse ID is correct
- Check warehouses table

### Zones already exist
- **Solution**: Generator will skip existing zones
- To regenerate, delete existing locations first (if needed)

---

## Next: Use for ABC/FMS

Once locations are generated:

1. **Classify materials** by ABC/FMS
2. **Assign to zones**:
   - ABC-A → Zone A
   - ABC-B → Zone B
   - ABC-C → Zone C or D
3. **Use for optimal storage suggestions**
4. **Use coordinates for path finding**

---

**Ready to generate!** 🚀
