package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, UUID> {
    List<LocationEntity> findByWarehouseId(UUID warehouseId);
    List<LocationEntity> findByWarehouseIdAndIsActive(UUID warehouseId, Boolean isActive);
    Optional<LocationEntity> findByLocationCode(String locationCode);
    List<LocationEntity> findByWarehouseIdAndLocationType(UUID warehouseId, String locationType);
    List<LocationEntity> findByWarehouseIdAndArea(UUID warehouseId, String area);
    
    @Query("SELECT COUNT(l) FROM LocationEntity l WHERE l.warehouseId = :warehouseId")
    long countByWarehouseId(@Param("warehouseId") UUID warehouseId);
}

