# Synthetic Data Generation Guide - Updated for Raw & Packaging Materials Only

## 📋 Overview

This guide has been **updated** to generate synthetic data **only for raw materials and packaging materials**. Product categories (household, personal_care, baby_care) are **removed** as these should be **finished goods** (products), not raw materials.

---

## 🎯 Material Classification

### Current Data Reality
- **Active stock.csv**: Contains only raw materials and packaging materials (factory warehouse data)
- **No finished goods**: Products are not in the dataset

### Classification Rules

#### **Packaging Materials**
Identified by description patterns:
- Contains: `pouch`, `pe back`, `sheet`, `woven`, `paper`, `reel`, `tape`
- Unit type: `Reel`

#### **Raw Materials**
- Everything else (default)

---

## 🔧 Updated Classification Function

### File: `backend/scripts/srilanka_seasonality.py`

**OLD Function** (INCORRECT - categorized raw materials as products):
```python
def get_category_from_description(description: str) -> str:
    # Personal Care
    if any(word in description_lower for word in ['soap', 'cologne', 'shampoo', ...]):
        return 'personal_care'
    # Baby Care
    if any(word in description_lower for word in ['napkin', 'diaper', ...]):
        return 'baby_care'
    # Household Care
    if any(word in description_lower for word in ['detergent', 'cleaner', ...]):
        return 'household'
    # ...
```

**NEW Function** (CORRECT - only raw and packaging):
```python
def get_category_from_description(description: str) -> str:
    """
    Categorize RAW MATERIALS only (not products)
    For synthetic data generation - demand patterns
    """
    description_lower = description.lower()
    
    # Packaging materials
    if any(word in description_lower for word in ['pouch', 'pe back', 'sheet', 'woven', 'paper', 'reel', 'tape']):
        return 'packaging_material'
    
    # Chemical raw materials (for demand forecasting)
    if any(word in description_lower for word in ['caustic', 'carbonate', 'silicate', 'sulphate']):
        return 'chemical_bulk'
    
    # Surfactants
    if any(word in description_lower for word in ['betaine', 'galaxy', 'emal', 'sulphonate']):
        return 'chemical_surfactant'
    
    # Fragrances/essences (raw materials, not finished products)
    if any(word in description_lower for word in ['cologne bulk', 'fragrance', 'essence', 'oil']):
        return 'raw_fragrance'
    
    # Default: raw material
    return 'raw_material'
```

---

## 📊 Synthetic Data Categories

### Valid Categories (Raw & Packaging Only)

| Category | Description | Use Case |
|----------|-------------|----------|
| `packaging_material` | Pouches, sheets, reels, paper | Packaging demand patterns |
| `chemical_bulk` | Bulk chemicals (Caustic Soda, etc.) | Chemical demand patterns |
| `chemical_surfactant` | Surfactants (Galaxy, EMAL, etc.) | Surfactant demand patterns |
| `raw_fragrance` | Bulk fragrances/essences | Fragrance demand patterns |
| `raw_material` | Default for all other raw materials | General raw material patterns |

### Removed Categories (These are Products, Not Raw Materials)

❌ **REMOVED**: `personal_care` - This is a finished product category  
❌ **REMOVED**: `baby_care` - This is a finished product category  
❌ **REMOVED**: `household` - This is a finished product category  
❌ **REMOVED**: `cosmetics` - This is a finished product category  

**Note**: These categories will be used **later** when generating **finished goods** (products) from raw materials via Bill of Materials (BOM).

---

## 🔄 Regeneration Steps

### 1. Update Classification Function

Edit `backend/scripts/srilanka_seasonality.py`:
- Replace `get_category_from_description()` with the new function above

### 2. Regenerate Synthetic Data

```bash
cd backend/scripts
python synthetic_data_generator.py
```

### 3. Verify Output

Check generated CSV files:
- `demand_history_2023_2024.csv` - Should only have `packaging_material`, `chemical_bulk`, `chemical_surfactant`, `raw_fragrance`, `raw_material`
- `inventory_snapshots_2023_2024.csv` - Should only have raw and packaging materials
- `multi_item_orders_2023_2024.csv` - Should only have raw and packaging materials

### 4. Import to Database

```bash
# Import materials (raw and packaging only)
curl -X POST http://localhost:8080/api/master/materials/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Resources/DataBase Resources/Item code and descriptions.csv"

# Import inventory
curl -X POST http://localhost:8080/api/master/materials/inventory/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Resources/DataBase Resources/Active stock.csv"
```

---

## ✅ Validation Checklist

- [ ] Classification function updated in `srilanka_seasonality.py`
- [ ] Synthetic data regenerated
- [ ] All categories are `raw_material` or `packaging_material` variants
- [ ] No `personal_care`, `baby_care`, `household`, or `cosmetics` categories
- [ ] Database materials have correct `material_type` (`raw_material` or `packaging_material`)
- [ ] Inventory items have correct `material_type` populated

---

## 🚀 Future: Product Generation

When ready to generate **finished goods** (products):

1. **Create Bill of Materials (BOM)** table
2. **Analyze raw materials** → determine what products can be made
3. **Generate product materials** (e.g., "Soap Bar 100g", "Shampoo 250ml")
4. **Link via BOM** (e.g., "Soap Bar" requires: Caustic Soda, Glycerine, Fragrance)
5. **Categorize products** (not raw materials):
   - Products get categories: `household`, `personal_care`, `baby_care`
   - Raw materials stay as `raw_material` or `packaging_material`

---

## 📝 Notes

- **Current Focus**: Raw materials and packaging materials warehouse
- **Future Enhancement**: Add finished goods warehouse with products
- **Data Integrity**: All synthetic data must match actual CSV data structure
- **Material Type**: Always set correctly in both `materials` and `inventory` tables
