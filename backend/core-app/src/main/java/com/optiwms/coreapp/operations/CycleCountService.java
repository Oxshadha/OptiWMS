package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.infra.cyclecount.CycleCountEntity;
import com.optiwms.infra.cyclecount.CycleCountRecountEntity;
import com.optiwms.infra.cyclecount.CycleCountRecountRepository;
import com.optiwms.infra.cyclecount.CycleCountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CycleCountService {

    private final CycleCountRepository repository;
    private final CycleCountRecountRepository recountRepository;
    private final InventoryService inventoryService;

    public CycleCountService(CycleCountRepository repository,
                            CycleCountRecountRepository recountRepository,
                            InventoryService inventoryService) {
        this.repository = repository;
        this.recountRepository = recountRepository;
        this.inventoryService = inventoryService;
    }

    public List<CycleCount> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<CycleCount> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public CycleCount findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));
    }

    @Transactional
    public CycleCount create(CycleCount cycleCount) {
        CycleCountEntity entity = new CycleCountEntity();
        entity.setCountNumber(cycleCount.getCountNumber());
        entity.setWarehouseId(cycleCount.getWarehouseId());
        entity.setLocationCode(cycleCount.getLocationCode());
        entity.setScheduledDate(cycleCount.getScheduledDate());
        entity.setAssignedWorkers(cycleCount.getAssignedWorkers());
        entity.setStatus(cycleCount.getStatus() != null ? cycleCount.getStatus() : "scheduled");
        entity.setNotes(cycleCount.getNotes());

        CycleCountEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public CycleCountResult recordCount(UUID id, UUID materialId, BigDecimal countedQuantity, UUID countedBy) {
        CycleCountEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));

        // Find inventory at location
        List<InventoryItem> inventory = inventoryService.findByWarehouse(entity.getWarehouseId());
        InventoryItem item = inventory.stream()
                .filter(inv -> inv.getMaterialId().equals(materialId) && 
                             (entity.getLocationCode() == null || entity.getLocationCode().equals(inv.getLocationCode())))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Inventory not found for material at location"));

        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer countedQtyInteger = (int) Math.ceil(countedQuantity.doubleValue());
        Integer systemQuantity = item.getQuantity() != null ? item.getQuantity() : 0;
        Integer variance = countedQtyInteger - systemQuantity;
        BigDecimal varianceDecimal = new BigDecimal(variance);

        // Get variance threshold (default 5 units if not set)
        BigDecimal threshold = entity.getVarianceThreshold() != null ? 
            entity.getVarianceThreshold() : new BigDecimal("5.0");

        // Check if recount is required (variance exceeds threshold)
        if (varianceDecimal.abs().compareTo(threshold) > 0 && !Boolean.TRUE.equals(entity.getRecountRequired())) {
            // First count with large variance - require recount
            entity.setRecountRequired(true);
            entity.setPreviousVariance(varianceDecimal);
            entity.setVariance(varianceDecimal);
            entity.setCountedBy(countedBy);
            entity.setCountedAt(LocalDateTime.now());
            entity.setStatus("recount_required"); // New status
            repository.save(entity);

            // Record this count in recount history
            saveRecountHistory(id, 1, countedQuantity, varianceDecimal, countedBy, 
                "Initial count - variance exceeds threshold");

            return new CycleCountResult(
                false, 
                String.format("Large variance detected (%.0f units, threshold: %.0f). Please recount.", 
                    varianceDecimal.doubleValue(), threshold.doubleValue()),
                varianceDecimal,
                true // recountRequired flag
            );
        }

        // If recount was required and this is a recount
        if (Boolean.TRUE.equals(entity.getRecountRequired())) {
            Integer currentRecountCount = entity.getRecountCount() != null ? entity.getRecountCount() : 0;
            currentRecountCount++;
            entity.setRecountCount(currentRecountCount);

            // Record this recount in history
            saveRecountHistory(id, currentRecountCount + 1, countedQuantity, varianceDecimal, countedBy, 
                String.format("Recount #%d", currentRecountCount));

            // After 2 recounts (3 total counts), accept the variance
            if (currentRecountCount >= 2) {
                entity.setRecountRequired(false);
                entity.setFinalVariance(varianceDecimal);
                entity.setVariance(varianceDecimal);
                entity.setStatus("completed");
                
                // Update inventory with final count
                item.setQuantity(countedQtyInteger);
                item.setAvailableQuantity(countedQtyInteger - (item.getReservedQuantity() != null ? item.getReservedQuantity() : 0));
                inventoryService.createOrUpdate(item);

                repository.save(entity);
                return new CycleCountResult(
                    true, 
                    String.format("Count completed after %d recounts. Final variance: %.0f units.", 
                        currentRecountCount, varianceDecimal.doubleValue()),
                    varianceDecimal,
                    false
                );
            } else {
                // Still need more recounts
                entity.setVariance(varianceDecimal);
                repository.save(entity);
                return new CycleCountResult(
                    false, 
                    String.format("Recount #%d recorded. Variance: %.0f units. Please recount again.", 
                        currentRecountCount, varianceDecimal.doubleValue()),
                    varianceDecimal,
                    true
                );
            }
        }

        // Normal flow: Small variance, accept immediately
        entity.setVariance(varianceDecimal);
        entity.setFinalVariance(varianceDecimal);
        entity.setCountedBy(countedBy);
        entity.setCountedAt(LocalDateTime.now());
        entity.setStatus("completed");
        repository.save(entity);

        // Update inventory
        if (variance != 0) {
            item.setQuantity(countedQtyInteger);
            item.setAvailableQuantity(countedQtyInteger - (item.getReservedQuantity() != null ? item.getReservedQuantity() : 0));
            inventoryService.createOrUpdate(item);
        }

        return new CycleCountResult(
            true, 
            "Count recorded successfully", 
            varianceDecimal,
            false
        );
    }

    /**
     * Save recount history for audit trail
     */
    private void saveRecountHistory(UUID cycleCountId, Integer recountNumber, BigDecimal countedQuantity, 
                                     BigDecimal variance, UUID countedBy, String notes) {
        CycleCountRecountEntity recount = new CycleCountRecountEntity();
        recount.setCycleCountId(cycleCountId);
        recount.setRecountNumber(recountNumber);
        recount.setCountedQuantity(countedQuantity);
        recount.setVariance(variance);
        recount.setCountedBy(countedBy);
        recount.setNotes(notes);
        recountRepository.save(recount);
    }

    private CycleCount toDomain(CycleCountEntity entity) {
        CycleCount count = new CycleCount();
        count.setId(entity.getId());
        count.setCountNumber(entity.getCountNumber());
        count.setWarehouseId(entity.getWarehouseId());
        count.setLocationCode(entity.getLocationCode());
        count.setScheduledDate(entity.getScheduledDate());
        count.setAssignedWorkers(entity.getAssignedWorkers());
        count.setStatus(entity.getStatus());
        count.setCountedBy(entity.getCountedBy());
        count.setCountedAt(entity.getCountedAt());
        count.setVariance(entity.getVariance());
        count.setNotes(entity.getNotes());
        return count;
    }

    public static class CycleCount {
        private UUID id;
        private String countNumber;
        private UUID warehouseId;
        private String locationCode;
        private java.time.LocalDate scheduledDate;
        private UUID[] assignedWorkers;
        private String status;
        private UUID countedBy;
        private java.time.LocalDateTime countedAt;
        private BigDecimal variance;
        private String notes;

        // Getters and Setters
        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }
        public String getCountNumber() { return countNumber; }
        public void setCountNumber(String countNumber) { this.countNumber = countNumber; }
        public UUID getWarehouseId() { return warehouseId; }
        public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
        public String getLocationCode() { return locationCode; }
        public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
        public java.time.LocalDate getScheduledDate() { return scheduledDate; }
        public void setScheduledDate(java.time.LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
        public UUID[] getAssignedWorkers() { return assignedWorkers; }
        public void setAssignedWorkers(UUID[] assignedWorkers) { this.assignedWorkers = assignedWorkers; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public UUID getCountedBy() { return countedBy; }
        public void setCountedBy(UUID countedBy) { this.countedBy = countedBy; }
        public java.time.LocalDateTime getCountedAt() { return countedAt; }
        public void setCountedAt(java.time.LocalDateTime countedAt) { this.countedAt = countedAt; }
        public BigDecimal getVariance() { return variance; }
        public void setVariance(BigDecimal variance) { this.variance = variance; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }

    public record CycleCountResult(boolean success, String message, BigDecimal variance, boolean recountRequired) {
        // Backward compatible constructor
        public CycleCountResult(boolean success, String message, BigDecimal variance) {
            this(success, message, variance, false);
        }
    }
}

