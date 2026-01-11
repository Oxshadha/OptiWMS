package com.optiwms.coreapi.integration;

import com.optiwms.integration.RealisticStorageLocationGenerator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Controller for generating realistic storage locations
 * Creates zones A, B, C, D for ABC/FMS classification
 */
@RestController
@RequestMapping("/api/integration/locations")
public class LocationGenerationController {

    private final RealisticStorageLocationGenerator locationGenerator;

    public LocationGenerationController(RealisticStorageLocationGenerator locationGenerator) {
        this.locationGenerator = locationGenerator;
    }

    /**
     * Generate realistic storage locations for a warehouse
     * Creates zones A, B, C, D with proper structure for ABC/FMS
     * 
     * Zone Structure:
     * - Zone A: 1 row, 5 bays (high accessibility - front/ground)
     * - Zone B: 2 rows, 8 bays each (medium accessibility - middle)
     * - Zone C: 10 rows, 12 bays each (main storage - most locations)
     * - Zone D: 3 rows, 10 bays each (low accessibility - back/upper)
     */
    @PostMapping("/generate/{warehouseId}")
    public ResponseEntity<GenerationResponse> generateRealisticLocations(@PathVariable UUID warehouseId) {
        try {
            int locationCount = locationGenerator.generateRealisticStorageLocations(warehouseId);
            return ResponseEntity.ok(new GenerationResponse(
                true,
                "Generated " + locationCount + " realistic storage locations with zones A, B, C, D",
                locationCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new GenerationResponse(
                false,
                "Failed to generate locations: " + e.getMessage(),
                0
            ));
        }
    }

    public record GenerationResponse(
        boolean success,
        String message,
        int locationCount
    ) {}
}
