package com.optiwms.coreapp.imports;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.WarehouseService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.master.Warehouse;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CsvImportService {

    private final MaterialService materialService;
    private final InventoryService inventoryService;
    private final WarehouseService warehouseService;

    public CsvImportService(MaterialService materialService, 
                           InventoryService inventoryService,
                           WarehouseService warehouseService) {
        this.materialService = materialService;
        this.inventoryService = inventoryService;
        this.warehouseService = warehouseService;
    }

    public ImportResult importMaterials(InputStream inputStream) {
        List<Material> materials = new ArrayList<>();
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            boolean isFirstLine = true;

            while ((line = reader.readLine()) != null) {
                if (isFirstLine) {
                    isFirstLine = false;
                    continue; // Skip header
                }

                if (line.trim().isEmpty()) {
                    continue; // Skip empty lines
                }

                try {
                    Material material = parseMaterialLine(line);
                    if (material != null) {
                        materials.add(material);
                    }
                } catch (Exception e) {
                    errorCount++;
                    errors.add("Line: " + line + " - Error: " + e.getMessage());
                }
            }

            // Import all materials
            List<Material> imported = materialService.importMaterials(materials);
            successCount = imported.size();

        } catch (Exception e) {
            errors.add("File processing error: " + e.getMessage());
            errorCount++;
        }

        return new ImportResult(successCount, errorCount, errors);
    }

    private Material parseMaterialLine(String line) {
        // Handle CSV with potential commas in description
        String[] parts = line.split(",", 2);
        
        if (parts.length < 2) {
            return null;
        }

        String materialCode = parts[0].trim();
        String description = parts[1].trim();

        if (materialCode.isEmpty() || description.isEmpty()) {
            return null;
        }

        Material material = new Material();
        material.setMaterialCode(materialCode);
        material.setDescription(description);
        material.setStorageType("pallet"); // Default

        return material;
    }

    public ImportResult importInventory(InputStream inputStream) {
        List<InventoryItem> items = new ArrayList<>();
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();

        // Get default warehouse (first warehouse)
        List<Warehouse> warehouses = warehouseService.listAll();
        if (warehouses.isEmpty()) {
            return new ImportResult(0, 1, List.of("No warehouses found. Please create a warehouse first."));
        }
        java.util.UUID defaultWarehouseId = warehouses.get(0).getId();

        // Build material code to ID map
        Map<String, java.util.UUID> materialCodeMap = materialService.listAll().stream()
                .collect(Collectors.toMap(Material::getMaterialCode, Material::getId));

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                
                // Skip first 2 header lines
                if (lineNumber <= 2) {
                    continue;
                }

                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    InventoryItem item = parseInventoryLine(line, materialCodeMap, defaultWarehouseId);
                    if (item != null) {
                        items.add(item);
                    }
                } catch (Exception e) {
                    errorCount++;
                    errors.add("Line " + lineNumber + ": " + e.getMessage());
                }
            }

            // Import all inventory items
            List<InventoryItem> imported = inventoryService.importInventory(items);
            successCount = imported.size();

        } catch (Exception e) {
            errors.add("File processing error: " + e.getMessage());
            errorCount++;
        }

        return new ImportResult(successCount, errorCount, errors);
    }

    private InventoryItem parseInventoryLine(String line, Map<String, java.util.UUID> materialCodeMap, java.util.UUID warehouseId) {
        // Split by comma, but handle quoted values
        String[] parts = parseCsvLine(line);
        
        if (parts.length < 3) {
            return null;
        }

        String materialCode = parts[0].trim();
        // unitType and description are parsed but not used in current implementation
        // They are available in the CSV but material lookup is done by code only
        // parts[1].trim(); // unitType - reserved for future use
        // parts[2].trim(); // description - reserved for future use

        if (materialCode.isEmpty()) {
            return null;
        }

        // Find material ID
        java.util.UUID materialId = materialCodeMap.get(materialCode);
        if (materialId == null) {
            throw new RuntimeException("Material not found: " + materialCode);
        }

        InventoryItem item = new InventoryItem();
        item.setMaterialId(materialId);
        item.setWarehouseId(warehouseId);
        
        // Parse numeric fields (with error handling)
        try {
            // Column 8: Buffer days (index 8)
            // Column 10: Lead time (index 10)
            // Column 14: ROP (index 14)
            // Column 16: Buffer stock (index 16)
            // Column 18: Maximum stock (index 18)
            // Column 19: Stacking quantity (index 19)
            // Column 20: MOQ (index 20)

            if (parts.length > 10) {
                String leadTimeStr = cleanNumber(parts[10]);
                if (!leadTimeStr.isEmpty()) {
                    item.setLeadTimeDays(Integer.parseInt(leadTimeStr));
                }
            }

            if (parts.length > 14) {
                String ropStr = cleanNumber(parts[14]);
                if (!ropStr.isEmpty()) {
                    item.setReorderPoint(new BigDecimal(ropStr));
                }
            }

            if (parts.length > 16) {
                String bufferStockStr = cleanNumber(parts[16]);
                if (!bufferStockStr.isEmpty()) {
                    item.setBufferStock(new BigDecimal(bufferStockStr));
                }
            }

            if (parts.length > 18) {
                String maxStockStr = cleanNumber(parts[18]);
                if (!maxStockStr.isEmpty()) {
                    item.setMaxStock(new BigDecimal(maxStockStr));
                }
            }

            if (parts.length > 19) {
                String stackingQtyStr = cleanNumber(parts[19]);
                if (!stackingQtyStr.isEmpty()) {
                    item.setStackingQuantity(Integer.parseInt(stackingQtyStr));
                }
            }

            if (parts.length > 20) {
                String moqStr = cleanNumber(parts[20]);
                if (!moqStr.isEmpty()) {
                    item.setMoq(new BigDecimal(moqStr));
                }
            }
        } catch (Exception e) {
            // Continue with default values if parsing fails
        }

        item.setQuantity(BigDecimal.ZERO);
        item.setAvailableQuantity(BigDecimal.ZERO);
        item.setReservedQuantity(BigDecimal.ZERO);
        item.setStatus("active");

        return item;
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        result.add(current.toString());
        return result.toArray(new String[0]);
    }

    private String cleanNumber(String value) {
        if (value == null) return "";
        return value.trim()
                .replaceAll("[,\"()]", "")
                .replaceAll("\\s+", "");
    }

    public static class ImportResult {
        private final int successCount;
        private final int errorCount;
        private final List<String> errors;

        public ImportResult(int successCount, int errorCount, List<String> errors) {
            this.successCount = successCount;
            this.errorCount = errorCount;
            this.errors = errors;
        }

        public int getSuccessCount() {
            return successCount;
        }

        public int getErrorCount() {
            return errorCount;
        }

        public List<String> getErrors() {
            return errors;
        }
    }
}

