package com.optiwms.infra.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, UUID>, JpaSpecificationExecutor<InventoryItemEntity> {
    List<InventoryItemEntity> findByMaterialId(UUID materialId);
    List<InventoryItemEntity> findByWarehouseId(UUID warehouseId);
    List<InventoryItemEntity> findByMaterialIdAndWarehouseId(UUID materialId, UUID warehouseId);
    List<InventoryItemEntity> findByMaterialIdAndWarehouseIdAndLocationCode(UUID materialId, UUID warehouseId, String locationCode);
    List<InventoryItemEntity> findByLocationCode(String locationCode);
    List<InventoryItemEntity> findByStatus(String status);
    List<InventoryItemEntity> findByWarehouseIdAndStatus(UUID warehouseId, String status);
    List<InventoryItemEntity> findByMaterialType(String materialType);
    List<InventoryItemEntity> findByWarehouseIdAndMaterialType(UUID warehouseId, String materialType);
    boolean existsByLocationCodeInAndQuantityGreaterThan(List<String> locationCodes, Integer quantity);
}
