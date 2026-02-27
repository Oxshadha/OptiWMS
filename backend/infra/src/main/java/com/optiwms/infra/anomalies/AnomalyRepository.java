package com.optiwms.infra.anomalies;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AnomalyRepository extends JpaRepository<AnomalyEntity, UUID>, JpaSpecificationExecutor<AnomalyEntity> {
    List<AnomalyEntity> findByWarehouseId(UUID warehouseId);
    List<AnomalyEntity> findByMaterialId(UUID materialId);
    List<AnomalyEntity> findByStatus(String status);
    List<AnomalyEntity> findBySeverity(String severity);
    List<AnomalyEntity> findByAnomalyType(String anomalyType);
}
