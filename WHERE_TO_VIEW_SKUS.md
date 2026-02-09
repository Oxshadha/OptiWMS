# 📦 Where to View SKUs in Admin Panel

**SKU** (Stock Keeping Unit) is also called **Material Code** in OptiWMS. Here's where you can view and manage SKUs for each product/material:

---

## 🎯 Main Locations to View SKUs

### 1. **Materials Page** (Primary Location)
**Path**: `/admin/materials`

**What you'll see:**
- **Product Code** column - This is the SKU/Material Code
- **Description** - Product name/description
- **Type** - Material type (raw_material, product, packing_material)
- All materials in the system

**How to access:**
1. Go to Admin Panel
2. Click on **"Materials"** in the sidebar
3. View the **"Product Code"** column (this is the SKU)

**Features:**
- ✅ Search by Material Code (SKU)
- ✅ Filter by material type
- ✅ Click on any material to see details
- ✅ Create/Edit materials and their SKUs

---

### 2. **Inventory Page** (Stock Levels with SKUs)
**Path**: `/admin/inventory`

**What you'll see:**
- **SKU** column - Material Code for each inventory item
- **Name** - Product description
- **Quantity** - Current stock levels
- **Location** - Where items are stored
- **Status** - Item status

**How to access:**
1. Go to Admin Panel
2. Click on **"Inventory"** in the sidebar
3. View the **"SKU"** column

**Features:**
- ✅ Search by SKU or name
- ✅ Filter by category, type, status
- ✅ Click on SKU to see item details
- ✅ View actual stock quantities per SKU
- ✅ See location of each SKU

---

### 3. **Orders Pages** (SKUs in Orders)

#### Inbound Orders
**Path**: `/admin/orders/inbound`

**What you'll see:**
- Order details with items
- Each item shows Material Code (SKU)
- Quantity ordered per SKU

#### Outbound Orders
**Path**: `/admin/orders/outbound`

**What you'll see:**
- Order details with items
- Each item shows Material Code (SKU)
- Quantity to ship per SKU

---

## 🔍 How to Search for a Specific SKU

### In Materials Page:
1. Go to `/admin/materials`
2. Use the search box at the top
3. Type the Material Code (SKU) you're looking for
4. Results will filter automatically

### In Inventory Page:
1. Go to `/admin/inventory`
2. Use the search box
3. Type SKU or product name
4. Results will show matching items

---

## 📊 Understanding SKU vs Material ID

**Important Distinction:**
- **SKU / Material Code**: Human-readable code (e.g., "MAT-12345", "PROD-001")
- **Material ID**: Internal UUID (e.g., "7262019d-8f3a-4b2c-9e1d-5a7b3c4d6e8f")

**In the Admin Panel:**
- You'll see **Material Code** (SKU) - this is what you use
- **Material ID** is hidden (used internally by the system)

---

## ✅ Quick Reference

| Location | Path | What Shows |
|----------|------|------------|
| **Materials** | `/admin/materials` | All SKUs (Material Codes) with descriptions |
| **Inventory** | `/admin/inventory` | SKUs with stock quantities and locations |
| **Inbound Orders** | `/admin/orders/inbound` | SKUs in purchase orders |
| **Outbound Orders** | `/admin/orders/outbound` | SKUs in sales orders |

---

## 🎯 Recommended Workflow

**To find a SKU for a product:**
1. **Start with Materials Page** (`/admin/materials`)
   - Search by description or Material Code
   - Find the product you need
   - Note the **Product Code** (this is the SKU)

2. **Check Inventory** (`/admin/inventory`)
   - Search by the SKU you found
   - See current stock levels
   - Check locations where it's stored

3. **Use in Operations**
   - Use the Material Code (SKU) in receiving, picking, etc.
   - The system will look it up automatically

---

## 💡 Tips

- **SKU Format**: Material Codes can be alphanumeric (e.g., "MAT-12345", "PROD-001")
- **Search**: You can search by partial SKU (e.g., typing "MAT" will show all SKUs starting with "MAT")
- **Case Sensitive**: Search is case-insensitive
- **Unique**: Each Material Code (SKU) is unique in the system

---

**Last Updated**: January 2026
