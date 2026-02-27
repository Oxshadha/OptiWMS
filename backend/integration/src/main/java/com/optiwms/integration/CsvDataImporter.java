package com.optiwms.integration;

import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.WarehouseRepository;
import com.optiwms.infra.planning.SupplyPlanEntity;
import com.optiwms.infra.planning.SupplyPlanRepository;

import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CsvDataImporter {

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private SupplyPlanRepository supplyPlanRepository;


    /**
     * Import materials from Item code and descriptions.csv
     */
    @Transactional
    public int importMaterials(String csvPath) throws IOException {
        Path path = Paths.get(csvPath);
        int imported = 0;
        int skipped = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(path.toFile()))) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    firstLine = false;
                    continue; // Skip header
                }

                if (line.trim().isEmpty() || line.startsWith(",")) {
                    continue; // Skip empty lines
                }

                String[] parts = line.split(",", 2);
                if (parts.length < 2) {
                    skipped++;
                    continue;
                }

                String materialCode = parts[0].trim();
                String description = parts[1].trim();

                if (materialCode.isEmpty() || description.isEmpty()) {
                    skipped++;
                    continue;
                }

                // Check if material already exists
                Optional<MaterialEntity> existing = materialRepository.findByMaterialCode(materialCode);
                if (existing.isPresent()) {
                    // Update description if different
                    MaterialEntity material = existing.get();
                    if (!material.getDescription().equals(description)) {
                        material.setDescription(description);
                        materialRepository.save(material);
                    }
                    skipped++;
                    continue;
                }

                // Create new material
                MaterialEntity material = new MaterialEntity();
                material.setMaterialCode(materialCode);
                material.setDescription(description);
                material.setMaterialType(classifyMaterialType(description, null)); // Classify based on description
                material.setStorageType("pallet"); // Default
                material.setRequiresPallet(true); // Default

                materialRepository.save(material);
                imported++;
            }
        }

        System.out.println("Materials imported: " + imported + ", skipped: " + skipped);
        return imported;
    }

    /**
     * Import inventory and supply plan data from Active stock.csv
     * This is a complex CSV with multiple columns
     */
    @Transactional
    public ImportResult importInventoryAndSupplyPlans(String csvPath, UUID warehouseId) throws IOException {
        Path path = Paths.get(csvPath);
        int materialsProcessed = 0;
        int inventoryCreated = 0;
        AtomicInteger supplyPlansCreated = new AtomicInteger(0);
        int errors = 0;
        Map<UUID, InventoryItemEntity> inventoryByMaterial = new HashMap<>();

        // Verify warehouse exists
        if (!warehouseRepository.existsById(warehouseId)) {
            throw new RuntimeException("Warehouse not found: " + warehouseId);
        }

        // Preload existing inventory rows for this warehouse so repeated lines update
        // the same entity instead of creating duplicate inventory records.
        for (InventoryItemEntity existing : inventoryItemRepository.findByWarehouseId(warehouseId)) {
            if (existing.getMaterialId() != null) {
                inventoryByMaterial.putIfAbsent(existing.getMaterialId(), existing);
            }
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(path.toFile()))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (lineNumber <= 2) {
                    continue; // Skip header rows
                }

                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    // Parse CSV line (handling quoted values with commas)
                    List<String> values = parseCsvLine(line);
                    if (values.size() < 3) {
                        continue; // Not enough data
                    }

                    String materialCode = values.get(0).trim();
                    String unitType = values.get(1).trim();
                    String description = values.get(2).trim();

                    if (materialCode.isEmpty() || description.isEmpty()) {
                        continue;
                    }

                    // Find or create material
                    MaterialEntity material = materialRepository.findByMaterialCode(materialCode)
                            .orElseGet(() -> {
                                MaterialEntity m = new MaterialEntity();
                                m.setMaterialCode(materialCode);
                                m.setDescription(description);
                                m.setUnitType(unitType);
                                m.setMaterialType(classifyMaterialType(description, unitType));
                                m.setStorageType("pallet");
                                m.setRequiresPallet(true);
                                return materialRepository.save(m);
                            });
                    
                    // Update material type if not set
                    if (material.getMaterialType() == null) {
                        material.setMaterialType(classifyMaterialType(description, unitType));
                        materialRepository.save(material);
                    }

                    // Update unit type if not set
                    if (material.getUnitType() == null && !unitType.isEmpty()) {
                        material.setUnitType(unitType);
                        materialRepository.save(material);
                    }

                    materialsProcessed++;

                    // Parse supply plan values (columns 3-7: Jul SP, Aug SP, Sep SP, Oct SP, Nov SP)
                    // Parse planning fields (columns 8-30+)
                    // This is complex - we'll extract key fields

                    // Parse numeric values from Active stock.csv
                    // CSV Structure (after parsing): 
                    // 0=Material Code, 1=Unit Type, 2=Description, 3-7=Supply Plan, 8=Buffer days, 
                    // 9=Future Average (QUANTITY!), 10=Lead time, 11=Lead time months, 12=EX,
                    // 13=Variance demand, 14=Variance lead time, 15=ROP, 16=ROP days, 17=Buffer stock,
                    // 18=(empty), 19=Maximum stock, 20=Stacking quantity, 21=MOQ, 22=Difference,
                    // 23=Order Delivery, 24=Order Quantity, 27=Pallet requirement (may be #VALUE!)
                    // IMPORTANT: Column 9 = "Future Average" = Current Stock Quantity!
                    BigDecimal quantity = parseBigDecimal(values, 9); // Column 9 = Future Average = Current Stock Quantity
                    Integer bufferDays = parseInt(values, 8); // Column 8 = Buffer days
                    Integer leadTimeDays = parseInt(values, 10); // Column 10 = Lead time days
                    BigDecimal leadTimeMonths = parseBigDecimal(values, 11); // Column 11 = Lead time months
                    BigDecimal varianceDemand = parseBigDecimal(values, 13); // Column 13 = Variance demand
                    BigDecimal varianceLeadTimeDemand = parseBigDecimal(values, 14); // Column 14 = Variance lead time demand
                    BigDecimal reorderPoint = parseBigDecimal(values, 15); // Column 15 = ROP
                    BigDecimal ropInDays = parseBigDecimal(values, 16); // Column 16 = ROP in days
                    BigDecimal bufferStock = parseBigDecimal(values, 17); // Column 17 = Buffer stock
                    BigDecimal maxStock = parseBigDecimal(values, 19); // Column 19 = Maximum stock
                    Integer stackingQuantity = parseInt(values, 20); // Column 20 = Stacking quantity
                    BigDecimal moq = parseBigDecimal(values, 21); // Column 21 = MOQ
                    BigDecimal difference = parseBigDecimal(values, 22); // Column 22 = Difference (may be negative in parentheses)
                    Integer orderDeliveryDays = parseInt(values, 23); // Column 23 = Order Delivery
                    BigDecimal orderQuantity = parseBigDecimal(values, 24); // Column 24 = Order Quantity
                    // Column 27 = Pallet requirement (often #VALUE! in CSV, will be null)
                    BigDecimal palletRequirement = parseBigDecimal(values, 27); // Column 27 = Pallet requirement

                    // Create or update inventory
                    InventoryItemEntity inventory = inventoryByMaterial.get(material.getId());
                    if (inventory == null) {
                        inventory = new InventoryItemEntity();
                        inventory.setMaterialId(material.getId());
                        inventory.setWarehouseId(warehouseId);
                        inventoryByMaterial.put(material.getId(), inventory);
                    }

                    // Always update quantity if available (even if 0, to ensure data consistency)
                    if (quantity != null) {
                        Integer qtyInteger = (int) Math.ceil(quantity.doubleValue());
                        inventory.setQuantity(qtyInteger);
                        inventory.setAvailableQuantity(qtyInteger);
                    }
                    
                    // Update all planning fields - always set them (null is valid if CSV has no data)
                    // This ensures existing records get updated when CSV is re-imported
                    inventory.setBufferStock(bufferStock);
                    inventory.setMaxStock(maxStock);
                    inventory.setMinStock(null); // Not in CSV, keep null
                    inventory.setStackingQuantity(stackingQuantity);
                    inventory.setMoq(moq);
                    inventory.setLeadTimeDays(leadTimeDays);
                    inventory.setReorderPoint(reorderPoint);
                    inventory.setBufferDays(bufferDays);
                    inventory.setLeadTimeMonths(leadTimeMonths);
                    inventory.setRopInDays(ropInDays);
                    inventory.setVarianceDemand(varianceDemand);
                    inventory.setVarianceLeadTimeDemand(varianceLeadTimeDemand);
                    inventory.setDifference(difference);
                    inventory.setOrderDeliveryDays(orderDeliveryDays);
                    inventory.setOrderQuantity(orderQuantity);
                    inventory.setPalletRequirement(palletRequirement);

                    inventory.setStatus("active");
                    // Set material_type from material (denormalized for filtering)
                    inventory.setMaterialType(material.getMaterialType());
                    InventoryItemEntity savedInventory = inventoryItemRepository.save(inventory);
                    inventoryByMaterial.put(material.getId(), savedInventory);
                    inventoryCreated++;

                    // Parse and create supply plans (Jul, Aug, Sep, Oct, Nov 2024)
                    // Columns 3-7 should be supply plan months (after Material Code, Unit Type, Description)
                    // CSV Structure: 0=Material Code, 1=Unit Type, 2=Description, 3=Jul SP, 4=Aug SP, 5=Sep SP, 6=Oct SP, 7=Nov SP
                    BigDecimal julSp = parseBigDecimal(values, 3);
                    BigDecimal augSp = parseBigDecimal(values, 4);
                    BigDecimal sepSp = parseBigDecimal(values, 5);
                    BigDecimal octSp = parseBigDecimal(values, 6);
                    BigDecimal novSp = parseBigDecimal(values, 7);

                    // Create supply plan records for 2024
                    int year = 2024;
                    UUID materialUuid = material.getId();
                    UUID warehouseUuid = warehouseId;

                    // Save supply plans if quantities exist (even if zero, but not null)
                    // Remove the > 0 check to save all non-null values
                    if (julSp != null) {
                        saveSupplyPlan(materialUuid, warehouseUuid, year, 7, julSp, supplyPlansCreated); // July
                    }
                    if (augSp != null) {
                        saveSupplyPlan(materialUuid, warehouseUuid, year, 8, augSp, supplyPlansCreated); // August
                    }
                    if (sepSp != null) {
                        saveSupplyPlan(materialUuid, warehouseUuid, year, 9, sepSp, supplyPlansCreated); // September
                    }
                    if (octSp != null) {
                        saveSupplyPlan(materialUuid, warehouseUuid, year, 10, octSp, supplyPlansCreated); // October
                    }
                    if (novSp != null) {
                        saveSupplyPlan(materialUuid, warehouseUuid, year, 11, novSp, supplyPlansCreated); // November
                    }

                } catch (Exception e) {
                    System.err.println("Error processing line " + lineNumber + ": " + e.getMessage());
                    errors++;
                }
            }
        }

        System.out.println("✅ Import completed: " + materialsProcessed + " materials processed, " + 
                          inventoryCreated + " inventory items created, " + 
                          supplyPlansCreated.get() + " supply plans created, " + 
                          errors + " errors");
        return new ImportResult(materialsProcessed, inventoryCreated, supplyPlansCreated.get(), errors);
    }

    /**
     * Classify material type based on description and unit type
     * Returns: "raw_material" or "packaging_material"
     */
    private String classifyMaterialType(String description, String unitType) {
        if (description == null) {
            return "raw_material";
        }
        
        String descLower = description.toLowerCase();
        String unitLower = unitType != null ? unitType.toLowerCase() : "";
        
        // Packaging materials
        if (descLower.contains("pouch") || 
            descLower.contains("pe back") || 
            descLower.contains("sheet") || 
            descLower.contains("woven") || 
            descLower.contains("paper") || 
            descLower.contains("reel") ||
            descLower.contains("tape") ||
            unitLower.contains("reel")) {
            return "packaging_material";
        }
        
        // Default: raw material
        return "raw_material";
    }

    /**
     * Parse CSV line handling quoted values
     */
    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(current.toString().trim());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        values.add(current.toString().trim());

        return values;
    }

    /**
     * Parse BigDecimal from CSV value, handling formatting
     */
    private BigDecimal parseBigDecimal(List<String> values, int index) {
        if (index >= values.size()) {
            return null;
        }

        String value = values.get(index).trim();
        if (value.isEmpty() || value.equals("#N/A") || value.equals("#VALUE!") || value.equals("]") || value.equals("-")) {
            return null;
        }

        try {
            // Remove quotes first, then handle commas and spaces
            value = value.replace("\"", "").trim();
            
            // Handle negative values in parentheses: (78,715) -> -78715
            boolean isNegative = value.startsWith("(") && value.endsWith(")");
            if (isNegative) {
                value = value.substring(1, value.length() - 1).trim();
            }
            
            // Remove commas (thousand separators) - but keep decimal point
            // Handle both "88,715" and " 88,715 " formats
            value = value.replace(",", "").trim();
            
            // Remove any remaining spaces (shouldn't be any, but just in case)
            value = value.replaceAll("\\s+", "");
            
            // Skip if empty after cleaning
            if (value.isEmpty() || value.equals("-") || value.equals(".")) {
                return null;
            }
            
            BigDecimal result = new BigDecimal(value);
            return isNegative ? result.negate() : result;
        } catch (Exception e) {
            // Log but don't fail - return null for invalid values
            // This is expected for #VALUE!, empty cells, etc.
            return null;
        }
    }

    /**
     * Parse Integer from CSV value
     */
    private Integer parseInt(List<String> values, int index) {
        BigDecimal bd = parseBigDecimal(values, index);
        return bd != null ? bd.intValue() : null;
    }

    /**
     * Import non-moving items
     */
    @Transactional
    public int importNonMovingItems(String csvPath, UUID warehouseId) throws IOException {
        // TODO: Implement non-moving items import
        // This would create records in non_moving_items table
        return 0;
    }

    /**
     * Update materials that don't require pallets
     */
    @Transactional
    public int updateNonPalletMaterials(String csvPath) throws IOException {
        Path path = Paths.get(csvPath);
        int updated = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(path.toFile()))) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    firstLine = false;
                    continue;
                }

                if (line.trim().isEmpty()) {
                    continue;
                }

                String[] parts = line.split(",", 2);
                if (parts.length < 1) {
                    continue;
                }

                String materialCode = parts[0].trim();
                if (materialCode.isEmpty()) {
                    continue;
                }

                Optional<MaterialEntity> materialOpt = materialRepository.findByMaterialCode(materialCode);
                if (materialOpt.isPresent()) {
                    MaterialEntity material = materialOpt.get();
                    material.setRequiresPallet(false);
                    material.setStorageLocationType("tank"); // Or "third_party" based on data
                    materialRepository.save(material);
                    updated++;
                }
            }
        }

        System.out.println("Non-pallet materials updated: " + updated);
        return updated;
    }

    public static class ImportResult {
        private final int materialsProcessed;
        private final int inventoryCreated;
        private final int supplyPlansCreated;
        private final int errors;

        public ImportResult(int materialsProcessed, int inventoryCreated, int supplyPlansCreated, int errors) {
            this.materialsProcessed = materialsProcessed;
            this.inventoryCreated = inventoryCreated;
            this.supplyPlansCreated = supplyPlansCreated;
            this.errors = errors;
        }

        public int getMaterialsProcessed() { return materialsProcessed; }
        public int getInventoryCreated() { return inventoryCreated; }
        public int getSupplyPlansCreated() { return supplyPlansCreated; }
        public int getErrors() { return errors; }
    }

    /**
     * Save or update supply plan record
     */
    private void saveSupplyPlan(UUID materialId, UUID warehouseId, int year, int month, 
                               BigDecimal plannedQuantity, AtomicInteger counter) {
        try {
            // Check if supply plan already exists
            Optional<SupplyPlanEntity> existing = supplyPlanRepository
                .findByMaterialIdAndWarehouseIdAndPlanYearAndPlanMonth(materialId, warehouseId, year, month);

            SupplyPlanEntity supplyPlan;
            if (existing.isPresent()) {
                supplyPlan = existing.get();
            } else {
                supplyPlan = new SupplyPlanEntity();
                supplyPlan.setMaterialId(materialId);
                supplyPlan.setWarehouseId(warehouseId);
                supplyPlan.setPlanYear(year);
                supplyPlan.setPlanMonth(month);
                counter.incrementAndGet(); // Only count new records
            }

            supplyPlan.setPlannedQuantity(plannedQuantity);
            supplyPlanRepository.save(supplyPlan);
        } catch (Exception e) {
            System.err.println("Error saving supply plan for material " + materialId + 
                             ", warehouse " + warehouseId + ", year " + year + ", month " + month + 
                             ": " + e.getMessage());
            e.printStackTrace();
        }
    }
}
