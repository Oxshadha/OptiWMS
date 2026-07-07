package com.optiwms.infra.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    @Query(value = """
            SELECT
                material_id AS materialId,
                COALESCE(SUM(quantity), 0) AS quantity,
                COALESCE(SUM(available_quantity), 0) AS availableQuantity,
                MAX(min_stock) AS minStock,
                MAX(max_stock) AS maxStock,
                MAX(reorder_point) AS reorderPoint,
                MAX(buffer_stock) AS bufferStock,
                MAX(moq) AS moq,
                MAX(lead_time_days) AS leadTimeDays,
                MAX(order_quantity) AS orderQuantity,
                MAX(pallet_requirement) AS palletRequirement,
                MIN(expiry_date) AS expiryDate
            FROM inventory
            WHERE warehouse_id = :warehouseId
              AND material_id IS NOT NULL
            GROUP BY material_id
            """, nativeQuery = true)
    List<InventoryMaterialSummary> summarizeByWarehouseId(@Param("warehouseId") UUID warehouseId);

    interface InventoryMaterialSummary {
        UUID getMaterialId();
        BigDecimal getQuantity();
        BigDecimal getAvailableQuantity();
        BigDecimal getMinStock();
        BigDecimal getMaxStock();
        BigDecimal getReorderPoint();
        BigDecimal getBufferStock();
        BigDecimal getMoq();
        Integer getLeadTimeDays();
        BigDecimal getOrderQuantity();
        BigDecimal getPalletRequirement();
        LocalDate getExpiryDate();
    }
}
