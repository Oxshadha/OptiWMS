package com.optiwms.integration;

import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Materials Data Seeder
 * 
 * DISABLED: Data is now loaded via Flyway migrations (V16, V17) - enterprise best practice.
 * This seeder is kept for reference but disabled since:
 * - V16__seed_materials_from_csv.sql loads materials permanently
 * - V17__seed_inventory_from_csv.sql loads inventory permanently
 * - Data persists in database, no need for runtime seeding
 * 
 * To re-enable (not recommended): Uncomment @Component annotation below
 */
// @Component  // DISABLED - Data loaded via Flyway migrations (V16, V17)
@Order(2) // Run after DefaultUserSeeder
public class MaterialsDataSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(MaterialsDataSeeder.class);

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private CsvDataImporter csvDataImporter;

    // CSV file paths (relative to project root)
    private static final String CSV_BASE_PATH = "Resources/DataBase Resources";
    private static final String MATERIALS_CSV = CSV_BASE_PATH + "/Item code and descriptions.csv";
    private static final String RAW_MATERIALS_CSV = CSV_BASE_PATH + "/Raw matrilas not store in pallets.csv";
    private static final String NON_MOVING_CSV = CSV_BASE_PATH + "/Non Moving items.csv";
    private static final String ACTIVE_STOCK_CSV = CSV_BASE_PATH + "/Active stock.csv";

    @Override
    @Transactional
    public void run(String... args) {
        logger.info("=== Starting Materials Data Seeder ===");

        try {
            // Check if materials already exist
            long materialCount = materialRepository.count();
            logger.info("Current materials in database: {}", materialCount);

            // Industry Best Practice: Data should be in database via Flyway migrations
            // This seeder only runs if database is empty (first-time setup)
            // For production, use Flyway migrations (V16__seed_materials_from_csv.sql)
            if (materialCount == 0) {
                logger.warn("⚠️  No materials found in database!");
                logger.warn("⚠️  In production, materials should be loaded via Flyway migrations.");
                logger.warn("⚠️  Running CSV import as fallback (development only)...");
                
                loadMaterialsFromCsv();
                loadRawMaterialsFromCsv();
                loadNonMovingItemsFromCsv();
                loadInventoryFromCsv();
                
                logger.info("✅ Materials data seeding completed successfully (fallback mode)");
            } else {
                logger.info("✅ Materials already exist in database ({} materials). Skipping CSV load.", materialCount);
                logger.info("✅ Data is stored in database - this is the correct enterprise approach.");
            }

        } catch (Exception e) {
            logger.error("❌ Error during materials data seeding", e);
            // Don't fail startup - just log the error
        }

        logger.info("=== Materials Data Seeder Complete ===");
    }

    /**
     * Load materials from Item code and descriptions.csv
     */
    private void loadMaterialsFromCsv() {
        Path csvPath = resolveCsvPath(MATERIALS_CSV);
        if (!Files.exists(csvPath)) {
            logger.warn("Materials CSV not found: {}", csvPath);
            return;
        }

        logger.info("Loading materials from: {}", csvPath);
        try {
            int imported = csvDataImporter.importMaterials(csvPath.toString());
            logger.info("✅ Imported {} materials from CSV", imported);
        } catch (Exception e) {
            logger.error("Failed to import materials from CSV", e);
        }
    }

    /**
     * Load raw materials that don't store in pallets
     * Updates existing materials with special storage requirements
     */
    private void loadRawMaterialsFromCsv() {
        Path csvPath = resolveCsvPath(RAW_MATERIALS_CSV);
        if (!Files.exists(csvPath)) {
            logger.warn("Raw materials CSV not found: {}", csvPath);
            return;
        }

        logger.info("Loading raw materials (non-pallet) from: {}", csvPath);
        try {
            int updated = updateRawMaterialsFromCsv(csvPath);
            logger.info("✅ Updated {} raw materials with special storage requirements", updated);
        } catch (Exception e) {
            logger.error("Failed to import raw materials from CSV", e);
        }
    }

    /**
     * Load non-moving items and flag them
     */
    private void loadNonMovingItemsFromCsv() {
        Path csvPath = resolveCsvPath(NON_MOVING_CSV);
        if (!Files.exists(csvPath)) {
            logger.warn("Non-moving items CSV not found: {}", csvPath);
            return;
        }

        logger.info("Loading non-moving items from: {}", csvPath);
        try {
            int flagged = flagNonMovingItemsFromCsv(csvPath);
            logger.info("✅ Flagged {} materials as non-moving", flagged);
        } catch (Exception e) {
            logger.error("Failed to import non-moving items from CSV", e);
        }
    }

    /**
     * Load inventory from Active stock.csv
     */
    private void loadInventoryFromCsv() {
        Path csvPath = resolveCsvPath(ACTIVE_STOCK_CSV);
        if (!Files.exists(csvPath)) {
            logger.warn("Active stock CSV not found: {}", csvPath);
            return;
        }

        // Get default warehouse
        List<WarehouseEntity> warehouses = warehouseRepository.findAll();
        if (warehouses.isEmpty()) {
            logger.warn("No warehouses found. Cannot import inventory.");
            return;
        }

        UUID warehouseId = warehouses.get(0).getId();
        logger.info("Loading inventory from: {} for warehouse: {}", csvPath, warehouseId);

        try {
            CsvDataImporter.ImportResult result = csvDataImporter.importInventoryAndSupplyPlans(
                csvPath.toString(), warehouseId);
            logger.info("✅ Imported inventory: {} materials processed, {} inventory items created, {} errors",
                result.getMaterialsProcessed(), result.getInventoryCreated(), result.getErrors());
        } catch (Exception e) {
            logger.error("Failed to import inventory from CSV", e);
        }
    }

    /**
     * Update raw materials that don't store in pallets
     */
    private int updateRawMaterialsFromCsv(Path csvPath) throws IOException {
        int updated = 0;
        Set<String> processedCodes = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(csvPath.toFile()))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                
                // Skip header lines
                if (lineNumber <= 2) {
                    continue;
                }

                if (line.trim().isEmpty() || line.contains("*****") || line.startsWith(",")) {
                    continue;
                }

                try {
                    List<String> values = parseCsvLine(line);
                    if (values.size() < 2) {
                        continue;
                    }

                    String materialCode = values.get(0).trim();
                    if (materialCode.isEmpty() || processedCodes.contains(materialCode)) {
                        continue;
                    }

                    Optional<MaterialEntity> materialOpt = materialRepository.findByMaterialCode(materialCode);
                    MaterialEntity material;
                    if (materialOpt.isPresent()) {
                        material = materialOpt.get();
                        // Update storage requirements for non-pallet materials
                        material.setRequiresPallet(false);
                        material.setStorageType("bulk"); // or "third_party" based on your needs
                        material = materialRepository.save(material);
                    } else {
                        // Create material if it doesn't exist
                        material = new MaterialEntity();
                        material.setMaterialCode(materialCode);
                        material.setDescription(values.size() > 1 ? values.get(1).trim() : "");
                        material.setMaterialType("raw_material");
                        material.setRequiresPallet(false);
                        material.setStorageType("bulk");
                        material = materialRepository.save(material);
                    }
                    processedCodes.add(materialCode);
                    updated++;
                } catch (Exception e) {
                    logger.warn("Error processing line {}: {}", lineNumber, e.getMessage());
                }
            }
        }

        return updated;
    }

    /**
     * Flag non-moving items
     */
    private int flagNonMovingItemsFromCsv(Path csvPath) throws IOException {
        int flagged = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(csvPath.toFile()))) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    firstLine = false;
                    continue; // Skip header
                }

                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    List<String> values = parseCsvLine(line);
                    if (values.size() < 2) {
                        continue;
                    }

                    String materialCode = values.get(0).trim();
                    if (materialCode.isEmpty()) {
                        continue;
                    }

                    Optional<MaterialEntity> materialOpt = materialRepository.findByMaterialCode(materialCode);
                    MaterialEntity material;
                    if (materialOpt.isPresent()) {
                        material = materialOpt.get();
                        // Material is already in database
                    } else {
                        // Create material if it doesn't exist
                        material = new MaterialEntity();
                        material.setMaterialCode(materialCode);
                        material.setDescription(values.size() > 1 ? values.get(1).trim() : "");
                        material.setMaterialType("raw_material");
                        material.setStorageType("pallet");
                        material = materialRepository.save(material);
                    }
                    UUID materialId = material.getId();
                    flagged++;

                    List<InventoryItemEntity> inventoryItems = inventoryItemRepository
                        .findByMaterialId(materialId);

                    for (InventoryItemEntity item : inventoryItems) {
                        item.setStatus("non_moving");
                        inventoryItemRepository.save(item);
                    }

                } catch (Exception e) {
                    logger.warn("Error processing non-moving item: {}", e.getMessage());
                }
            }
        }

        return flagged;
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
     * Parse BigDecimal from CSV value
     */
    private BigDecimal parseBigDecimal(List<String> values, int index) {
        if (index >= values.size()) {
            return null;
        }
        String value = values.get(index).trim();
        if (value.isEmpty() || value.equals("#N/A") || value.equals("#VALUE!") || value.equals("-")) {
            return null;
        }
        try {
            value = value.replace(",", "").replace("\"", "").replace(" ", "").replace("(", "-").replace(")", "");
            if (value.isEmpty()) {
                return null;
            }
            return new BigDecimal(value);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Resolve CSV path - tries multiple locations
     */
    private Path resolveCsvPath(String relativePath) {
        // Try from project root (where Resources folder is)
        Path projectRoot = Paths.get("").toAbsolutePath();
        Path fullPath = projectRoot.resolve(relativePath);
        if (Files.exists(fullPath)) {
            return fullPath;
        }

        // Try parent directory (if running from backend folder)
        Path parentPath = projectRoot.getParent();
        if (parentPath != null) {
            Path parentFullPath = parentPath.resolve(relativePath);
            if (Files.exists(parentFullPath)) {
                return parentFullPath;
            }
        }

        // Try absolute path
        Path absolutePath = Paths.get(System.getProperty("user.dir"), relativePath);
        if (Files.exists(absolutePath)) {
            return absolutePath;
        }

        // Return the path anyway - let the caller handle missing file
        logger.warn("CSV path not found, trying: {}", fullPath);
        return fullPath;
    }
}
