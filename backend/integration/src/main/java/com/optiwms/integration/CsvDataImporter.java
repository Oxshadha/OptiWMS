package com.optiwms.integration;

import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;

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
import java.time.LocalDate;
import java.util.*;

@Service
public class CsvDataImporter {

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;


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
                material.setMaterialType("raw_material"); // Default, can be updated later
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
        int supplyPlansCreated = 0;
        int errors = 0;

        // Get or create default warehouse
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new RuntimeException("Warehouse not found: " + warehouseId));

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
                                m.setMaterialType("raw_material");
                                m.setStorageType("pallet");
                                m.setRequiresPallet(true);
                                return materialRepository.save(m);
                            });

                    // Update unit type if not set
                    if (material.getUnitType() == null && !unitType.isEmpty()) {
                        material.setUnitType(unitType);
                        materialRepository.save(material);
                    }

                    materialsProcessed++;

                    // Parse supply plan values (columns 3-7: Jul SP, Aug SP, Sep SP, Oct SP, Nov SP)
                    // Parse planning fields (columns 8-30+)
                    // This is complex - we'll extract key fields

                    // Try to parse numeric values
                    BigDecimal quantity = parseBigDecimal(values, 18); // Approximate position for quantity
                    BigDecimal bufferStock = parseBigDecimal(values, 16); // Buffer stock
                    BigDecimal maxStock = parseBigDecimal(values, 17); // Maximum stock
                    Integer stackingQuantity = parseInt(values, 18); // Stacking quantity
                    BigDecimal moq = parseBigDecimal(values, 19); // MOQ
                    Integer leadTimeDays = parseInt(values, 9); // Lead time days
                    BigDecimal reorderPoint = parseBigDecimal(values, 13); // ROP

                    // Create or update inventory
                    List<InventoryItemEntity> existingList = inventoryItemRepository
                            .findByMaterialIdAndWarehouseId(material.getId(), warehouseId);
                    Optional<InventoryItemEntity> existingInventory = existingList.isEmpty() 
                            ? Optional.empty() 
                            : Optional.of(existingList.get(0));

                    InventoryItemEntity inventory;
                    if (existingInventory.isPresent()) {
                        inventory = existingInventory.get();
                    } else {
                        inventory = new InventoryItemEntity();
                        inventory.setMaterialId(material.getId());
                        inventory.setWarehouseId(warehouseId);
                    }

                    if (quantity != null && quantity.compareTo(BigDecimal.ZERO) > 0) {
                        inventory.setQuantity(quantity);
                        inventory.setAvailableQuantity(quantity);
                    }
                    if (bufferStock != null) {
                        inventory.setBufferStock(bufferStock);
                    }
                    if (maxStock != null) {
                        inventory.setMaxStock(maxStock);
                    }
                    if (stackingQuantity != null) {
                        inventory.setStackingQuantity(stackingQuantity);
                    }
                    if (moq != null) {
                        inventory.setMoq(moq);
                    }
                    if (leadTimeDays != null) {
                        inventory.setLeadTimeDays(leadTimeDays);
                    }
                    if (reorderPoint != null) {
                        inventory.setReorderPoint(reorderPoint);
                    }

                    inventory.setStatus("active");
                    inventoryItemRepository.save(inventory);
                    inventoryCreated++;

                    // Parse and create supply plans (Jul, Aug, Sep, Oct, Nov 2024)
                    // Columns 3-7 should be supply plan months
                    BigDecimal julSp = parseBigDecimal(values, 3);
                    BigDecimal augSp = parseBigDecimal(values, 4);
                    BigDecimal sepSp = parseBigDecimal(values, 5);
                    BigDecimal octSp = parseBigDecimal(values, 6);
                    BigDecimal novSp = parseBigDecimal(values, 7);

                    // Create supply plan records (we'll need a SupplyPlanEntity)
                    // For now, we'll store this in material planning fields
                    // TODO: Create SupplyPlanEntity and repository

                } catch (Exception e) {
                    System.err.println("Error processing line " + lineNumber + ": " + e.getMessage());
                    errors++;
                }
            }
        }

        return new ImportResult(materialsProcessed, inventoryCreated, supplyPlansCreated, errors);
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
        if (value.isEmpty() || value.equals("#N/A") || value.equals("#VALUE!")) {
            return null;
        }

        try {
            // Remove commas and quotes
            value = value.replace(",", "").replace("\"", "").replace(" ", "");
            if (value.startsWith("(") && value.endsWith(")")) {
                // Negative value in parentheses
                value = "-" + value.substring(1, value.length() - 1);
            }
            return new BigDecimal(value);
        } catch (Exception e) {
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
}

