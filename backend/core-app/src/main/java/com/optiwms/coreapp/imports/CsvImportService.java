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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CsvImportService {
    private static final Set<String> UNIT_TOKENS = Set.of(
            "kg", "g", "gram", "grams", "l", "liter", "litre", "ml", "pcs", "pc", "unit", "box", "pallet"
    );
    private static final Set<String> STORAGE_TOKENS = Set.of(
            "pallet", "shelf", "bin", "rack", "bulk", "carton", "container"
    );
    private static final Set<String> MATERIAL_TYPE_TOKENS = Set.of(
            "raw_material", "raw material", "packing_material", "packaging_material", "product"
    );

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
            Map<String, Integer> headerMap = null;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) {
                    continue; // Skip empty lines
                }

                if (headerMap == null) {
                    headerMap = parseHeaderMap(line);
                    List<String> missingHeaders = findMissingRequiredHeaders(headerMap);
                    if (!missingHeaders.isEmpty()) {
                        return new ImportResult(
                                0,
                                1,
                                List.of("Missing required CSV headers: " + String.join(", ", missingHeaders))
                        );
                    }
                    continue;
                }

                try {
                    Material material = parseMaterialLine(line, headerMap);
                    if (material != null) {
                        materials.add(material);
                    }
                } catch (Exception e) {
                    errorCount++;
                    errors.add("Line " + lineNumber + ": " + e.getMessage());
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

    private Material parseMaterialLine(String line, Map<String, Integer> headerMap) {
        String[] parts = parseCsvLine(line);
        String materialCode = getField(parts, headerMap, "material_code");
        String description = getField(parts, headerMap, "description");

        if (materialCode.isEmpty() || description.isEmpty()) {
            throw new RuntimeException("material_code and description are required");
        }

        String materialType = getField(parts, headerMap, "material_type");
        String unitType = getField(parts, headerMap, "unit_type");
        String storageType = getField(parts, headerMap, "storage_type");
        String weightKgRaw = getField(parts, headerMap, "weight_kg");

        Material material = new Material();
        material.setMaterialCode(materialCode);
        material.setDescription(normalizeMaterialDescription(description));
        if (!materialType.isEmpty()) {
            material.setMaterialType(materialType);
        }
        if (!unitType.isEmpty()) {
            material.setUnitType(unitType);
        }
        material.setStorageType(storageType.isEmpty() ? "pallet" : storageType);
        if (!weightKgRaw.isEmpty()) {
            try {
                material.setWeightKg(new BigDecimal(cleanNumber(weightKgRaw)));
            } catch (NumberFormatException e) {
                throw new RuntimeException("Invalid weight_kg value: " + weightKgRaw);
            }
        }

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
            Map<String, Integer> headerMap = null;
            boolean useHeaderBasedParsing = false;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                if (line.trim().isEmpty()) {
                    continue;
                }

                if (headerMap == null) {
                    headerMap = parseHeaderMap(line);
                    useHeaderBasedParsing = headerMap.containsKey("material_code");

                    // If file does not have a proper header row, fall back to legacy positional parser.
                    if (!useHeaderBasedParsing) {
                        // Legacy format has two non-data header rows; keep prior behavior.
                        continue;
                    }
                    continue;
                }

                try {
                    InventoryItem item = useHeaderBasedParsing
                            ? parseInventoryLineWithHeader(line, headerMap, materialCodeMap, defaultWarehouseId)
                            : (lineNumber <= 2 ? null : parseInventoryLine(line, materialCodeMap, defaultWarehouseId));
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

    private InventoryItem parseInventoryLineWithHeader(
            String line,
            Map<String, Integer> headerMap,
            Map<String, java.util.UUID> materialCodeMap,
            java.util.UUID warehouseId
    ) {
        String[] parts = parseCsvLine(line);
        String materialCode = getField(parts, headerMap, "material_code");
        if (materialCode.isEmpty()) {
            return null;
        }

        // Skip secondary sub-header rows (e.g., Jul SP / Aug SP / ...)
        String description = getField(parts, headerMap, "description");
        if ("description".equalsIgnoreCase(description)) {
            return null;
        }

        java.util.UUID materialId = materialCodeMap.get(materialCode);
        if (materialId == null) {
            throw new RuntimeException("Material not found: " + materialCode);
        }

        InventoryItem item = new InventoryItem();
        item.setMaterialId(materialId);
        item.setWarehouseId(warehouseId);
        item.setQuantity(parseIntegerSafe(getField(parts, headerMap, "quantity"), 0));
        item.setAvailableQuantity(item.getQuantity());
        item.setReservedQuantity(0);
        item.setStatus("active");

        item.setBufferDays(parseIntegerNullable(getField(parts, headerMap, "buffer_days")));
        item.setLeadTimeDays(parseIntegerNullable(getField(parts, headerMap, "lead_time_days")));
        item.setLeadTimeMonths(parseBigDecimalNullable(getField(parts, headerMap, "lead_time_months")));
        item.setReorderPoint(parseBigDecimalNullable(getField(parts, headerMap, "reorder_point")));
        item.setRopInDays(parseBigDecimalNullable(getField(parts, headerMap, "rop_in_days")));
        item.setBufferStock(parseBigDecimalNullable(getField(parts, headerMap, "buffer_stock")));
        item.setMaxStock(parseBigDecimalNullable(getField(parts, headerMap, "max_stock")));
        item.setStackingQuantity(parseIntegerNullable(getField(parts, headerMap, "stacking_quantity")));
        item.setMoq(parseBigDecimalNullable(getField(parts, headerMap, "moq")));
        item.setVarianceDemand(parseBigDecimalNullable(getField(parts, headerMap, "variance_demand")));
        item.setVarianceLeadTimeDemand(parseBigDecimalNullable(getField(parts, headerMap, "variance_lead_time_demand")));
        item.setPalletRequirement(parseBigDecimalNullable(getField(parts, headerMap, "pallet_requirement")));

        return item;
    }

    private InventoryItem parseInventoryLine(String line, Map<String, java.util.UUID> materialCodeMap, java.util.UUID warehouseId) {
        // Split by comma, but handle quoted values
        String[] parts = parseCsvLine(line);
        
        if (parts.length < 3) {
            return null;
        }

        String materialCode = parts[0].trim();

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

        item.setQuantity(0);
        item.setAvailableQuantity(0);
        item.setReservedQuantity(0);
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

    private Map<String, Integer> parseHeaderMap(String headerLine) {
        String[] headers = parseCsvLine(headerLine);
        Map<String, Integer> headerMap = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            String normalized = normalizeHeader(headers[i]);
            if (!normalized.isEmpty()) {
                headerMap.putIfAbsent(normalized, i);
            }
        }
        return headerMap;
    }

    private List<String> findMissingRequiredHeaders(Map<String, Integer> headerMap) {
        List<String> missing = new ArrayList<>();
        if (!headerMap.containsKey("material_code")) {
            missing.add("material_code");
        }
        if (!headerMap.containsKey("description")) {
            missing.add("description");
        }
        return missing;
    }

    private String normalizeHeader(String header) {
        if (header == null) {
            return "";
        }

        String normalized = header.trim().toLowerCase()
                .replace("-", "_")
                .replace(" ", "_");

        if (normalized.equals("materialcode") || normalized.equals("sku") || normalized.equals("code")) {
            return "material_code";
        }
        if (normalized.equals("name") || normalized.equals("item_name") || normalized.equals("material_name")) {
            return "description";
        }
        if (normalized.equals("type")) {
            return "material_type";
        }
        if (normalized.equals("unit")) {
            return "unit_type";
        }
        if (normalized.equals("storage")) {
            return "storage_type";
        }
        if (normalized.equals("weight") || normalized.equals("weightkg")) {
            return "weight_kg";
        }
        if (normalized.equals("material") || normalized.equals("material_code_")) {
            return "material_code";
        }
        if (normalized.equals("buffer_days")) {
            return "buffer_days";
        }
        if (normalized.equals("lead_time")) {
            return "lead_time_days";
        }
        if (normalized.equals("lead_time_months")) {
            return "lead_time_months";
        }
        if (normalized.equals("rop")) {
            return "reorder_point";
        }
        if (normalized.equals("rop_in_days")) {
            return "rop_in_days";
        }
        if (normalized.equals("buffer_stock")) {
            return "buffer_stock";
        }
        if (normalized.equals("maximum_stock")) {
            return "max_stock";
        }
        if (normalized.equals("stacking_quantity")) {
            return "stacking_quantity";
        }
        if (normalized.equals("variance_(demand)") || normalized.equals("variance_demand")) {
            return "variance_demand";
        }
        if (normalized.equals("variance_lead_time_demand")) {
            return "variance_lead_time_demand";
        }
        if (normalized.equals("pallet_requirement")) {
            return "pallet_requirement";
        }
        if (normalized.equals("on_hand") || normalized.equals("current_stock")) {
            return "quantity";
        }

        return normalized;
    }

    private Integer parseIntegerSafe(String value, int defaultValue) {
        String cleaned = cleanNumber(value);
        if (cleaned.isEmpty()) return defaultValue;
        try {
            return new BigDecimal(cleaned).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private Integer parseIntegerNullable(String value) {
        String cleaned = cleanNumber(value);
        if (cleaned.isEmpty()) return null;
        try {
            return new BigDecimal(cleaned).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private BigDecimal parseBigDecimalNullable(String value) {
        String cleaned = cleanNumber(value);
        if (cleaned.isEmpty()) return null;
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String getField(String[] parts, Map<String, Integer> headerMap, String key) {
        Integer index = headerMap.get(key);
        if (index == null || index < 0 || index >= parts.length) {
            return "";
        }
        return parts[index].trim();
    }

    private String normalizeMaterialDescription(String description) {
        String trimmed = description == null ? "" : description.trim();
        if (trimmed.isEmpty()) {
            return trimmed;
        }

        String[] segments = trimmed.split(",");
        if (segments.length <= 1) {
            return trimmed;
        }

        String firstSegment = segments[0].trim();
        if (firstSegment.isEmpty()) {
            return trimmed;
        }

        List<String> normalizedTail = new ArrayList<>();
        for (int i = 1; i < segments.length; i++) {
            String token = segments[i].trim().toLowerCase();
            if (!token.isEmpty()) {
                normalizedTail.add(token);
            }
        }
        if (normalizedTail.isEmpty()) {
            return firstSegment;
        }

        Set<String> allowedLegacyTokens = new HashSet<>();
        allowedLegacyTokens.addAll(MATERIAL_TYPE_TOKENS);
        allowedLegacyTokens.addAll(UNIT_TOKENS);
        allowedLegacyTokens.addAll(STORAGE_TOKENS);

        boolean tailLooksLikeLegacyMetadata = normalizedTail.stream()
                .allMatch(token -> allowedLegacyTokens.contains(token));

        return tailLooksLikeLegacyMetadata ? firstSegment : trimmed;
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
