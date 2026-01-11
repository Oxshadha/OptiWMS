package com.optiwms.coreapp.master;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.master.MaterialDefaultLocation;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing default bin locations for materials.
 * Allows assigning materials to specific bin locations in the catalog.
 */
@Service
public class MaterialDefaultLocationService {

    private final MaterialDefaultLocationRepository repository;
    private final MaterialService materialService;
    private final LocationService locationService;
    private final InventoryService inventoryService;

    public MaterialDefaultLocationService(
            MaterialDefaultLocationRepository repository,
            MaterialService materialService,
            LocationService locationService,
            InventoryService inventoryService) {
        this.repository = repository;
        this.materialService = materialService;
        this.locationService = locationService;
        this.inventoryService = inventoryService;
    }

    /**
     * Assign default location to a material in a warehouse
     * Also updates inventory location_code if inventory exists for this material+warehouse
     */
    @Transactional
    public MaterialDefaultLocation assignDefaultLocation(
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            Integer priority,
            String materialType) {
        
        // Verify material exists
        materialService.findById(materialId);
        
        // Verify location exists and is a storage location (not staging/receiving/shipment/packing)
        com.optiwms.domain.master.Location location = locationService.findByLocationCodeOptional(locationCode)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));
        
        if (!location.getWarehouseId().equals(warehouseId)) {
            throw new RuntimeException("Location does not belong to warehouse: " + warehouseId);
        }
        
        // Only allow storage locations (exclude staging, receiving, shipment, packing)
        if (!"storage".equals(location.getLocationType()) && 
            !"STORAGE".equals(location.getZoneType())) {
            throw new RuntimeException("Only storage locations can be assigned to materials. Location type: " + location.getLocationType());
        }
        
        MaterialDefaultLocationEntity entity = repository
                .findByMaterialIdAndWarehouseIdAndLocationCode(materialId, warehouseId, locationCode)
                .orElse(new MaterialDefaultLocationEntity());
        
        entity.setMaterialId(materialId);
        entity.setWarehouseId(warehouseId);
        entity.setLocationCode(locationCode);
        entity.setPriority(priority != null ? priority : 1);
        entity.setMaterialType(materialType);
        
        MaterialDefaultLocationEntity saved = repository.save(entity);
        
        // CRITICAL: Also update inventory location_code if inventory exists
        // This ensures bulk assignment updates actual inventory, not just default locations
        List<InventoryItem> existingInventory = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        for (InventoryItem inv : existingInventory) {
            // Only update if inventory has quantity > 0 (in-stock items)
            if (inv.getQuantity() != null && inv.getQuantity() > 0) {
                inv.setLocationCode(locationCode);
                inventoryService.createOrUpdate(inv);
            }
        }
        
        return toDomain(saved);
    }

    /**
     * Get default locations for a material in a warehouse
     */
    public List<MaterialDefaultLocation> getDefaultLocations(UUID materialId, UUID warehouseId) {
        return repository.findByMaterialIdAndWarehouseId(materialId, warehouseId)
                .stream()
                .sorted((a, b) -> Integer.compare(
                        a.getPriority() != null ? a.getPriority() : 999,
                        b.getPriority() != null ? b.getPriority() : 999))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Get primary (priority 1) default location for a material
     */
    public MaterialDefaultLocation getPrimaryLocation(UUID materialId, UUID warehouseId) {
        return repository.findByMaterialIdAndWarehouseId(materialId, warehouseId)
                .stream()
                .filter(loc -> loc.getPriority() != null && loc.getPriority() == 1)
                .findFirst()
                .map(this::toDomain)
                .orElse(null);
    }

    /**
     * Remove default location assignment
     */
    @Transactional
    public void removeDefaultLocation(UUID materialId, UUID warehouseId, String locationCode) {
        repository.findByMaterialIdAndWarehouseIdAndLocationCode(materialId, warehouseId, locationCode)
                .ifPresent(repository::delete);
    }

    /**
     * Get all materials with their default locations in a warehouse
     */
    public List<MaterialWithLocation> getMaterialsWithLocations(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId)
                .stream()
                .map(entity -> {
                    Material material = materialService.findById(entity.getMaterialId());
                    return new MaterialWithLocation(
                            material.getId(),
                            material.getMaterialCode(),
                            material.getDescription(),
                            material.getMaterialType(),
                            entity.getLocationCode(),
                            entity.getPriority()
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * Assign default locations to all materials in a warehouse (bulk assignment)
     * Also updates inventory location_code for existing inventory
     * Useful for initial setup
     */
    @Transactional
    public BulkAssignResult assignDefaultLocationsToAllMaterials(UUID warehouseId) {
        // Get all materials
        List<Material> materials = materialService.listAll();
        
        // Get all storage locations in warehouse
        List<com.optiwms.domain.master.Location> storageLocations = locationService.findStorageLocationsByWarehouse(warehouseId);
        
        if (storageLocations.isEmpty()) {
            throw new RuntimeException("No storage locations found in warehouse. Please create storage locations first.");
        }
        
        int assignedCount = 0;
        int inventoryUpdatedCount = 0;
        
        // Assign locations based on material type
        int locationIndex = 0;
        for (Material material : materials) {
            if (locationIndex >= storageLocations.size()) {
                locationIndex = 0; // Cycle back
            }
            
            com.optiwms.domain.master.Location location = storageLocations.get(locationIndex);
            
            // Check if already assigned
            if (repository.findByMaterialIdAndWarehouseId(material.getId(), warehouseId).isEmpty()) {
                assignDefaultLocation(
                        material.getId(),
                        warehouseId,
                        location.getLocationCode(),
                        1,
                        material.getMaterialType()
                );
                assignedCount++;
                
                // Count inventory updates
                List<InventoryItem> inventory = inventoryService.findByMaterialAndWarehouse(material.getId(), warehouseId);
                for (InventoryItem inv : inventory) {
                    if (inv.getQuantity() != null && inv.getQuantity() > 0) {
                        inventoryUpdatedCount++;
                    }
                }
            }
            
            locationIndex++;
        }
        
        return new BulkAssignResult(assignedCount, inventoryUpdatedCount);
    }
    
    public record BulkAssignResult(int materialsAssigned, int inventoryRecordsUpdated) {}

    private MaterialDefaultLocation toDomain(MaterialDefaultLocationEntity entity) {
        MaterialDefaultLocation domain = new MaterialDefaultLocation();
        domain.setId(entity.getId());
        domain.setMaterialId(entity.getMaterialId());
        domain.setWarehouseId(entity.getWarehouseId());
        domain.setLocationCode(entity.getLocationCode());
        domain.setPriority(entity.getPriority());
        domain.setMaterialType(entity.getMaterialType());
        domain.setNotes(entity.getNotes());
        domain.setCreatedAt(entity.getCreatedAt());
        domain.setUpdatedAt(entity.getUpdatedAt());
        return domain;
    }

    public record MaterialWithLocation(
            UUID materialId,
            String materialCode,
            String description,
            String materialType,
            String locationCode,
            Integer priority
    ) {}
}
