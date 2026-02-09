package com.optiwms.coreapi.integration;

import com.optiwms.integration.CsvDataImporter;
import com.optiwms.integration.SyntheticDataImportService;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller for importing synthetic data into the database
 * Only accessible by ADMIN role
 * Handles material dimensions and location coordinates
 * Skips ABC/FMS classifications (will be AI service later)
 */
@RestController
@RequestMapping("/api/integration/data-import")
@PreAuthorize("hasRole('ADMIN')")
public class DataImportController {

    private static final Logger logger = LoggerFactory.getLogger(DataImportController.class);

    private final SyntheticDataImportService importService;
    private final CsvDataImporter csvDataImporter;
    private final WarehouseRepository warehouseRepository;

    public DataImportController(SyntheticDataImportService importService,
            CsvDataImporter csvDataImporter,
            WarehouseRepository warehouseRepository) {
        this.importService = importService;
        this.csvDataImporter = csvDataImporter;
        this.warehouseRepository = warehouseRepository;
    }

    /**
     * Import material dimensions from synthetic_data/material_dimensions.csv
     * Updates existing materials with physical dimensions
     */
    @PostMapping("/material-dimensions")
    public ResponseEntity<ImportResponse> importMaterialDimensions(
            @RequestParam(required = false) String filePath) {

        // Use default path if not provided
        if (filePath == null || filePath.isEmpty()) {
            filePath = getDefaultMaterialDimensionsPath();
        }

        logger.info("Received request to import material dimensions from: {}", filePath);

        try {
            SyntheticDataImportService.ImportResult result = importService.importMaterialDimensions(filePath);

            return ResponseEntity.ok(new ImportResponse(
                    true,
                    result.getMessage(),
                    result.getUpdated(),
                    result.getSkipped(),
                    result.getErrors()));

        } catch (Exception e) {
            logger.error("Error importing material dimensions", e);
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            return ResponseEntity.status(500).body(new ImportResponse(
                    false,
                    "Import failed: " + errorMessage,
                    0,
                    0,
                    1));
        }
    }

    /**
     * Import location coordinates from synthetic_data/location_coordinates.csv
     * Updates existing locations with X, Y, Z coordinates and accessibility ratings
     */
    @PostMapping("/location-coordinates")
    public ResponseEntity<ImportResponse> importLocationCoordinates(
            @RequestParam(required = false) String filePath) {

        // Use default path if not provided
        if (filePath == null || filePath.isEmpty()) {
            filePath = getDefaultLocationCoordinatesPath();
        }

        logger.info("Received request to import location coordinates from: {}", filePath);

        try {
            SyntheticDataImportService.ImportResult result = importService.importLocationCoordinates(filePath);

            return ResponseEntity.ok(new ImportResponse(
                    true,
                    result.getMessage(),
                    result.getUpdated(),
                    result.getSkipped(),
                    result.getErrors()));

        } catch (Exception e) {
            logger.error("Error importing location coordinates", e);
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            return ResponseEntity.status(500).body(new ImportResponse(
                    false,
                    "Import failed: " + errorMessage,
                    0,
                    0,
                    1));
        }
    }

    /**
     * Import all synthetic data (materials + locations)
     * Convenient endpoint to import everything at once
     */
    @PostMapping("/import-all")
    public ResponseEntity<Map<String, ImportResponse>> importAll() {
        logger.info("Received request to import all synthetic data");

        Map<String, ImportResponse> results = new HashMap<>();

        try {
            // Import material dimensions
            SyntheticDataImportService.ImportResult materialResult = importService
                    .importMaterialDimensions(getDefaultMaterialDimensionsPath());
            results.put("materials", new ImportResponse(
                    true,
                    materialResult.getMessage(),
                    materialResult.getUpdated(),
                    materialResult.getSkipped(),
                    materialResult.getErrors()));

            // Import location coordinates
            SyntheticDataImportService.ImportResult locationResult = importService
                    .importLocationCoordinates(getDefaultLocationCoordinatesPath());
            results.put("locations", new ImportResponse(
                    true,
                    locationResult.getMessage(),
                    locationResult.getUpdated(),
                    locationResult.getSkipped(),
                    locationResult.getErrors()));

            logger.info("All imports completed successfully");
            return ResponseEntity.ok(results);

        } catch (Exception e) {
            logger.error("Error during import all", e);
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            results.put("error", new ImportResponse(
                    false,
                    "Import failed: " + errorMessage,
                    0,
                    0,
                    1));
            return ResponseEntity.status(500).body(results);
        }
    }

    /**
     * Import inventory and supply plan data from Active stock.csv
     * This imports ROP, Buffer Stock, MOQ, Lead Time, and quantity data
     */
    @PostMapping("/import-active-stock")
    public ResponseEntity<Map<String, Object>> importActiveStock(
            @RequestParam(required = false) UUID warehouseId) {

        logger.info("Received request to import Active stock.csv data");

        try {
            // Get warehouse ID - use provided or default to first warehouse
            UUID targetWarehouseId = warehouseId;
            if (targetWarehouseId == null) {
                List<WarehouseEntity> warehouses = warehouseRepository.findAll();
                if (warehouses.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "message", "No warehouses found. Please create a warehouse first."));
                }
                targetWarehouseId = warehouses.get(0).getId();
                logger.info("Using default warehouse: {}", targetWarehouseId);
            }

            // Get path to Active stock.csv
            String csvPath = getDefaultActiveStockPath();
            logger.info("Importing from: {}", csvPath);

            // Verify file exists
            if (!java.nio.file.Files.exists(java.nio.file.Paths.get(csvPath))) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "Active stock.csv not found at: " + csvPath));
            }

            // Import the data
            CsvDataImporter.ImportResult result = csvDataImporter.importInventoryAndSupplyPlans(
                    csvPath, targetWarehouseId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Import completed successfully");
            response.put("materialsProcessed", result.getMaterialsProcessed());
            response.put("inventoryCreated", result.getInventoryCreated());
            response.put("supplyPlansCreated", result.getSupplyPlansCreated());
            response.put("errors", result.getErrors());

            logger.info("Import completed: {} materials processed, {} inventory items created",
                    result.getMaterialsProcessed(), result.getInventoryCreated());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error importing Active stock.csv", e);
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "message", "Import failed: " + e.getMessage()));
        }
    }

    /**
     * Get default path for Active stock CSV
     */
    private String getDefaultActiveStockPath() {
        // First try the frontend Database Documents folder
        String[] possiblePaths = {
                "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv",
                System.getProperty("user.dir") + "/Resources/DataBase Resources/Active stock.csv",
                System.getProperty("user.dir") + "/../Resources/DataBase Resources/Active stock.csv"
        };

        for (String path : possiblePaths) {
            if (java.nio.file.Files.exists(java.nio.file.Paths.get(path))) {
                return path;
            }
        }

        // Return the most likely path (even if not found)
        return possiblePaths[0];
    }

    /**
     * Get default path for material dimensions CSV
     */
    private String getDefaultMaterialDimensionsPath() {
        String userDir = System.getProperty("user.dir");
        java.nio.file.Path currentPath = java.nio.file.Paths.get(userDir);

        // Find the backend directory by going up until we find it
        java.nio.file.Path backendDir = currentPath;
        while (backendDir != null && !backendDir.getFileName().toString().equals("backend")) {
            backendDir = backendDir.getParent();
        }

        // If we found backend directory, use it; otherwise assume we're already in
        // project root
        if (backendDir != null) {
            return backendDir.resolve("synthetic_data").resolve("material_dimensions.csv").toString();
        } else {
            // Fallback: assume current directory is project root
            return currentPath.resolve("backend").resolve("synthetic_data").resolve("material_dimensions.csv")
                    .toString();
        }
    }

    /**
     * Get default path for location coordinates CSV
     */
    private String getDefaultLocationCoordinatesPath() {
        String userDir = System.getProperty("user.dir");
        java.nio.file.Path currentPath = java.nio.file.Paths.get(userDir);

        // Find the backend directory by going up until we find it
        java.nio.file.Path backendDir = currentPath;
        while (backendDir != null && !backendDir.getFileName().toString().equals("backend")) {
            backendDir = backendDir.getParent();
        }

        // If we found backend directory, use it; otherwise assume we're already in
        // project root
        if (backendDir != null) {
            return backendDir.resolve("synthetic_data").resolve("location_coordinates.csv").toString();
        } else {
            // Fallback: assume current directory is project root
            return currentPath.resolve("backend").resolve("synthetic_data").resolve("location_coordinates.csv")
                    .toString();
        }
    }

    /**
     * Response object for import operations
     */
    public record ImportResponse(
            boolean success,
            String message,
            int updated,
            int skipped,
            int errors) {
    }
}
