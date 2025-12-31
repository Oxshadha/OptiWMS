package com.optiwms.coreapp.inventory;

import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InventoryService {

    private final InventoryItemRepository repository;

    public InventoryService(InventoryItemRepository repository) {
        this.repository = repository;
    }

    public List<InventoryItem> listAll() {
        return repository.findAll().stream()
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

    public List<InventoryItem> findByLocationCode(String locationCode) {
        return repository.findByLocationCode(locationCode).stream()
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

    @Transactional
    public InventoryItem update(java.util.UUID id, InventoryItem item) {
        InventoryItemEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inventory item not found: " + id));

        entity.setLocationCode(item.getLocationCode());
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
        if (item.getStatus() != null) {
            entity.setStatus(item.getStatus());
        }

        InventoryItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public InventoryItem createOrUpdate(InventoryItem item) {
        InventoryItemEntity entity = repository.findByMaterialIdAndWarehouseId(
                item.getMaterialId(), item.getWarehouseId())
                .stream()
                .findFirst()
                .orElse(new InventoryItemEntity());

        entity.setMaterialId(item.getMaterialId());
        entity.setWarehouseId(item.getWarehouseId());
        entity.setLocationCode(item.getLocationCode());
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
        entity.setStatus(item.getStatus() != null ? item.getStatus() : "active");

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
        item.setStatus(entity.getStatus());
        return item;
    }
}

