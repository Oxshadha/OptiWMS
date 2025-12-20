package com.optiwms.infra.anomalies;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnomalyRepository extends JpaRepository<AnomalyEntity, UUID> {
    Optional<AnomalyEntity> findByAnomalyNumber(String anomalyNumber);
    List<AnomalyEntity> findByStatus(String status);
    List<AnomalyEntity> findByWarehouseId(UUID warehouseId);
    List<AnomalyEntity> findByAnomalyType(String anomalyType);
}

