package com.optiwms.infra.planning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ForecastSkuMappingRepository extends JpaRepository<ForecastSkuMappingEntity, UUID> {
    List<ForecastSkuMappingEntity> findByDatasetOrderByUpdatedAtDesc(String dataset);
    List<ForecastSkuMappingEntity> findByWarehouseIdOrderByUpdatedAtDesc(UUID warehouseId);
    List<ForecastSkuMappingEntity> findByIsActiveOrderByUpdatedAtDesc(Boolean isActive);
    List<ForecastSkuMappingEntity> findAllByOrderByUpdatedAtDesc();
}
