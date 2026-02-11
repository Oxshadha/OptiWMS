package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.infra.operations.StockTransferEntity;
import com.optiwms.infra.operations.StockTransferRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StockTransferService {

    private final StockTransferRepository repository;
    private final InventoryService inventoryService;
    private final OperationEventService operationEventService;

    public StockTransferService(StockTransferRepository repository, InventoryService inventoryService, OperationEventService operationEventService) {
        this.repository = repository;
        this.inventoryService = inventoryService;
        this.operationEventService = operationEventService;
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
        Integer newQuantity = (sourceItem.getAvailableQuantity() != null ? sourceItem.getAvailableQuantity() : 0) - entity.getQuantity();
        if (newQuantity < 0) {
            throw new RuntimeException("Insufficient inventory at source");
        }
        sourceItem.setAvailableQuantity(newQuantity);
        inventoryService.createOrUpdate(sourceItem);

        entity.setStatus("in_transit");
        entity.setDispatchedBy(userId);
        entity.setDispatchedAt(LocalDateTime.now());
        StockTransferEntity saved = repository.save(entity);
        operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                "STOCK_TRANSFER_DISPATCH",
                userId,
                null,
                null,
                null,
                entity.getSourceWarehouseId(),
                entity.getMaterialId(),
                entity.getQuantity(),
                null,
                LocalDateTime.now(),
                "destWarehouse=" + entity.getDestWarehouseId()
        ));
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
            destItem.setQuantity(0);
            destItem.setAvailableQuantity(0);
            destItem.setReservedQuantity(0);
        } else {
            destItem = destInventory.get(0);
        }

        destItem.setLocationCode(entity.getDestLocationCode());
        destItem.setQuantity((destItem.getQuantity() != null ? destItem.getQuantity() : 0) + entity.getQuantity());
        destItem.setAvailableQuantity((destItem.getAvailableQuantity() != null ? destItem.getAvailableQuantity() : 0) + entity.getQuantity());
        destItem.setStatus("active");
        inventoryService.createOrUpdate(destItem);

        entity.setStatus("received");
        entity.setReceivedBy(userId);
        entity.setReceivedAt(LocalDateTime.now());
        StockTransferEntity saved = repository.save(entity);
        operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                "STOCK_TRANSFER_RECEIVE",
                userId,
                null,
                null,
                null,
                entity.getDestWarehouseId(),
                entity.getMaterialId(),
                entity.getQuantity(),
                null,
                LocalDateTime.now(),
                "sourceWarehouse=" + entity.getSourceWarehouseId()
        ));
        return toDomain(saved);
    }

    @Transactional
    public StockTransfer cancel(UUID id, String reason) {
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));

        String currentStatus = entity.getStatus();
        if (!"draft".equals(currentStatus) && !"in_transit".equals(currentStatus)) {
            throw new RuntimeException("Only draft or in-transit transfers can be canceled");
        }

        // If transfer was dispatched, restore source available inventory.
        if ("in_transit".equals(currentStatus)) {
            List<InventoryItem> sourceInventory = inventoryService.findByMaterialAndWarehouse(
                    entity.getMaterialId(), entity.getSourceWarehouseId());

            if (sourceInventory.isEmpty()) {
                throw new RuntimeException("Source inventory not found for cancel operation");
            }

            InventoryItem sourceItem = sourceInventory.get(0);
            sourceItem.setAvailableQuantity(
                    (sourceItem.getAvailableQuantity() != null ? sourceItem.getAvailableQuantity() : 0)
                            + entity.getQuantity()
            );
            inventoryService.createOrUpdate(sourceItem);
        }

        entity.setStatus("canceled");
        if (reason != null && !reason.isBlank()) {
            String existingNotes = entity.getNotes() != null ? entity.getNotes() : "";
            String separator = existingNotes.isBlank() ? "" : "\n";
            entity.setNotes(existingNotes + separator + "Cancel reason: " + reason.trim());
        }

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
