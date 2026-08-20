package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Material;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.infra.inventory.InventoryItemRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MaterialService {
    private static final List<String> OPERATIONAL_TIERS = List.of(
            "PROJECT_OPERATIONAL_SIMULATION", "GENERATED_OPERATIONAL_BASELINE", "OPERATIONAL_ENTRY");
    private static final List<String> ALLOWED_STORAGE_TYPES = List.of("pallet", "bulk", "loose", "rack", "cold");
    private static final List<String> ALLOWED_UNIT_TYPES = List.of("bag", "drum", "reel", "bucket", "pallet", "pcs",
            "unit");

    private final MaterialRepository repository;
    private final MaterialDefaultLocationRepository materialDefaultLocationRepository;
    private final OrderItemRepository orderItemRepository;
    private final InventoryItemRepository inventoryItemRepository;

    public MaterialService(
            MaterialRepository repository,
            MaterialDefaultLocationRepository materialDefaultLocationRepository,
            OrderItemRepository orderItemRepository,
            InventoryItemRepository inventoryItemRepository) {
        this.repository = repository;
        this.materialDefaultLocationRepository = materialDefaultLocationRepository;
        this.orderItemRepository = orderItemRepository;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    /**
     * Normalize material type to ensure consistent values in database.
     * Handles variations like "packing_material" -> "packaging_material"
     * Industry Best Practice: Centralized normalization prevents data
     * inconsistencies
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
        if (normalized.equals("raw_material") || normalized.equals("packaging_material")
                || normalized.equals("product")) {
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

    public List<Material> listOperational() {
        return repository.findByDataQualityTierIn(OPERATIONAL_TIERS).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Material> findOperationalByMaterialType(String materialType) {
        return repository.findByMaterialTypeAndDataQualityTierIn(materialType, OPERATIONAL_TIERS).stream()
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

    public Page<Material> findPaged(String materialType, String query, Pageable pageable) {
        return findPaged(materialType, query, true, pageable);
    }

    public Page<Material> findPaged(String materialType, String query, boolean includeLegacy, Pageable pageable) {
        Set<UUID> materialIdsForLocationQuery = Collections.emptySet();
        String normalizedQuery = null;
        if (query != null && !query.isBlank()) {
            normalizedQuery = normalizeForSearch(query);
            final String normalizedQueryValue = normalizedQuery;
            materialIdsForLocationQuery = materialDefaultLocationRepository.findAll().stream()
                    .filter(loc -> normalizeForSearch(loc.getLocationCode()).contains(normalizedQueryValue))
                    .map(loc -> loc.getMaterialId())
                    .collect(Collectors.toSet());
        }

        final Set<UUID> finalMaterialIdsForLocationQuery = materialIdsForLocationQuery;
        final String finalNormalizedQuery = normalizedQuery;
        Specification<MaterialEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!includeLegacy) {
                predicates.add(root.get("dataQualityTier").in(
                        "PROJECT_OPERATIONAL_SIMULATION",
                        "GENERATED_OPERATIONAL_BASELINE",
                        "OPERATIONAL_ENTRY"));
            }
            if (materialType != null && !materialType.isBlank()) {
                predicates.add(cb.equal(root.get("materialType"), materialType));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                Predicate textMatch = cb.or(
                        cb.like(cb.lower(root.get("materialCode")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(root.get("unitType")), pattern),
                        cb.like(cb.lower(root.get("storageType")), pattern),
                        cb.like(cb.lower(root.get("materialType")), pattern));
                if (!finalMaterialIdsForLocationQuery.isEmpty()) {
                    textMatch = cb.or(
                            textMatch,
                            root.get("id").in(finalMaterialIdsForLocationQuery));
                }

                if (finalNormalizedQuery != null && !finalNormalizedQuery.isBlank()) {
                    var normalizedMaterialCode = cb.function("replace", String.class,
                            cb.function("replace", String.class,
                                    cb.function("replace", String.class, cb.lower(root.get("materialCode")),
                                            cb.literal("-"), cb.literal("")),
                                    cb.literal(" "), cb.literal("")),
                            cb.literal("_"), cb.literal(""));
                    var normalizedDescription = cb.function("replace", String.class,
                            cb.function("replace", String.class,
                                    cb.function("replace", String.class, cb.lower(root.get("description")),
                                            cb.literal("-"), cb.literal("")),
                                    cb.literal(" "), cb.literal("")),
                            cb.literal("_"), cb.literal(""));
                    String normalizedPattern = "%" + finalNormalizedQuery + "%";
                    textMatch = cb.or(
                            textMatch,
                            cb.like(normalizedMaterialCode, normalizedPattern),
                            cb.like(normalizedDescription, normalizedPattern));
                }
                predicates.add(textMatch);
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    private String normalizeForSearch(String value) {
        if (value == null)
            return "";
        return value.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    @Transactional
    public Material create(Material material) {
        validateOperationalData(material, true);
        if (repository.existsByMaterialCode(material.getMaterialCode())) {
            throw new RuntimeException("Material code already exists: " + material.getMaterialCode());
        }
        return createOrUpdate(material);
    }

    @Transactional
    public Material update(java.util.UUID id, Material material) {
        validateOperationalData(material, false);
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
        entity.setUnitType(normalizeUnitType(material.getUnitType()));
        entity.setStorageType(normalizeStorageType(material.getStorageType()));
        entity.setMaterialType(normalizeMaterialType(material.getMaterialType()));
        entity.setLengthCm(material.getLengthCm());
        entity.setWidthCm(material.getWidthCm());
        entity.setHeightCm(material.getHeightCm());
        entity.setWeightKg(material.getWeightKg());
        entity.setVolumeCm3(material.getVolumeCm3());
        entity.setPalletSpaces(material.getPalletSpaces());
        entity.setUnitsPerPallet(material.getUnitsPerPallet());
        entity.setMaxPalletWeightKg(material.getMaxPalletWeightKg());
        entity.setMinOrderQuantity(material.getMinOrderQuantity());
        entity.setHandlingUnitType(normalizeUnitType(material.getHandlingUnitType() != null ? material.getHandlingUnitType() : material.getUnitType()));
        entity.setUnitsPerHandlingUnit(defaultPositive(material.getUnitsPerHandlingUnit(), material.getPalletSpaces(), BigDecimal.ONE));
        entity.setOrderMultiple(defaultPositive(material.getOrderMultiple(), material.getPalletSpaces(), material.getMinOrderQuantity(), BigDecimal.ONE));

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
            throw new RuntimeException("Cannot delete material: It is currently used in " + orderItemCount
                    + " order item(s). Please remove it from all orders first.");
        }

        // Check if material is referenced in inventory
        long inventoryCount = inventoryItemRepository.findByMaterialId(id).size();
        if (inventoryCount > 0) {
            throw new RuntimeException(
                    "Cannot delete material: It has inventory records. Please remove all inventory first.");
        }

        try {
            repository.deleteById(id);
        } catch (DataIntegrityViolationException e) {
            // Catch any other foreign key violations and provide user-friendly message
            String message = e.getMessage();
            if (message != null && message.contains("foreign key constraint")) {
                if (message.contains("order_items")) {
                    throw new RuntimeException(
                            "Cannot delete material: It is currently used in order items. Please remove it from all orders first.");
                } else if (message.contains("inventory")) {
                    throw new RuntimeException(
                            "Cannot delete material: It has inventory records. Please remove all inventory first.");
                } else {
                    throw new RuntimeException(
                            "Cannot delete material: It is referenced by other records in the system.");
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
        entity.setUnitType(normalizeUnitType(material.getUnitType()));
        entity.setStorageType(normalizeStorageType(material.getStorageType()));
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
        if (material.getPalletSpaces() != null) {
            entity.setPalletSpaces(material.getPalletSpaces());
        }
        if (material.getMaxPalletWeightKg() != null) {
            entity.setMaxPalletWeightKg(material.getMaxPalletWeightKg());
        }
        if (material.getMinOrderQuantity() != null) {
            entity.setMinOrderQuantity(material.getMinOrderQuantity());
        }
        entity.setHandlingUnitType(normalizeUnitType(material.getHandlingUnitType() != null ? material.getHandlingUnitType() : material.getUnitType()));
        entity.setUnitsPerHandlingUnit(defaultPositive(material.getUnitsPerHandlingUnit(), material.getPalletSpaces(), entity.getPalletSpaces(), BigDecimal.ONE));
        entity.setOrderMultiple(defaultPositive(material.getOrderMultiple(), material.getPalletSpaces(), material.getMinOrderQuantity(), entity.getMinOrderQuantity(), BigDecimal.ONE));

        MaterialEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public List<Material> importMaterials(List<Material> materials) {
        return materials.stream()
                .map(this::createOrUpdate)
                .collect(Collectors.toList());
    }

    private void validateOperationalData(Material material, boolean strictForCreate) {
        if (material == null) {
            throw new RuntimeException("Material payload is required");
        }
        if (isBlank(material.getMaterialCode())) {
            throw new RuntimeException("Material code is required");
        }
        if (isBlank(material.getDescription())) {
            throw new RuntimeException("Description is required");
        }

        String unitType = normalizeUnitType(material.getUnitType());
        String storageType = normalizeStorageType(material.getStorageType());
        material.setUnitType(unitType);
        material.setStorageType(storageType);

        if (strictForCreate) {
            if (isBlank(unitType)) {
                throw new RuntimeException("Handling unit type is required");
            }
            if (isBlank(storageType)) {
                throw new RuntimeException("Storage type is required");
            }
        }

        validatePositiveIfPresent("weight_kg", material.getWeightKg());
        validatePositiveIfPresent("volume_cm3", material.getVolumeCm3());
        validatePositiveIfPresent("length_cm", material.getLengthCm());
        validatePositiveIfPresent("width_cm", material.getWidthCm());
        validatePositiveIfPresent("height_cm", material.getHeightCm());
        validatePositiveIfPresent("pallet_spaces", material.getPalletSpaces());
        validatePositiveIfPresent("max_pallet_weight_kg", material.getMaxPalletWeightKg());
        validatePositiveIfPresent("min_order_quantity", material.getMinOrderQuantity());
        validatePositiveIfPresent("units_per_handling_unit", material.getUnitsPerHandlingUnit());
        validatePositiveIfPresent("order_multiple", material.getOrderMultiple());
        material.setHandlingUnitType(normalizeUnitType(
                !isBlank(material.getHandlingUnitType()) ? material.getHandlingUnitType() : unitType));
        material.setUnitsPerHandlingUnit(defaultPositive(material.getUnitsPerHandlingUnit(), material.getPalletSpaces(), BigDecimal.ONE));
        material.setOrderMultiple(defaultPositive(material.getOrderMultiple(), material.getPalletSpaces(), material.getMinOrderQuantity(), BigDecimal.ONE));

        if (material.getVolumeCm3() == null && material.getLengthCm() != null
                && material.getWidthCm() != null && material.getHeightCm() != null) {
            material.setVolumeCm3(
                    material.getLengthCm().multiply(material.getWidthCm()).multiply(material.getHeightCm()));
        }

        if (strictForCreate) {
            if (material.getWeightKg() == null) {
                throw new RuntimeException("Unit weight (kg) is required for putaway capacity checks");
            }
            if (material.getVolumeCm3() == null) {
                throw new RuntimeException("Unit volume (cm3) or complete dimensions are required");
            }
            if ("pallet".equals(storageType)) {
                if (material.getPalletSpaces() == null) {
                    throw new RuntimeException("Units per pallet is required for pallet storage");
                }
                if (material.getMaxPalletWeightKg() == null) {
                    throw new RuntimeException("Max pallet weight (kg) is required for pallet storage");
                }
            }
        }
    }

    private String normalizeStorageType(String storageType) {
        if (isBlank(storageType)) {
            return "pallet";
        }
        String normalized = storageType.trim().toLowerCase();
        if ("cold_storage".equals(normalized)) {
            normalized = "cold";
        }
        if (!ALLOWED_STORAGE_TYPES.contains(normalized)) {
            throw new RuntimeException("Invalid storage type: " + storageType);
        }
        return normalized;
    }

    private String normalizeUnitType(String unitType) {
        if (isBlank(unitType)) {
            return "unit";
        }
        String normalized = unitType.trim().toLowerCase();
        if ("piece".equals(normalized) || "pieces".equals(normalized)) {
            normalized = "pcs";
        }
        if (!ALLOWED_UNIT_TYPES.contains(normalized)) {
            throw new RuntimeException("Invalid unit type: " + unitType);
        }
        return normalized;
    }

    private void validatePositiveIfPresent(String field, BigDecimal value) {
        if (value != null && value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException(field + " must be greater than 0");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
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
        m.setUnitsPerPallet(entity.getUnitsPerPallet());
        m.setStackable(entity.getStackable());
        m.setMaxStackHeight(entity.getMaxStackHeight());
        m.setTemperatureControlled(entity.getTemperatureControlled());
        m.setHazardous(entity.getHazardous());
        m.setFragile(entity.getFragile());
        m.setMaxPalletWeightKg(entity.getMaxPalletWeightKg());
        m.setMinOrderQuantity(entity.getMinOrderQuantity());
        m.setHandlingUnitType(entity.getHandlingUnitType() != null ? entity.getHandlingUnitType() : entity.getUnitType());
        m.setUnitsPerHandlingUnit(defaultPositive(entity.getUnitsPerHandlingUnit(), entity.getPalletSpaces(), BigDecimal.ONE));
        m.setOrderMultiple(defaultPositive(entity.getOrderMultiple(), entity.getPalletSpaces(), entity.getMinOrderQuantity(), BigDecimal.ONE));
        m.setSafetyStockLevel(entity.getSafetyStockLevel());
        return m;
    }

    private BigDecimal defaultPositive(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null && value.compareTo(BigDecimal.ZERO) > 0) {
                return value;
            }
        }
        return BigDecimal.ONE;
    }
}
