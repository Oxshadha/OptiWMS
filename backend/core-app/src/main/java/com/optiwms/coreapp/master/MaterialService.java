package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Material;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.infra.inventory.InventoryItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class MaterialService {

    private final MaterialRepository repository;
    private final OrderItemRepository orderItemRepository;
    private final InventoryItemRepository inventoryItemRepository;

    public MaterialService(
            MaterialRepository repository,
            OrderItemRepository orderItemRepository,
            InventoryItemRepository inventoryItemRepository) {
        this.repository = repository;
        this.orderItemRepository = orderItemRepository;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    /**
     * Normalize material type to ensure consistent values in database.
     * Handles variations like "packing_material" -> "packaging_material"
     * Industry Best Practice: Centralized normalization prevents data inconsistencies
     */
    private String normalizeMaterialType(String materialType) {
        if (materialType == null || materialType.trim().isEmpty()) {
            return "raw_material"; // Default
        }
        
        String normalized = materialType.toLowerCase().trim();
        
        // Handle common variations
        if (normalized.equals("packing_material") || normalized.equals("packaging")) {
            return "packaging_material";
        }
        if (normalized.equals("raw") || normalized.equals("rawmaterial")) {
            return "raw_material";
        }
        if (normalized.equals("finished_good") || normalized.equals("finished_goods") 
            || normalized.equals("finished_product") || normalized.equals("products")) {
            return "product";
        }
        
        // Return valid values as-is, default invalid ones to raw_material
        if (normalized.equals("raw_material") || normalized.equals("packaging_material") || normalized.equals("product")) {
            return normalized;
        }
        
        // Invalid value - default to raw_material
        return "raw_material";
    }

    public List<Material> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Material> findByMaterialType(String materialType) {
        return repository.findByMaterialType(materialType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Material findById(java.util.UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Material not found: " + id));
    }

    public Material findByCode(String materialCode) {
        // First try exact match
        Optional<MaterialEntity> exactMatch = repository.findByMaterialCode(materialCode.trim());
        if (exactMatch.isPresent()) {
            return toDomain(exactMatch.get());
        }
        
        // If not found, try case-insensitive lookup
        Optional<MaterialEntity> caseInsensitiveMatch = repository.findByMaterialCodeIgnoreCase(materialCode);
        if (caseInsensitiveMatch.isPresent()) {
            return toDomain(caseInsensitiveMatch.get());
        }
        
        throw new RuntimeException("Material not found: " + materialCode);
    }

    @Transactional
    public Material create(Material material) {
        if (repository.existsByMaterialCode(material.getMaterialCode())) {
            throw new RuntimeException("Material code already exists: " + material.getMaterialCode());
        }
        return createOrUpdate(material);
    }

    @Transactional
    public Material update(java.util.UUID id, Material material) {
        MaterialEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Material not found: " + id));

        // Check if material code is being changed and if it conflicts
        if (!entity.getMaterialCode().equals(material.getMaterialCode())) {
            if (repository.existsByMaterialCode(material.getMaterialCode())) {
                throw new RuntimeException("Material code already exists: " + material.getMaterialCode());
            }
        }

        entity.setMaterialCode(material.getMaterialCode());
        entity.setDescription(material.getDescription());
        entity.setUnitType(material.getUnitType());
        entity.setStorageType(material.getStorageType() != null ? material.getStorageType() : "pallet");
        entity.setMaterialType(normalizeMaterialType(material.getMaterialType()));
        entity.setLengthCm(material.getLengthCm());
        entity.setWidthCm(material.getWidthCm());
        entity.setHeightCm(material.getHeightCm());
        entity.setWeightKg(material.getWeightKg());
        entity.setVolumeCm3(material.getVolumeCm3());

        MaterialEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Material not found");
        }
        
        // Check if material is referenced in order items
        long orderItemCount = orderItemRepository.findByMaterialId(id).size();
        if (orderItemCount > 0) {
            throw new RuntimeException("Cannot delete material: It is currently used in " + orderItemCount + " order item(s). Please remove it from all orders first.");
        }
        
        // Check if material is referenced in inventory
        long inventoryCount = inventoryItemRepository.findByMaterialId(id).size();
        if (inventoryCount > 0) {
            throw new RuntimeException("Cannot delete material: It has inventory records. Please remove all inventory first.");
        }
        
        try {
            repository.deleteById(id);
        } catch (DataIntegrityViolationException e) {
            // Catch any other foreign key violations and provide user-friendly message
            String message = e.getMessage();
            if (message != null && message.contains("foreign key constraint")) {
                if (message.contains("order_items")) {
                    throw new RuntimeException("Cannot delete material: It is currently used in order items. Please remove it from all orders first.");
                } else if (message.contains("inventory")) {
                    throw new RuntimeException("Cannot delete material: It has inventory records. Please remove all inventory first.");
                } else {
                    throw new RuntimeException("Cannot delete material: It is referenced by other records in the system.");
                }
            }
            throw new RuntimeException("Cannot delete material: It is referenced by other records in the system.");
        }
    }

    @Transactional
    public Material createOrUpdate(Material material) {
        MaterialEntity entity = repository.findByMaterialCode(material.getMaterialCode())
                .orElse(new MaterialEntity());

        entity.setMaterialCode(material.getMaterialCode());
        entity.setDescription(material.getDescription());
        entity.setUnitType(material.getUnitType());
        entity.setStorageType(material.getStorageType() != null ? material.getStorageType() : "pallet");
        entity.setMaterialType(normalizeMaterialType(material.getMaterialType()));
        entity.setLengthCm(material.getLengthCm());
        entity.setWidthCm(material.getWidthCm());
        entity.setHeightCm(material.getHeightCm());
        if (material.getWeightKg() != null) {
            entity.setWeightKg(material.getWeightKg());
        }
        if (material.getVolumeCm3() != null) {
            entity.setVolumeCm3(material.getVolumeCm3());
        }

        MaterialEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public List<Material> importMaterials(List<Material> materials) {
        return materials.stream()
                .map(this::createOrUpdate)
                .collect(Collectors.toList());
    }

    private Material toDomain(MaterialEntity entity) {
        Material m = new Material();
        m.setId(entity.getId());
        m.setMaterialCode(entity.getMaterialCode());
        m.setDescription(entity.getDescription());
        m.setUnitType(entity.getUnitType());
        m.setStorageType(entity.getStorageType());
        m.setMaterialType(entity.getMaterialType());
        m.setLengthCm(entity.getLengthCm());
        m.setWidthCm(entity.getWidthCm());
        m.setHeightCm(entity.getHeightCm());
        m.setWeightKg(entity.getWeightKg());
        m.setVolumeCm3(entity.getVolumeCm3());
        m.setPalletSpaces(entity.getPalletSpaces());
        m.setStackable(entity.getStackable());
        m.setMaxStackHeight(entity.getMaxStackHeight());
        m.setTemperatureControlled(entity.getTemperatureControlled());
        m.setHazardous(entity.getHazardous());
        m.setFragile(entity.getFragile());
        m.setMaxPalletWeightKg(entity.getMaxPalletWeightKg());
        m.setMinOrderQuantity(entity.getMinOrderQuantity());
        m.setSafetyStockLevel(entity.getSafetyStockLevel());
        return m;
    }
}
