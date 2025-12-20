package com.optiwms.infra.quality;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QualityCheckRepository extends JpaRepository<QualityCheckEntity, UUID> {
    Optional<QualityCheckEntity> findByCheckNumber(String checkNumber);
    List<QualityCheckEntity> findByOrderId(UUID orderId);
    List<QualityCheckEntity> findByMaterialId(UUID materialId);
    List<QualityCheckEntity> findByStatus(String status);
}

