package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.domain.master.MaterialDefaultLocation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * API for managing default bin locations for materials.
 * Allows admin/warehouse manager to assign bin locations to materials in
 * catalog.
 */
@RestController
@RequestMapping("/api/master/material-default-locations")
public class MaterialDefaultLocationController {

    private final MaterialDefaultLocationService service;

    public MaterialDefaultLocationController(MaterialDefaultLocationService service) {
        this.service = service;
    }

    /**
     * Assign default location to a material in a warehouse
     */
    @PostMapping
    public ResponseEntity<?> assignDefaultLocation(
            @RequestBody AssignDefaultLocationRequest request) {
        try {
            MaterialDefaultLocation location = service.assignDefaultLocation(
                    UUID.fromString(request.materialId()),
                    UUID.fromString(request.warehouseId()),
                    request.locationCode(),
                    request.priority(),
                    request.materialType());
            return ResponseEntity.ok(toDto(location));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Get default locations for a material in a warehouse
     */
    @GetMapping("/material/{materialId}/warehouse/{warehouseId}")
    public ResponseEntity<List<MaterialDefaultLocationDto>> getDefaultLocations(
            @PathVariable UUID materialId,
            @PathVariable UUID warehouseId) {
        try {
            List<MaterialDefaultLocation> locations = service.getDefaultLocations(materialId, warehouseId);
            List<MaterialDefaultLocationDto> dtos = locations.stream()
                    .map(this::toDto)
                    .toList();
            return ResponseEntity.ok(dtos);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(List.of());
        }
    }

    /**
     * Get all materials with their default locations in a warehouse
     * Useful for catalog management UI
     */
    @GetMapping("/warehouse/{warehouseId}/materials")
    public ResponseEntity<List<MaterialWithLocationDto>> getMaterialsWithLocations(
            @PathVariable UUID warehouseId) {
        try {
            List<MaterialDefaultLocationService.MaterialWithLocation> materials = service
                    .getMaterialsWithLocations(warehouseId);
            List<MaterialWithLocationDto> dtos = materials.stream()
                    .map(m -> new MaterialWithLocationDto(
                            m.materialId().toString(),
                            m.materialCode(),
                            m.description(),
                            m.materialType(),
                            m.locationCode(),
                            m.priority()))
                    .toList();
            return ResponseEntity.ok(dtos);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(List.of());
        }
    }

    /**
     * Remove default location assignment
     */
    @DeleteMapping("/material/{materialId}/warehouse/{warehouseId}/location/{locationCode}")
    public ResponseEntity<Void> removeDefaultLocation(
            @PathVariable UUID materialId,
            @PathVariable UUID warehouseId,
            @PathVariable String locationCode) {
        try {
            service.removeDefaultLocation(materialId, warehouseId, locationCode);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Bulk assign default locations to all materials in a warehouse
     * Also updates inventory location_code for existing inventory
     * Useful for initial setup
     */
    @PostMapping("/warehouse/{warehouseId}/assign-all")
    public ResponseEntity<BulkAssignResult> assignAllMaterials(
            @PathVariable UUID warehouseId) {
        try {
            var result = service.assignDefaultLocationsToAllMaterials(warehouseId);
            return ResponseEntity.ok(new BulkAssignResult(
                    true,
                    String.format("Assigned locations to %d materials. Updated %d inventory records.",
                            result.materialsAssigned(), result.inventoryRecordsUpdated())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new BulkAssignResult(false, e.getMessage()));
        }
    }

    /**
     * Sync inventory location_code from existing material default locations.
     * Use this when default locations exist but inventory location_code shows N/A.
     */
    @PostMapping("/warehouse/{warehouseId}/sync-inventory")
    public ResponseEntity<BulkAssignResult> syncInventoryLocations(
            @PathVariable UUID warehouseId) {
        try {
            var result = service.syncInventoryLocationsFromDefaults(warehouseId);
            return ResponseEntity.ok(new BulkAssignResult(
                    true,
                    String.format("Processed %d materials. Updated %d inventory records with location codes.",
                            result.materialsAssigned(), result.inventoryRecordsUpdated())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new BulkAssignResult(false, e.getMessage()));
        }
    }

    private MaterialDefaultLocationDto toDto(MaterialDefaultLocation location) {
        return new MaterialDefaultLocationDto(
                location.getId().toString(),
                location.getMaterialId().toString(),
                location.getWarehouseId().toString(),
                location.getLocationCode(),
                location.getPriority(),
                location.getMaterialType(),
                location.getNotes());
    }

    public record AssignDefaultLocationRequest(
            String materialId,
            String warehouseId,
            String locationCode,
            Integer priority,
            String materialType) {
    }

    public record MaterialDefaultLocationDto(
            String id,
            String materialId,
            String warehouseId,
            String locationCode,
            Integer priority,
            String materialType,
            String notes) {
    }

    public record MaterialWithLocationDto(
            String materialId,
            String materialCode,
            String description,
            String materialType,
            String locationCode,
            Integer priority) {
    }

    public record BulkAssignResult(boolean success, String message) {
    }

    private record ErrorResponse(String message) {
    }

    // Update return type for assignAllMaterials
    // Note: The service now returns BulkAssignResult with counts
}
