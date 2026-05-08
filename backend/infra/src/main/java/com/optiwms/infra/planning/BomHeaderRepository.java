package com.optiwms.infra.planning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomHeaderRepository extends JpaRepository<BomHeaderEntity, UUID> {

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
