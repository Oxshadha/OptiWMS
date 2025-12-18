package com.optiwms.infra.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, UUID> {
    List<InventoryItemEntity> findByMaterialId(UUID materialId);
    List<InventoryItemEntity> findByWarehouseId(UUID warehouseId);
    List<InventoryItemEntity> findByMaterialIdAndWarehouseId(UUID materialId, UUID warehouseId);
}

