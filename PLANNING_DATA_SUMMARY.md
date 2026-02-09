# Planning Data Storage & Display - Quick Summary

## ✅ **What's Already Stored**

### **Materials Table** (Material-Level)
- ✅ Lead time (months & days)
- ✅ Future average
- ✅ Expected value (EX)
- ✅ Variance (demand & lead time)
- ✅ ROP (Reorder Point) in days
- ✅ Buffer days
- ✅ Order delivery days
- ✅ Order quantity
- ✅ Pallet requirement
- ✅ MOQ (Minimum Order Quantity)

### **Inventory Table** (Warehouse-Specific)
- ✅ Buffer stock
- ✅ Max stock
- ✅ Min stock
- ✅ Reorder point (ROP)
- ✅ Stacking quantity
- ✅ MOQ
- ✅ Lead time days

### **Supply Plans Table** (EXISTS but not used)
- ✅ Table structure created
- ❌ No entity/repository
- ❌ CSV importer doesn't save data

---

## 📊 **Where Data Should Be Shown**

### **Admin Users**
**Pages to Create/Enhance**:
1. `/admin/materials/{id}/planning` - Material planning details
   - Show all material-level planning fields
   - Show supply plan chart (monthly forecasts)
   - Show all warehouses' inventory planning

2. `/admin/inventory` - Enhanced view
   - Add columns: ROP, Buffer Stock, MOQ, Lead Time
   - Add filters: Below ROP, Low Stock
   - Show reorder alerts

3. `/admin/procurement` - New page (optional)
   - Items below ROP
   - Reorder recommendations
   - Supply plan overview

### **Warehouse Manager**
**Pages**:
1. `/admin/inventory` - Filtered to their warehouse
   - Show: Current stock, ROP, Buffer stock
   - Alerts: Below ROP, Low stock
   - Hide: Material-level planning (not relevant)

---

## 🏭 **Industry Standard (SAP, Oracle, Manhattan)**

### **Data Storage Pattern**
```
Materials Table
  ├─ Material-level defaults (lead time, MOQ, etc.)
  └─ Used across all warehouses

Inventory Table  
  ├─ Warehouse-specific overrides (different ROP per warehouse)
  └─ Current stock levels

Supply Plans Table
  ├─ Monthly forecasts (time-series)
  └─ Material + Warehouse + Period
```

### **Display Pattern**
- **Admin**: Full access to all planning data + forecasts
- **Warehouse Manager**: Only their warehouse's inventory + reorder points
- **Procurement**: Reorder alerts + supply plans

---

## 🔧 **What Needs to Be Done**

### **Priority 1: Fix Supply Plans Storage**
1. Create `SupplyPlanEntity` (JPA entity)
2. Create `SupplyPlanRepository`
3. Update `CsvDataImporter` to save supply plans
4. Test import with CSV data

### **Priority 2: Expose Planning Fields in Frontend**
1. Add planning fields to Material DTO
2. Create material planning detail page
3. Show supply plan charts (monthly)
4. Add reorder alerts to inventory page

### **Priority 3: Role-Based Views**
1. Filter inventory by warehouse for warehouse managers
2. Show/hide fields based on role
3. Add procurement dashboard (optional)

---

## 📝 **Quick Answer to Your Questions**

**Q: Are these columns stored in database?**
**A**: ✅ YES - Most are stored in `materials` and `inventory` tables. Supply plans table exists but data isn't being saved.

**Q: Where to store them?**
**A**: 
- Material-level: `materials` table ✅
- Warehouse-specific: `inventory` table ✅
- Monthly forecasts: `supply_plans` table (exists, needs implementation) ⚠️

**Q: Should they be shown to admin/warehouse manager?**
**A**: 
- **Admin**: ✅ YES - Full planning view with all fields + forecasts
- **Warehouse Manager**: ✅ YES - But only their warehouse's inventory + reorder points

**Q: How should it be handled?**
**A**: 
- Material planning: Show in material detail page
- Inventory planning: Show in inventory table (add columns)
- Supply plans: Show as charts in planning view

**Q: What do existing systems do?**
**A**: Same pattern - Material-level defaults, warehouse-specific overrides, separate supply plans table for forecasts.
