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
    String OPERATIONAL_SCOPE = "i.dataQualityTier in ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')";

    @Query("select i from InventoryItemEntity i where i.materialId = :materialId and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByMaterialId(@Param("materialId") UUID materialId);

    @Query("select i from InventoryItemEntity i where i.warehouseId = :warehouseId and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByWarehouseId(@Param("warehouseId") UUID warehouseId);

    @Query("select i from InventoryItemEntity i where i.materialId = :materialId and i.warehouseId = :warehouseId and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByMaterialIdAndWarehouseId(
            @Param("materialId") UUID materialId,
            @Param("warehouseId") UUID warehouseId);

    @Query("select i from InventoryItemEntity i where i.materialId = :materialId and i.warehouseId = :warehouseId and i.locationCode = :locationCode and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByMaterialIdAndWarehouseIdAndLocationCode(
            @Param("materialId") UUID materialId,
            @Param("warehouseId") UUID warehouseId,
            @Param("locationCode") String locationCode);

    @Query("select i from InventoryItemEntity i where i.locationCode = :locationCode and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByLocationCode(@Param("locationCode") String locationCode);

    @Query("select i from InventoryItemEntity i where i.status = :status and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByStatus(@Param("status") String status);

    @Query("select i from InventoryItemEntity i where i.warehouseId = :warehouseId and i.status = :status and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByWarehouseIdAndStatus(
            @Param("warehouseId") UUID warehouseId,
            @Param("status") String status);

    @Query("select i from InventoryItemEntity i where i.materialType = :materialType and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByMaterialType(@Param("materialType") String materialType);

    @Query("select i from InventoryItemEntity i where i.warehouseId = :warehouseId and i.materialType = :materialType and " + OPERATIONAL_SCOPE)
    List<InventoryItemEntity> findByWarehouseIdAndMaterialType(
            @Param("warehouseId") UUID warehouseId,
            @Param("materialType") String materialType);

    @Query("select (count(i) > 0) from InventoryItemEntity i where i.locationCode in :locationCodes and i.quantity > :quantity and " + OPERATIONAL_SCOPE)
    boolean existsByLocationCodeInAndQuantityGreaterThan(
            @Param("locationCodes") List<String> locationCodes,
            @Param("quantity") Integer quantity);

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
              AND data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
            GROUP BY material_id
            """, nativeQuery = true)
    List<InventoryMaterialSummary> summarizeByWarehouseId(@Param("warehouseId") UUID warehouseId);

    @Query(value = """
            SELECT
                COUNT(*) AS "totalItems",
                COUNT(*) FILTER (WHERE quantity > 0 AND available_quantity > 0) AS "inStockItems",
                COUNT(*) FILTER (
                    WHERE quantity > 0
                      AND (
                          available_quantity < 10
                          OR quantity < 10
                          OR (reorder_point IS NOT NULL AND quantity <= reorder_point)
                          OR (buffer_stock IS NOT NULL AND quantity <= buffer_stock)
                      )
                ) AS "lowStockItems",
                COUNT(*) FILTER (WHERE quantity <= 0 OR available_quantity <= 0) AS "outOfStockItems"
            FROM inventory
            WHERE data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
              AND (CAST(:warehouseId AS uuid) IS NULL OR warehouse_id = CAST(:warehouseId AS uuid))
              AND (CAST(:materialType AS text) IS NULL OR material_type = CAST(:materialType AS text))
            """, nativeQuery = true)
    InventoryOperationalSummary summarizeOperational(
            @Param("warehouseId") UUID warehouseId,
            @Param("materialType") String materialType);

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

    interface InventoryOperationalSummary {
        Long getTotalItems();
        Long getInStockItems();
        Long getLowStockItems();
        Long getOutOfStockItems();
    }
}
