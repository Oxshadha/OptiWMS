package com.optiwms.integration;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

/**
 * Service to import synthetic data from CSV files into the database
 * Handles material dimensions and location coordinates
 * Skips ABC/FMS classifications (will be handled by AI service later)
 */
@Service
public class SyntheticDataImportService {

    private static final Logger logger = LoggerFactory.getLogger(SyntheticDataImportService.class);

    private final MaterialRepository materialRepository;
    private final LocationRepository locationRepository;

    public SyntheticDataImportService(MaterialRepository materialRepository, LocationRepository locationRepository) {
        this.materialRepository = materialRepository;
        this.locationRepository = locationRepository;
    }

    /**
     * Import material dimensions from material_dimensions.csv
     * Updates existing materials without creating duplicates
     */
    @Transactional
    public ImportResult importMaterialDimensions(String csvFilePath) {
        // Resolve file path (handle relative paths)
        Path resolvedPath = resolveFilePath(csvFilePath);
        logger.info("Starting material dimensions import from: {} (resolved: {})", csvFilePath, resolvedPath);
        
        int updated = 0;
        int skipped = 0;
        int errors = 0;

        File file = resolvedPath.toFile();
        if (!file.exists()) {
            String errorMsg = String.format("File not found: %s (resolved to: %s)", csvFilePath, resolvedPath);
            logger.error(errorMsg);
            return new ImportResult(0, 0, 1, errorMsg);
        }

        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String line = br.readLine(); // Skip header
            
            if (line == null) {
                logger.error("CSV file is empty");
                return new ImportResult(0, 0, 1, "CSV file is empty");
            }

            while ((line = br.readLine()) != null) {
                try {
                    String[] values = line.split(",");
                    
                    if (values.length < 14) {
                        logger.warn("Skipping line with insufficient columns: {}", line);
                        skipped++;
                        continue;
                    }

                    // Parse material code (remove .0 if present)
                    String materialCode = values[0].trim().replace(".0", "");
                    
                    // Check if material exists
                    Optional<MaterialEntity> materialOpt = materialRepository.findByMaterialCode(materialCode);
                    
                    if (materialOpt.isEmpty()) {
                        logger.warn("Material not found: {}. Skipping.", materialCode);
                        skipped++;
                        continue;
                    }

                    MaterialEntity material = materialOpt.get();
                    
                    // Update dimensions (safely parse values)
                    material.setLengthCm(parseBigDecimal(values[3]));
                    material.setWidthCm(parseBigDecimal(values[4]));
                    material.setHeightCm(parseBigDecimal(values[5]));
                    material.setWeightKg(parseBigDecimal(values[6]));
                    material.setVolumeCm3(parseBigDecimal(values[7]));
                    material.setPalletSpaces(parseBigDecimal(values[8]));
                    material.setStackable(parseBoolean(values[9]));
                    material.setMaxStackHeight(parseInteger(values[10]));
                    material.setTemperatureControlled(parseBoolean(values[11]));
                    material.setHazardous(parseBoolean(values[12]));
                    material.setFragile(parseBoolean(values[13]));

                    materialRepository.save(material);
                    updated++;

                    if (updated % 50 == 0) {
                        logger.info("Processed {} materials...", updated);
                    }

                } catch (Exception e) {
                    logger.error("Error processing line: {}. Error: {}", line, e.getMessage());
                    errors++;
                }
            }

            logger.info("Material dimensions import completed. Updated: {}, Skipped: {}, Errors: {}", updated, skipped, errors);
            return new ImportResult(updated, skipped, errors, "Import completed successfully");

        } catch (IOException e) {
            logger.error("Error reading CSV file: {}", e.getMessage());
            return new ImportResult(0, 0, 1, "Error reading file: " + e.getMessage());
        }
    }

    /**
     * Import location coordinates from location_coordinates.csv
     * Updates existing locations without creating duplicates
     */
    @Transactional
    public ImportResult importLocationCoordinates(String csvFilePath) {
        // Resolve file path (handle relative paths)
        Path resolvedPath = resolveFilePath(csvFilePath);
        logger.info("Starting location coordinates import from: {} (resolved: {})", csvFilePath, resolvedPath);
        
        int updated = 0;
        int skipped = 0;
        int errors = 0;

        File file = resolvedPath.toFile();
        if (!file.exists()) {
            String errorMsg = String.format("File not found: %s (resolved to: %s)", csvFilePath, resolvedPath);
            logger.error(errorMsg);
            return new ImportResult(0, 0, 1, errorMsg);
        }

        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String line = br.readLine(); // Skip header
            
            if (line == null) {
                logger.error("CSV file is empty");
                return new ImportResult(0, 0, 1, "CSV file is empty");
            }

            while ((line = br.readLine()) != null) {
                try {
                    String[] values = line.split(",");
                    
                    if (values.length < 14) {
                        logger.warn("Skipping line with insufficient columns: {}", line);
                        skipped++;
                        continue;
                    }

                    String locationCode = values[0].trim();
                    
                    // Check if location exists
                    Optional<LocationEntity> locationOpt = locationRepository.findByLocationCode(locationCode);
                    
                    if (locationOpt.isEmpty()) {
                        logger.warn("Location not found: {}. Skipping.", locationCode);
                        skipped++;
                        continue;
                    }

                    LocationEntity location = locationOpt.get();
                    
                    // Update coordinates (only if not already set)
                    if (location.getCoordinateX() == null) {
                        location.setCoordinateX(parseBigDecimal(values[7]));
                    }
                    if (location.getCoordinateY() == null) {
                        location.setCoordinateY(parseBigDecimal(values[8]));
                    }
                    if (location.getCoordinateZ() == null) {
                        location.setCoordinateZ(parseBigDecimal(values[9]));
                    }
                    if (location.getAccessibilityRating() == null) {
                        location.setAccessibilityRating(parseInteger(values[10]));
                    }
                    if (location.getMaxPalletCapacity() == null) {
                        location.setMaxPalletCapacity(parseInteger(values[13]));
                    }

                    locationRepository.save(location);
                    updated++;

                    if (updated % 100 == 0) {
                        logger.info("Processed {} locations...", updated);
                    }

                } catch (Exception e) {
                    logger.error("Error processing line: {}. Error: {}", line, e.getMessage());
                    errors++;
                }
            }

            logger.info("Location coordinates import completed. Updated: {}, Skipped: {}, Errors: {}", updated, skipped, errors);
            return new ImportResult(updated, skipped, errors, "Import completed successfully");

        } catch (IOException e) {
            logger.error("Error reading CSV file: {}", e.getMessage());
            return new ImportResult(0, 0, 1, "Error reading file: " + e.getMessage());
        }
    }

    // Helper methods for safe parsing
    private BigDecimal parseBigDecimal(String value) {
        try {
            if (value == null || value.trim().isEmpty() || value.equalsIgnoreCase("null")) {
                return null;
            }
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInteger(String value) {
        try {
            if (value == null || value.trim().isEmpty() || value.equalsIgnoreCase("null")) {
                return null;
            }
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.equalsIgnoreCase("true") || trimmed.equalsIgnoreCase("1") || trimmed.equalsIgnoreCase("yes");
    }

    /**
     * Resolve file path - handles both absolute and relative paths
     * Relative paths are resolved relative to the project root (backend directory)
     */
    private Path resolveFilePath(String filePath) {
        Path path = Paths.get(filePath);
        
        // If absolute path, return as-is
        if (path.isAbsolute()) {
            return path;
        }
        
        // For relative paths, try to resolve from project root
        // First try: backend/synthetic_data/ (if path starts with ../synthetic_data/)
        if (filePath.startsWith("../synthetic_data/") || filePath.startsWith("..\\synthetic_data\\")) {
            String fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
            if (fileName.isEmpty()) {
                fileName = filePath.substring(filePath.lastIndexOf("\\") + 1);
            }
            // Try to find the backend directory
            String userDir = System.getProperty("user.dir");
            Path backendDir = Paths.get(userDir);
            
            // If we're in backend directory, go up one level
            if (backendDir.getFileName().toString().equals("backend")) {
                backendDir = backendDir.getParent();
            }
            
            // Construct path: <project_root>/backend/synthetic_data/<filename>
            Path resolved = backendDir.resolve("backend").resolve("synthetic_data").resolve(fileName);
            if (resolved.toFile().exists()) {
                return resolved;
            }
        }
        
        // Try relative to current working directory
        Path currentDir = Paths.get(System.getProperty("user.dir"));
        Path relativePath = currentDir.resolve(filePath);
        if (relativePath.toFile().exists()) {
            return relativePath;
        }
        
        // Try relative to backend directory
        Path backendPath = currentDir.resolve("backend").resolve(filePath);
        if (backendPath.toFile().exists()) {
            return backendPath;
        }
        
        // Last resort: return the original path (will fail with clear error)
        return path;
    }

    /**
     * Result object for import operations
     */
    public static class ImportResult {
        private final int updated;
        private final int skipped;
        private final int errors;
        private final String message;

        public ImportResult(int updated, int skipped, int errors, String message) {
            this.updated = updated;
            this.skipped = skipped;
            this.errors = errors;
            this.message = message;
        }

        public int getUpdated() { return updated; }
        public int getSkipped() { return skipped; }
        public int getErrors() { return errors; }
        public String getMessage() { return message; }
        
        @Override
        public String toString() {
            return String.format("ImportResult{updated=%d, skipped=%d, errors=%d, message='%s'}", 
                updated, skipped, errors, message);
        }
    }
}
