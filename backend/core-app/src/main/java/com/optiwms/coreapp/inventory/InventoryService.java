package com.optiwms.coreapp.inventory;

import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class InventoryService {

    private final InventoryItemRepository repository;
    private final MaterialRepository materialRepository;
    private final LocationRepository locationRepository;
    private final HandlingUnitCapacityService capacityService;

    public InventoryService(
            InventoryItemRepository repository,
            MaterialRepository materialRepository,
            LocationRepository locationRepository,
            HandlingUnitCapacityService capacityService) {
        this.repository = repository;
        this.materialRepository = materialRepository;
        this.locationRepository = locationRepository;
        this.capacityService = capacityService;
    }

    public List<InventoryItem> listAll() {
        return repository.findAll((root, cq, cb) -> root.get("dataQualityTier").in(
                        "PROJECT_OPERATIONAL_SIMULATION",
                        "GENERATED_OPERATIONAL_BASELINE", "OPERATIONAL_ENTRY")).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public InventoryItem findById(java.util.UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Inventory item not found: " + id));
    }

    public List<InventoryItem> findByMaterial(java.util.UUID materialId) {
        return repository.findByMaterialId(materialId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByWarehouse(java.util.UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByMaterialAndWarehouse(java.util.UUID materialId, java.util.UUID warehouseId) {
        return repository.findByMaterialIdAndWarehouseId(materialId, warehouseId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByMaterialWarehouseAndLocation(java.util.UUID materialId, java.util.UUID warehouseId, String locationCode) {
        return repository.findByMaterialIdAndWarehouseIdAndLocationCode(materialId, warehouseId, locationCode).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByLocationCode(String locationCode) {
        return repository.findByLocationCode(locationCode).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByMaterialType(String materialType) {
        return repository.findByMaterialType(materialType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findByWarehouseAndMaterialType(java.util.UUID warehouseId, String materialType) {
        return repository.findByWarehouseIdAndMaterialType(warehouseId, materialType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findQuarantined() {
        return repository.findByStatus("quarantine").stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<InventoryItem> findQuarantinedByWarehouse(java.util.UUID warehouseId) {
        return repository.findByWarehouseIdAndStatus(warehouseId, "quarantine").stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Page<InventoryItem> findPaged(
            UUID materialId,
            UUID warehouseId,
            String materialType,
            String status,
            String stockState,
            String query,
            Pageable pageable
    ) {
        return findPaged(materialId, warehouseId, materialType, status, stockState, query, true, pageable);
    }

    public Page<InventoryItem> findPaged(
            UUID materialId,
            UUID warehouseId,
            String materialType,
            String status,
            String stockState,
            String query,
            boolean includeLegacy,
            Pageable pageable
    ) {
        Set<UUID> materialIdsForQuery = Collections.emptySet();
        if (query != null && !query.isBlank()) {
            String trimmed = query.trim();
            materialIdsForQuery = materialRepository
                    .findByMaterialCodeContainingIgnoreCaseOrDescriptionContainingIgnoreCase(trimmed, trimmed)
                    .stream()
                    .map(m -> m.getId())
                    .collect(Collectors.toSet());
        }
        String normalizedQuery = (query == null || query.isBlank()) ? null : normalizeForSearch(query);

        final Set<UUID> finalMaterialIdsForQuery = materialIdsForQuery;
        final String finalNormalizedQuery = normalizedQuery;
        Specification<InventoryItemEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (!includeLegacy) {
                predicates.add(root.get("dataQualityTier").in(
                        "PROJECT_OPERATIONAL_SIMULATION",
                        "GENERATED_OPERATIONAL_BASELINE",
                        "OPERATIONAL_ENTRY"));
            }

            if (materialId != null) {
                predicates.add(cb.equal(root.get("materialId"), materialId));
            }
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (materialType != null && !materialType.isBlank()) {
                predicates.add(cb.equal(root.get("materialType"), materialType));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (stockState != null && !stockState.isBlank() && !"all".equalsIgnoreCase(stockState)) {
                var quantity = root.<Integer>get("quantity");
                var available = root.<Integer>get("availableQuantity");
                var quantityDecimal = quantity.as(java.math.BigDecimal.class);
                Predicate low = cb.and(
                        cb.greaterThan(quantity, 0),
                        cb.or(
                                cb.lessThan(available, 10),
                                cb.lessThan(quantity, 10),
                                cb.and(cb.isNotNull(root.get("reorderPoint")), cb.lessThanOrEqualTo(quantityDecimal, root.get("reorderPoint"))),
                                cb.and(cb.isNotNull(root.get("bufferStock")), cb.lessThanOrEqualTo(quantityDecimal, root.get("bufferStock")))
                        ));
                if ("low".equalsIgnoreCase(stockState)) {
                    predicates.add(low);
                } else if ("available".equalsIgnoreCase(stockState)) {
                    predicates.add(cb.and(cb.greaterThan(quantity, 0), cb.greaterThan(available, 0), cb.not(low)));
                }
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                String normalizedPattern = "%" + finalNormalizedQuery + "%";

                var normalizedLocation = cb.function("replace", String.class,
                        cb.function("replace", String.class,
                                cb.function("replace", String.class, cb.lower(root.get("locationCode")), cb.literal("-"), cb.literal("")),
                                cb.literal(" "), cb.literal("")),
                        cb.literal("_"), cb.literal(""));
                var normalizedLpn = cb.function("replace", String.class,
                        cb.function("replace", String.class,
                                cb.function("replace", String.class, cb.lower(root.get("lpnCode")), cb.literal("-"), cb.literal("")),
                                cb.literal(" "), cb.literal("")),
                        cb.literal("_"), cb.literal(""));

                Predicate textMatch = cb.or(
                        cb.like(cb.lower(root.get("locationCode")), pattern),
                        cb.like(cb.lower(root.get("lpnCode")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("batchNumber")), pattern),
                        cb.like(normalizedLocation, normalizedPattern),
                        cb.like(normalizedLpn, normalizedPattern)
                );
                if (!finalMaterialIdsForQuery.isEmpty()) {
                    textMatch = cb.or(textMatch, root.get("materialId").in(finalMaterialIdsForQuery));
                }
                predicates.add(textMatch);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    public InventorySummary summarize(UUID warehouseId, String materialType) {
        var summary = repository.summarizeOperational(warehouseId, materialType);
        return new InventorySummary(
                value(summary.getTotalItems()),
                value(summary.getInStockItems()),
                value(summary.getLowStockItems()),
                value(summary.getOutOfStockItems()));
    }

    private long value(Long value) {
        return value == null ? 0L : value;
    }

    public record InventorySummary(
            long totalItems,
            long inStockItems,
            long lowStockItems,
            long outOfStockItems) {
    }

    private String normalizeForSearch(String value) {
        if (value == null) return "";
        return value.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    @Transactional
    public InventoryItem update(java.util.UUID id, InventoryItem item) {
        InventoryItemEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inventory item not found: " + id));

        // Update warehouse if provided
        if (item.getWarehouseId() != null) {
            entity.setWarehouseId(item.getWarehouseId());
        }
        entity.setLocationCode(item.getLocationCode());
        if (item.getLpnCode() != null) {
            entity.setLpnCode(item.getLpnCode());
        }
        if (item.getQuantity() != null) {
            entity.setQuantity(item.getQuantity());
        }
        if (item.getAvailableQuantity() != null) {
            entity.setAvailableQuantity(item.getAvailableQuantity());
        }
        if (item.getReservedQuantity() != null) {
            entity.setReservedQuantity(item.getReservedQuantity());
        }
        entity.setBufferStock(item.getBufferStock());
        entity.setMaxStock(item.getMaxStock());
        entity.setMinStock(item.getMinStock());
        entity.setReorderPoint(item.getReorderPoint());
        entity.setStackingQuantity(item.getStackingQuantity());
        entity.setMoq(item.getMoq());
        entity.setLeadTimeDays(item.getLeadTimeDays());
        entity.setBufferDays(item.getBufferDays());
        entity.setLeadTimeMonths(item.getLeadTimeMonths());
        entity.setRopInDays(item.getRopInDays());
        entity.setVarianceDemand(item.getVarianceDemand());
        entity.setVarianceLeadTimeDemand(item.getVarianceLeadTimeDemand());
        entity.setDifference(item.getDifference());
        entity.setOrderDeliveryDays(item.getOrderDeliveryDays());
        entity.setOrderQuantity(item.getOrderQuantity());
        entity.setPalletRequirement(item.getPalletRequirement());
        if (item.getStatus() != null) {
            entity.setStatus(item.getStatus());
        }
        if (item.getMaterialType() != null) {
            entity.setMaterialType(item.getMaterialType());
        }
        entity.setBatchNumber(item.getBatchNumber());
        entity.setExpiryDate(item.getExpiryDate());
        entity.setLastMovementDate(item.getLastMovementDate());
        entity.setDaysSinceLastMovement(item.getDaysSinceLastMovement());
        validateSingleBinAssignment(entity);

        InventoryItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public InventoryItem createOrUpdate(InventoryItem item) {
        InventoryItemEntity entity = repository.findByMaterialIdAndWarehouseId(
                item.getMaterialId(), item.getWarehouseId())
                .stream()
                .filter(existing -> sameInventoryBucket(existing, item))
                .findFirst()
                .orElse(new InventoryItemEntity());

        entity.setMaterialId(item.getMaterialId());
        entity.setWarehouseId(item.getWarehouseId());
        entity.setLocationCode(item.getLocationCode());
        entity.setLpnCode(item.getLpnCode());
        entity.setQuantity(item.getQuantity() != null ? item.getQuantity() : 0);
        entity.setAvailableQuantity(item.getAvailableQuantity() != null ? item.getAvailableQuantity() : (item.getQuantity() != null ? item.getQuantity() : 0));
        entity.setReservedQuantity(item.getReservedQuantity() != null ? item.getReservedQuantity() : 0);
        entity.setBufferStock(item.getBufferStock());
        entity.setMaxStock(item.getMaxStock());
        entity.setMinStock(item.getMinStock());
        entity.setReorderPoint(item.getReorderPoint());
        entity.setStackingQuantity(item.getStackingQuantity());
        entity.setMoq(item.getMoq());
        entity.setLeadTimeDays(item.getLeadTimeDays());
        entity.setBufferDays(item.getBufferDays());
        entity.setLeadTimeMonths(item.getLeadTimeMonths());
        entity.setRopInDays(item.getRopInDays());
        entity.setVarianceDemand(item.getVarianceDemand());
        entity.setVarianceLeadTimeDemand(item.getVarianceLeadTimeDemand());
        entity.setDifference(item.getDifference());
        entity.setOrderDeliveryDays(item.getOrderDeliveryDays());
        entity.setOrderQuantity(item.getOrderQuantity());
        entity.setPalletRequirement(item.getPalletRequirement());
        entity.setStatus(item.getStatus() != null ? item.getStatus() : "active");
        entity.setMaterialType(item.getMaterialType());
        entity.setBatchNumber(item.getBatchNumber());
        entity.setExpiryDate(item.getExpiryDate());
        entity.setLastMovementDate(item.getLastMovementDate());
        entity.setDaysSinceLastMovement(item.getDaysSinceLastMovement());
        validateSingleBinAssignment(entity);

        InventoryItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public InventoryItem createNew(InventoryItem item) {
        InventoryItemEntity entity = new InventoryItemEntity();
        entity.setMaterialId(item.getMaterialId());
        entity.setWarehouseId(item.getWarehouseId());
        entity.setLocationCode(item.getLocationCode());
        entity.setLpnCode(item.getLpnCode());
        entity.setQuantity(item.getQuantity() != null ? item.getQuantity() : 0);
        entity.setAvailableQuantity(item.getAvailableQuantity() != null ? item.getAvailableQuantity() : (item.getQuantity() != null ? item.getQuantity() : 0));
        entity.setReservedQuantity(item.getReservedQuantity() != null ? item.getReservedQuantity() : 0);
        entity.setBufferStock(item.getBufferStock());
        entity.setMaxStock(item.getMaxStock());
        entity.setMinStock(item.getMinStock());
        entity.setReorderPoint(item.getReorderPoint());
        entity.setStackingQuantity(item.getStackingQuantity());
        entity.setMoq(item.getMoq());
        entity.setLeadTimeDays(item.getLeadTimeDays());
        entity.setBufferDays(item.getBufferDays());
        entity.setLeadTimeMonths(item.getLeadTimeMonths());
        entity.setRopInDays(item.getRopInDays());
        entity.setVarianceDemand(item.getVarianceDemand());
        entity.setVarianceLeadTimeDemand(item.getVarianceLeadTimeDemand());
        entity.setDifference(item.getDifference());
        entity.setOrderDeliveryDays(item.getOrderDeliveryDays());
        entity.setOrderQuantity(item.getOrderQuantity());
        entity.setPalletRequirement(item.getPalletRequirement());
        entity.setStatus(item.getStatus() != null ? item.getStatus() : "active");
        entity.setMaterialType(item.getMaterialType());
        entity.setBatchNumber(item.getBatchNumber());
        entity.setExpiryDate(item.getExpiryDate());
        entity.setLastMovementDate(item.getLastMovementDate());
        entity.setDaysSinceLastMovement(item.getDaysSinceLastMovement());
        validateSingleBinAssignment(entity);

        InventoryItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public List<InventoryItem> importInventory(List<InventoryItem> items) {
        return items.stream()
                .map(this::createOrUpdate)
                .collect(Collectors.toList());
    }

    private InventoryItem toDomain(InventoryItemEntity entity) {
        InventoryItem item = new InventoryItem();
        item.setId(entity.getId());
        item.setMaterialId(entity.getMaterialId());
        item.setWarehouseId(entity.getWarehouseId());
        item.setLocationCode(entity.getLocationCode());
        item.setLpnCode(entity.getLpnCode());
        item.setQuantity(entity.getQuantity());
        item.setAvailableQuantity(entity.getAvailableQuantity());
        item.setReservedQuantity(entity.getReservedQuantity());
        item.setBufferStock(entity.getBufferStock());
        item.setMaxStock(entity.getMaxStock());
        item.setMinStock(entity.getMinStock());
        item.setReorderPoint(entity.getReorderPoint());
        item.setStackingQuantity(entity.getStackingQuantity());
        item.setMoq(entity.getMoq());
        item.setLeadTimeDays(entity.getLeadTimeDays());
        item.setBufferDays(entity.getBufferDays());
        item.setLeadTimeMonths(entity.getLeadTimeMonths());
        item.setRopInDays(entity.getRopInDays());
        item.setVarianceDemand(entity.getVarianceDemand());
        item.setVarianceLeadTimeDemand(entity.getVarianceLeadTimeDemand());
        item.setDifference(entity.getDifference());
        item.setOrderDeliveryDays(entity.getOrderDeliveryDays());
        item.setOrderQuantity(entity.getOrderQuantity());
        item.setPalletRequirement(entity.getPalletRequirement());
        item.setStatus(entity.getStatus());
        item.setMaterialType(entity.getMaterialType());
        item.setBatchNumber(entity.getBatchNumber());
        item.setExpiryDate(entity.getExpiryDate());
        item.setLastMovementDate(entity.getLastMovementDate());
        item.setDaysSinceLastMovement(entity.getDaysSinceLastMovement());
        if (entity.getCreatedAt() != null) {
            item.setCreatedAt(entity.getCreatedAt().atOffset(ZoneOffset.UTC));
        }
        if (entity.getUpdatedAt() != null) {
            item.setUpdatedAt(entity.getUpdatedAt().atOffset(ZoneOffset.UTC));
        }
        return item;
    }

    private boolean sameInventoryBucket(InventoryItemEntity existing, InventoryItem incoming) {
        String existingLocation = normalize(existing.getLocationCode());
        String incomingLocation = normalize(incoming.getLocationCode());
        String existingLpn = normalize(existing.getLpnCode());
        String incomingLpn = normalize(incoming.getLpnCode());
        String existingBatch = normalize(existing.getBatchNumber());
        String incomingBatch = normalize(incoming.getBatchNumber());
        java.time.LocalDate existingExpiry = existing.getExpiryDate();
        java.time.LocalDate incomingExpiry = incoming.getExpiryDate();

        return java.util.Objects.equals(existingLocation, incomingLocation)
                && java.util.Objects.equals(existingLpn, incomingLpn)
                && java.util.Objects.equals(existingBatch, incomingBatch)
                && java.util.Objects.equals(existingExpiry, incomingExpiry);
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validateSingleBinAssignment(InventoryItemEntity entity) {
        String locationCode = normalize(entity.getLocationCode());
        if (locationCode == null || entity.getQuantity() == null || entity.getQuantity() <= 0) {
            return;
        }
        MaterialEntity material = materialRepository.findById(entity.getMaterialId())
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + entity.getMaterialId()));
        LocationEntity location = locationRepository.findByLocationCode(locationCode)
                .orElseThrow(() -> new IllegalArgumentException("Location not found: " + locationCode));
        if (!entity.getWarehouseId().equals(location.getWarehouseId())) {
            throw new IllegalArgumentException("Location " + locationCode + " does not belong to inventory warehouse");
        }

        int maxPallets = capacityService.resolveMaxPalletCapacity(location);
        int requiredPallets = capacityService.computePalletCount(entity.getQuantity(), material);
        if (maxPallets > 0 && requiredPallets > maxPallets) {
            throw new IllegalArgumentException(
                    "Quantity " + entity.getQuantity() + " requires " + requiredPallets
                            + " pallet/bin positions, but " + locationCode + " supports only " + maxPallets
                            + ". Use putaway split planning or inventory bin reconciliation.");
        }

        // Weigh what is actually going in, not a notional full pallet.
        //
        // Planning already sizes to the real quantity, so testing a full pallet here rejected
        // putaways the planner had just approved: a worker was sent to a bin with the pallet in
        // their hands and then told it would not fit, for a bin that had four times the headroom
        // the move needed.
        if (!capacityService.quantityFitsBin(material, location, entity.getQuantity())) {
            throw new IllegalArgumentException(
                    "Material " + material.getMaterialCode() + " does not fit bin " + locationCode
                            + ": " + entity.getQuantity() + " units exceed the bin's weight or volume limit.");
        }
    }
}
