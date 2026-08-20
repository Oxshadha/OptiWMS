package com.optiwms.infra.planning;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomHeaderRepository extends JpaRepository<BomHeaderEntity, UUID> {

    String OPERATIONAL_SCOPE = "('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')";

    @Query("select h from BomHeaderEntity h where h.dataQualityTier in " + OPERATIONAL_SCOPE + " order by h.parentMaterialId, h.version")
    List<BomHeaderEntity> findOperational();

    @Query("select h from BomHeaderEntity h where h.dataQualityTier in " + OPERATIONAL_SCOPE + " and h.parentMaterialId = :parentMaterialId order by h.version")
    List<BomHeaderEntity> findOperationalByParentMaterialId(@Param("parentMaterialId") UUID parentMaterialId);

    @Query("select h from BomHeaderEntity h where h.dataQualityTier in " + OPERATIONAL_SCOPE + " and h.warehouseId = :warehouseId order by h.parentMaterialId, h.version")
    List<BomHeaderEntity> findOperationalByWarehouseId(@Param("warehouseId") UUID warehouseId);

    @Query("select h from BomHeaderEntity h where h.dataQualityTier in " + OPERATIONAL_SCOPE + " and h.status = :status order by h.parentMaterialId, h.version")
    List<BomHeaderEntity> findOperationalByStatus(@Param("status") String status);

    List<BomHeaderEntity> findByParentMaterialId(UUID parentMaterialId);

    List<BomHeaderEntity> findByWarehouseId(UUID warehouseId);

    List<BomHeaderEntity> findByStatus(String status);

    Optional<BomHeaderEntity> findByParentMaterialIdAndWarehouseIdAndVersion(
            UUID parentMaterialId,
            UUID warehouseId,
            String version
    );

    Optional<BomHeaderEntity> findByParentMaterialIdAndWarehouseIdIsNullAndVersion(
            UUID parentMaterialId,
            String version
    );
}
