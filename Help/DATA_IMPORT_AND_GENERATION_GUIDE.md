# Data Import and Synthetic Generation Guide

## 📋 Overview

This guide provides step-by-step instructions for importing actual CSV data and generating synthetic data aligned with Sri Lankan context and actual material codes.

---

## 1. Actual Data Import (Priority 1)

### 1.1 Material Data Import

**Source:** `Item code and descriptions.csv`

**Fields to Import:**
- `Material Code` → `materialCode` (unique, indexed)
- `Description` → `description`

**SQL Import Script:**
```sql
-- Create temporary table
CREATE TEMP TABLE temp_materials (
    material_code VARCHAR(50),
    description TEXT
);

-- Import CSV (using COPY or INSERT)
COPY temp_materials FROM '/path/to/Item code and descriptions.csv' 
WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Insert into materials table
INSERT INTO materials (id, material_code, description, created_at)
SELECT 
    gen_random_uuid(),
    material_code,
    description,
    NOW()
FROM temp_materials
ON CONFLICT (material_code) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW();
```

**Java Service:**
```java
@Service
public class MaterialImportService {
    
    public void importMaterials(String csvPath) {
        // Parse CSV
        // Create Material entities
        // Set materialCode and description
        // Save to database
    }
}
```

---

### 1.2 Inventory Data Import

**Source:** `Active stock.csv`

**Key Fields:**
- Material Code → Link to materials
- Unit Type (Bags, Drum, Reel, Can, Box) → `unitType`
- Buffer stock → `bufferStock`
- Maximum stock → `maxStock`
- Stacking quantity → `stackingQuantity`
- MOQ → `moq`
- Lead time days → `leadTimeDays`
- ROP → `reorderPoint`

**Import Strategy:**
1. Parse CSV row by row
2. Find Material by materialCode
3. Create InventoryItem for each warehouse
4. Set quantities and planning fields

**Note:** CSV has quantities but no warehouse/location assignment - assign synthetically

---

### 1.3 Supply Plan Data Import

**Source:** `Active stock.csv` (monthly columns: Jul SP, Aug SP, Sep SP, Oct SP, Nov SP)

**Structure:**
```sql
INSERT INTO supply_plans (id, material_id, warehouse_id, plan_year, plan_month, planned_quantity)
VALUES 
    (gen_random_uuid(), material_id, warehouse_id, 2024, 7, jul_quantity),
    (gen_random_uuid(), material_id, warehouse_id, 2024, 8, aug_quantity),
    -- etc.
```

**Import Logic:**
- Parse monthly supply plan columns
- Create SupplyPlan records for each month
- Link to Material by materialCode
- Assign to warehouse(s) synthetically

---

### 1.4 Non-Moving Items Import

**Source:** `Non Moving items.csv`

**Fields:**
- Material Code → Link to materials
- Flag as non-moving
- Set last_movement_date to NULL or old date
- Calculate days_since_last_movement

**SQL:**
```sql
INSERT INTO non_moving_items (id, material_id, warehouse_id, flagged_at, status)
SELECT 
    gen_random_uuid(),
    m.id,
    w.id,
    NOW(),
    'flagged'
FROM materials m
CROSS JOIN warehouses w
WHERE m.material_code IN (
    SELECT material_code FROM temp_non_moving
);
```

---

### 1.5 Storage Type Import

**Source:** `Raw matrilas not store in pallets.csv`

**Fields:**
- Material Code → Link to materials
- Set `requires_pallet = FALSE`
- Set `storage_location_type = 'tank'` or `'third_party'`
- Add notes about storage method

**SQL:**
```sql
UPDATE materials
SET 
    requires_pallet = FALSE,
    storage_location_type = 'tank',
    storage_type = 'bulk'
WHERE material_code IN (
    SELECT material_code FROM temp_non_pallet_materials
);
```

---

## 2. Synthetic Data Generation (Sri Lankan Context)

### 2.1 Warehouse Generation

**Template:**
```java
public Warehouse generateWarehouse(String name, String city) {
    Warehouse w = new Warehouse();
    w.setCode("WH-" + city.substring(0, 3).toUpperCase() + "-001");
    w.setName(name);
    w.setCity(city);
    w.setCountry("Sri Lanka");
    w.setAddress(generateSriLankanAddress(city));
    w.setPhone(generateSriLankanPhone());
    w.setEmail(generateEmail(name));
    w.setContactPerson(generateSriLankanName());
    w.setStatus("active");
    return w;
}
```

**Sri Lankan Cities:**
- Colombo
- Kandy
- Galle
- Negombo
- Kurunegala
- Jaffna
- Anuradhapura
- Ratnapura

**Address Format:**
```
{Street Number} {Street Name}
{Area Name}
{City} {Postal Code}
Sri Lanka
```

**Phone Format:**
- +94-XX-XXXXXXX
- Examples: +94-11-2345678, +94-81-2234567

**Example Warehouses:**
1. "Colombo Main Warehouse" - Colombo
2. "Kandy Distribution Center" - Kandy
3. "Galle Storage Facility" - Galle
4. "Negombo Logistics Hub" - Negombo

---

### 2.2 Supplier Generation

**Template:**
```java
public Supplier generateSupplier(String name, String city) {
    Supplier s = new Supplier();
    s.setCode("SUP-" + generateCode());
    s.setName(name);
    s.setCity(city);
    s.setCountry("Sri Lanka");
    s.setContactPerson(generateSriLankanName());
    s.setEmail(generateEmail(name));
    s.setPhone(generateSriLankanPhone());
    s.setLeadTimeDays(randomBetween(30, 90));
    s.setRating(calculateRating(leadTime, quality));
    s.setStatus("active");
    return s;
}
```

**Sri Lankan Company Name Patterns:**
- "{Name} (Pvt) Ltd"
- "{Name} Industries"
- "{Name} Trading Company"
- "{Name} Suppliers"

**Examples:**
- "Colombo Chemical Suppliers (Pvt) Ltd"
- "Kandy Raw Materials Industries"
- "Galle Packaging Trading Company"

**Rating Calculation:**
- Based on lead time: 30 days = 5.0, 60 days = 4.0, 90 days = 3.0
- Adjust based on quality metrics

---

### 2.3 Customer Generation

**Template:**
```java
public Customer generateCustomer(String name, String city) {
    Customer c = new Customer();
    c.setCode("CUST-" + generateCode());
    c.setName(name);
    c.setCity(city);
    c.setCountry("Sri Lanka");
    c.setEmail(generateEmail(name));
    c.setPhone(generateSriLankanPhone());
    c.setAddress(generateSriLankanAddress(city));
    c.setPriorityTier(calculateTier(lifetimeValue));
    c.setLifetimeValue(calculateLifetimeValue());
    c.setStatus("active");
    return c;
}
```

**Priority Tier Calculation:**
- GOLD: Lifetime value > 10,000,000 LKR
- SILVER: Lifetime value 5,000,000 - 10,000,000 LKR
- BRONZE: Lifetime value < 5,000,000 LKR

**Examples:**
- "Colombo Retail Chain (Pvt) Ltd" - GOLD
- "Kandy Supermarket" - SILVER
- "Galle Local Store" - BRONZE

---

### 2.4 User/Worker Generation

**Template:**
```java
public User generateWorker(String firstName, String lastName, String role) {
    User u = new User();
    u.setEmployeeId("EMP-" + generateEmployeeNumber());
    u.setUsername(generateUsername(firstName, lastName));
    u.setFirstName(firstName);
    u.setLastName(lastName);
    u.setEmail(generateEmail(firstName + "." + lastName));
    u.setPhone(generateSriLankanPhone());
    u.setRole(role);
    u.setWarehouseId(assignToWarehouse());
    u.setStatus("active");
    return u;
}
```

**Sri Lankan Name Patterns:**
- Sinhala: "Nimal Perera", "Kamani Silva", "Dilshan Fernando"
- Tamil: "Arun Kumar", "Priya Devi", "Suresh Raj"
- English: "John Smith", "Mary Johnson", "David Brown"

**Employee ID Format:**
- EMP-2045, EMP-2046, etc. (sequential)

**Roles (from SOP):**
- forklift_operator
- stacker_operator
- powered_pallet_truck_operator
- unloading_worker
- cycle_count_worker
- picker
- packer
- shipment_worker
- returns_worker
- vehicle_inspector
- warehouse_safekeeping_worker

---

### 2.5 Location Generation

**Pattern:** A-01-01-4-A (Area-Row-Bay-Level-Bin)

**Template:**
```java
public Location generateLocation(Warehouse warehouse, String area, int row, int bay, int level, String bin) {
    Location loc = new Location();
    loc.setWarehouseId(warehouse.getId());
    loc.setLocationCode(String.format("%s-%02d-%02d-%d-%s", area, row, bay, level, bin));
    loc.setArea(area);
    loc.setRowNumber(String.format("%02d", row));
    loc.setBayNumber(String.format("%02d", row));
    loc.setLevelNumber(level);
    loc.setBinPosition(bin);
    loc.setLocationType("storage");
    loc.setIsActive(true);
    return loc;
}
```

**Generation Rules:**
- Areas: A, B, C, D (storage), R (reserve)
- Rows: 01-50
- Bays: 01-20
- Levels: 1-4
- Bins: A, B, C

**Example Locations per Warehouse:**
- 4 areas × 50 rows × 20 bays × 4 levels × 3 bins = 48,000 potential locations
- Generate 200-500 active locations per warehouse

---

### 2.6 Order Generation

**Template:**
```java
public Order generateOrder(Customer customer, Warehouse warehouse, List<Material> materials) {
    Order o = new Order();
    o.setOrderNumber("ORD-" + LocalDate.now().getYear() + "-" + generateSequence());
    o.setOrderType("outbound");
    o.setCustomerId(customer.getId());
    o.setWarehouseId(warehouse.getId());
    o.setStatus("pending");
    o.setPriority(calculatePriority(customer));
    o.setOrderDate(LocalDate.now());
    o.setExpectedDate(LocalDate.now().plusDays(7));
    
    // Generate order items from actual materials
    for (Material material : materials) {
        OrderItem item = new OrderItem();
        item.setMaterialId(material.getId());
        item.setQuantity(calculateQuantity(material)); // Based on MOQ
        item.setStatus("pending");
        o.addItem(item);
    }
    
    return o;
}
```

**Quantity Calculation:**
- Use MOQ from actual inventory data
- Multiply by random factor (1-5x MOQ)
- Ensure quantities are realistic

**Order Status Distribution:**
- 30% pending
- 20% received
- 20% picking
- 15% packed
- 10% shipped
- 5% delivered

---

## 3. Data Generation Service

### 3.1 Complete Generation Service

```java
@Service
public class SyntheticDataGenerator {
    
    @Autowired
    private MaterialRepository materialRepository;
    
    @Autowired
    private WarehouseRepository warehouseRepository;
    
    public void generateAll() {
        // 1. Generate Warehouses (4-6 warehouses)
        List<Warehouse> warehouses = generateWarehouses();
        
        // 2. Generate Suppliers (10-15 suppliers)
        List<Supplier> suppliers = generateSuppliers();
        
        // 3. Generate Customers (20-30 customers)
        List<Customer> customers = generateCustomers();
        
        // 4. Generate Locations (200-500 per warehouse)
        for (Warehouse w : warehouses) {
            generateLocations(w, 300);
        }
        
        // 5. Generate Users/Workers (10-20 per warehouse)
        for (Warehouse w : warehouses) {
            generateWorkers(w, 15);
        }
        
        // 6. Assign Inventory to Locations
        assignInventoryToLocations(warehouses);
        
        // 7. Generate Orders (50-100 orders)
        generateOrders(customers, warehouses, 75);
        
        // 8. Generate Supply Plans
        generateSupplyPlans(warehouses);
    }
}
```

---

## 4. Import Order

### 4.1 Step-by-Step Import Process

1. **Import Materials** (from CSV)
   - Parse `Item code and descriptions.csv`
   - Create Material entities
   - Save to database

2. **Import Inventory Data** (from CSV)
   - Parse `Active stock.csv`
   - Link to Materials by materialCode
   - Create InventoryItem records
   - Assign to warehouses synthetically

3. **Import Supply Plans** (from CSV)
   - Parse monthly columns from `Active stock.csv`
   - Create SupplyPlan records
   - Link to Materials and Warehouses

4. **Flag Non-Moving Items** (from CSV)
   - Parse `Non Moving items.csv`
   - Create NonMovingItem records
   - Update inventory status

5. **Update Storage Types** (from CSV)
   - Parse `Raw matrilas not store in pallets.csv`
   - Update Material storage_type
   - Set requires_pallet = false

6. **Generate Synthetic Warehouses**
   - Create 4-6 warehouses
   - Use Sri Lankan cities and addresses

7. **Generate Synthetic Suppliers**
   - Create 10-15 suppliers
   - Link to materials via supplier_product_link

8. **Generate Synthetic Customers**
   - Create 20-30 customers
   - Assign priority tiers

9. **Generate Locations**
   - Create 200-500 locations per warehouse
   - Follow A-XX-XX-X-X pattern

10. **Generate Users/Workers**
    - Create 10-20 workers per warehouse
    - Assign roles based on SOP

11. **Assign Inventory to Locations**
    - Distribute inventory across locations
    - Follow material type and storage requirements

12. **Generate Orders**
    - Create 50-100 orders
    - Use actual materials
    - Realistic quantities based on MOQ

13. **Generate Supply Plans**
    - Create monthly plans for next 6 months
    - Based on actual supply plan data

---

## 5. Validation Rules

### 5.1 Data Validation

**Materials:**
- ✅ All material codes must be unique
- ✅ All material codes must be 6 digits
- ✅ Descriptions must not be empty

**Inventory:**
- ✅ Quantity must be >= 0
- ✅ Available quantity <= quantity
- ✅ Reserved quantity <= quantity
- ✅ Buffer stock <= max stock
- ✅ MOQ > 0

**Locations:**
- ✅ Location codes must be unique per warehouse
- ✅ Must follow A-XX-XX-X-X pattern
- ✅ All components must be valid (area, row, bay, level, bin)

**Orders:**
- ✅ Order numbers must be unique
- ✅ Quantities must be > 0
- ✅ Must reference valid materials
- ✅ Must reference valid customers/warehouses

---

## 6. Testing Data

### 6.1 Test Data Sets

**Small Test Set:**
- 10 materials
- 1 warehouse
- 5 suppliers
- 10 customers
- 50 locations
- 10 workers
- 20 orders

**Medium Test Set:**
- 100 materials
- 2 warehouses
- 10 suppliers
- 20 customers
- 200 locations
- 20 workers
- 50 orders

**Full Production Set:**
- All materials from CSV (300+)
- 4-6 warehouses
- 15 suppliers
- 30 customers
- 1000+ locations
- 50+ workers
- 100+ orders

---

## 7. Sri Lankan Context Examples

### 7.1 Address Examples

```
Colombo:
123 Galle Road
Colombo 03
Sri Lanka

Kandy:
45 Peradeniya Road
Kandy
Sri Lanka

Galle:
78 Church Street
Galle
Sri Lanka
```

### 7.2 Phone Examples

- +94-11-2345678 (Colombo)
- +94-81-2234567 (Kandy)
- +94-91-2234567 (Galle)
- +94-31-2234567 (Negombo)

### 7.3 Company Name Examples

- "Colombo Chemical Industries (Pvt) Ltd"
- "Kandy Raw Materials Suppliers"
- "Galle Packaging Solutions"
- "Negombo Logistics Services"

### 7.4 Name Examples

**Sinhala:**
- Nimal Perera
- Kamani Silva
- Dilshan Fernando
- Priyanka Wijesinghe

**Tamil:**
- Arun Kumar
- Priya Devi
- Suresh Raj
- Lakshmi Nair

**English:**
- John Smith
- Mary Johnson
- David Brown
- Sarah Williams

---

## 8. Implementation Checklist

- [ ] Create Material import service
- [ ] Create Inventory import service
- [ ] Create Supply Plan import service
- [ ] Create Non-Moving Items import service
- [ ] Create Storage Type update service
- [ ] Create Warehouse generator
- [ ] Create Supplier generator
- [ ] Create Customer generator
- [ ] Create Location generator
- [ ] Create User/Worker generator
- [ ] Create Order generator
- [ ] Create complete data generation service
- [ ] Add validation rules
- [ ] Test with small dataset
- [ ] Test with medium dataset
- [ ] Import actual CSV data
- [ ] Generate synthetic data
- [ ] Validate all data
- [ ] Test with frontend

---

**Last Updated:** 2025-01-XX  
**Status:** Ready for Implementation

