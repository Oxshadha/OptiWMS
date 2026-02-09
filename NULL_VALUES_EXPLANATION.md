# Why Some Inventory Fields Show Null Values

## Understanding Null Values in Inventory Table

### **Why Null Values Exist:**

1. **CSV Data Quality:**
   - Some columns in `Active stock.csv` have empty cells
   - Excel error values like `#VALUE!` cannot be parsed as numbers (these become null)
   - Example: Column 27 (Pallet Requirement) often has `#VALUE!` in the CSV

2. **Data Not Available:**
   - Some planning fields may not be calculated for all materials
   - Empty cells in CSV = null in database (this is correct behavior)

3. **Existing Records:**
   - Records created before V20 migration don't have the new planning fields
   - These will be populated when CSV is re-imported

### **Fields That May Be Null:**

- **Pallet Requirement** (Column 27): Often `#VALUE!` in CSV → null in DB ✅
- **Min Stock**: Not in CSV → null ✅
- **Variance Fields**: May be empty for some materials → null ✅
- **Order Delivery/Quantity**: May not be set for all items → null ✅

### **How to Fix Null Values:**

1. **Re-import CSV:**
   ```bash
   # The CSV importer will update existing records with all available data
   POST /api/master/materials/inventory/import
   ```

2. **Manual Update:**
   - Use the inventory edit modal to fill in missing values
   - Or update via API

3. **Accept Nulls:**
   - Null values are valid - they mean "no data available"
   - The frontend displays "—" for null values (this is correct)

### **CSV Parsing Improvements:**

The parser now handles:
- ✅ Spaces: `" 88,715 "` → `88715`
- ✅ Commas: `" 116,865 "` → `116865`
- ✅ Negative in parentheses: `" (78,715)"` → `-78715`
- ✅ Excel errors: `#VALUE!` → `null` (correct)
- ✅ Empty cells: `""` → `null` (correct)

### **Best Practice:**

**Null values are expected and correct** when:
- CSV has empty cells
- CSV has Excel error values (`#VALUE!`, `#N/A`)
- Field is not applicable to that material
- Data hasn't been calculated yet

The system displays "—" for null values, which is the industry standard for "no data available".
