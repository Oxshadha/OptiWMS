package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PackingRecordRepository extends JpaRepository<PackingRecordEntity, UUID> {
    List<PackingRecordEntity> findByOrderId(UUID orderId);
    List<PackingRecordEntity> findByOrderNumber(String orderNumber);
    List<PackingRecordEntity> findByStatus(String status);
    List<PackingRecordEntity> findByPackerId(UUID packerId);
}

