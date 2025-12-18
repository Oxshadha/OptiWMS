package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.infra.operations.StockTransferEntity;
import com.optiwms.infra.operations.StockTransferRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StockTransferService {

    private final StockTransferRepository repository;
    private final InventoryService inventoryService;

    public StockTransferService(StockTransferRepository repository, InventoryService inventoryService) {
        this.repository = repository;
        this.inventoryService = inventoryService;
    }

    public List<StockTransfer> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<StockTransfer> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public StockTransfer findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));
    }

    @Transactional
    public StockTransfer create(StockTransfer transfer) {
        StockTransferEntity entity = new StockTransferEntity();
        entity.setTransferNumber(transfer.getTransferNumber());
        entity.setTransferType(transfer.getTransferType());
        entity.setMaterialId(transfer.getMaterialId());
        entity.setSourceWarehouseId(transfer.getSourceWarehouseId());
        entity.setSourceLocationCode(transfer.getSourceLocationCode());
        entity.setDestWarehouseId(transfer.getDestWarehouseId());
        entity.setDestLocationCode(transfer.getDestLocationCode());
        entity.setQuantity(transfer.getQuantity());
        entity.setStatus(transfer.getStatus() != null ? transfer.getStatus() : "draft");
        entity.setNotes(transfer.getNotes());

        StockTransferEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public StockTransfer dispatch(UUID id, UUID userId) {
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));

        if (!"draft".equals(entity.getStatus())) {
            throw new RuntimeException("Only draft transfers can be dispatched");
        }

        // Reduce inventory at source
        List<InventoryItem> sourceInventory = inventoryService.findByMaterialAndWarehouse(
                entity.getMaterialId(), entity.getSourceWarehouseId());
        
        if (sourceInventory.isEmpty()) {
            throw new RuntimeException("Source inventory not found");
        }

        InventoryItem sourceItem = sourceInventory.get(0);
        BigDecimal newQuantity = sourceItem.getAvailableQuantity().subtract(entity.getQuantity());
        if (newQuantity.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("Insufficient inventory at source");
        }
        sourceItem.setAvailableQuantity(newQuantity);
        inventoryService.createOrUpdate(sourceItem);

        entity.setStatus("in_transit");
        entity.setDispatchedBy(userId);
        entity.setDispatchedAt(LocalDateTime.now());
        StockTransferEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public StockTransfer receive(UUID id, UUID userId) {
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));

        if (!"in_transit".equals(entity.getStatus())) {
            throw new RuntimeException("Only in-transit transfers can be received");
        }

        // Add inventory at destination
        List<InventoryItem> destInventory = inventoryService.findByMaterialAndWarehouse(
                entity.getMaterialId(), entity.getDestWarehouseId());

        InventoryItem destItem;
        if (destInventory.isEmpty()) {
            destItem = new InventoryItem();
            destItem.setMaterialId(entity.getMaterialId());
            destItem.setWarehouseId(entity.getDestWarehouseId());
            destItem.setQuantity(BigDecimal.ZERO);
            destItem.setAvailableQuantity(BigDecimal.ZERO);
            destItem.setReservedQuantity(BigDecimal.ZERO);
        } else {
            destItem = destInventory.get(0);
        }

        destItem.setLocationCode(entity.getDestLocationCode());
        destItem.setQuantity(destItem.getQuantity().add(entity.getQuantity()));
        destItem.setAvailableQuantity(destItem.getAvailableQuantity().add(entity.getQuantity()));
        destItem.setStatus("active");
        inventoryService.createOrUpdate(destItem);

        entity.setStatus("received");
        entity.setReceivedBy(userId);
        entity.setReceivedAt(LocalDateTime.now());
        StockTransferEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private StockTransfer toDomain(StockTransferEntity entity) {
        StockTransfer transfer = new StockTransfer();
        transfer.setId(entity.getId());
        transfer.setTransferNumber(entity.getTransferNumber());
        transfer.setTransferType(entity.getTransferType());
        transfer.setMaterialId(entity.getMaterialId());
        transfer.setSourceWarehouseId(entity.getSourceWarehouseId());
        transfer.setSourceLocationCode(entity.getSourceLocationCode());
        transfer.setDestWarehouseId(entity.getDestWarehouseId());
        transfer.setDestLocationCode(entity.getDestLocationCode());
        transfer.setQuantity(entity.getQuantity());
        transfer.setStatus(entity.getStatus());
        transfer.setNotes(entity.getNotes());
        transfer.setDispatchedBy(entity.getDispatchedBy());
        transfer.setDispatchedAt(entity.getDispatchedAt());
        transfer.setReceivedBy(entity.getReceivedBy());
        transfer.setReceivedAt(entity.getReceivedAt());
        return transfer;
    }
}

