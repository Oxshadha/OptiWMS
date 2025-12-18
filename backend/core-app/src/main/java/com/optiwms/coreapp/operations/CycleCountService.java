package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.infra.cyclecount.CycleCountEntity;
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
    private final InventoryService inventoryService;

    public CycleCountService(CycleCountRepository repository, InventoryService inventoryService) {
        this.repository = repository;
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

        BigDecimal systemQuantity = item.getQuantity();
        BigDecimal variance = countedQuantity.subtract(systemQuantity);

        // Update inventory if variance exists
        if (variance.compareTo(BigDecimal.ZERO) != 0) {
            item.setQuantity(countedQuantity);
            item.setAvailableQuantity(countedQuantity.subtract(item.getReservedQuantity()));
            inventoryService.createOrUpdate(item);
        }

        entity.setVariance(variance);
        entity.setCountedBy(countedBy);
        entity.setCountedAt(LocalDateTime.now());
        entity.setStatus("completed");
        CycleCountEntity saved = repository.save(entity);

        return new CycleCountResult(true, "Count recorded successfully", variance);
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

    public record CycleCountResult(boolean success, String message, BigDecimal variance) {}
}

