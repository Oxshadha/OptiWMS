# Excel Formulas → Database Values Guide

## ⚠️ **Critical Understanding**

### **You CANNOT Store Excel Formulas in Database**
- Databases store **VALUES** (numbers, text), not **FORMULAS** (calculations)
- Excel formulas like `=SUM(A1:A10)` or `=IF(...)` are calculation instructions
- When you export CSV from Excel, you must export **CALCULATED VALUES**, not formulas

---

## 🔧 **How to Fix This**

### **Step 1: Export CSV with Calculated Values (NOT Formulas)**

**In Excel:**
1. Open `Active stock.csv` in Excel
2. **Select all cells** (Ctrl+A / Cmd+A)
3. **Copy** (Ctrl+C / Cmd+C)
4. **Paste Special** → **Values Only** (Ctrl+Shift+V / Cmd+Shift+V)
   - This converts all formulas to their calculated values
5. **Save As** → CSV format
6. Replace the original `Active stock.csv` file

**OR use Excel's "Save As" with values:**
1. File → Save As
2. Choose "CSV (Comma delimited) (*.csv)"
3. Excel will prompt: "Do you want to keep this format?"
4. Click "Yes" - this saves calculated values, not formulas

---

## 📊 **What Excel Formulas Are in Your CSV?**

Based on the CSV structure, these columns likely have formulas:

### **Calculated Columns (Need Values, Not Formulas):**

1. **Column 9: "Future Average"** 
   - Formula: Probably `=AVERAGE(...)` or similar
   - **Solution**: Export with calculated value (e.g., `88715`)

2. **Column 12: "EX"**
   - Formula: Unknown calculation
   - **Solution**: Export with calculated value

3. **Column 13: "Variance (demand)"**
   - Formula: Probably `=VAR(...)` or variance calculation
   - **Solution**: Export with calculated value

4. **Column 15: "ROP" (Reorder Point)**
   - Formula: Complex calculation based on demand, lead time, safety stock
   - **Solution**: Export with calculated value

5. **Column 16: "ROP in days"**
   - Formula: Probably `=ROP/AVERAGE_DAILY_DEMAND`
   - **Solution**: Export with calculated value

6. **Column 27: "Pallet requirement"**
   - Formula: Probably `=CEILING(QUANTITY/PALLET_CAPACITY,1)`
   - Currently shows `#VALUE!` (formula error) → needs calculated value

---

## 🛠️ **Backend Solution: Calculate Values in Java**

If you want to **calculate these values in the backend** instead of Excel, I can create a calculation service.

**Would you like me to:**
1. ✅ Create a backend service to calculate ROP, Buffer Stock, etc.?
2. ✅ Or just improve CSV parsing to handle all values better?

---

## 🔍 **Current Issue Analysis**

**Why null values exist:**
- CSV has formulas (not values) → Parser can't convert `=SUM(...)` to number → Returns null
- CSV has `#VALUE!` errors → Parser correctly returns null
- CSV has empty cells → Parser correctly returns null

**Solution:**
1. **Export CSV with VALUES** (not formulas) - **RECOMMENDED**
2. **OR** Create backend calculation service to compute these values

---

## 📝 **Next Steps**

**Option A: Fix CSV Export (Easiest)**
1. Open CSV in Excel
2. Convert formulas to values (Paste Special → Values)
3. Save as CSV
4. Re-import via `/api/master/materials/inventory/import`

**Option B: Backend Calculation Service**
1. Tell me what Excel formulas you're using
2. I'll create Java calculation methods
3. Calculate values during import

**Which option do you prefer?**
