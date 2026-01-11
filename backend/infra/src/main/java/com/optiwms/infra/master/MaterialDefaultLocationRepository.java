package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialDefaultLocationRepository extends JpaRepository<MaterialDefaultLocationEntity, UUID> {
    List<MaterialDefaultLocationEntity> findByMaterialIdAndWarehouseId(UUID materialId, UUID warehouseId);
    Optional<MaterialDefaultLocationEntity> findByMaterialIdAndWarehouseIdAndLocationCode(
            UUID materialId, UUID warehouseId, String locationCode);
    List<MaterialDefaultLocationEntity> findByWarehouseId(UUID warehouseId);
    List<MaterialDefaultLocationEntity> findByMaterialId(UUID materialId);
}
