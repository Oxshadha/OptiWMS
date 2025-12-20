package com.optiwms.infra.returns;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReturnRepository extends JpaRepository<ReturnEntity, UUID> {
    Optional<ReturnEntity> findByReturnNumber(String returnNumber);
    List<ReturnEntity> findByOriginalOrderId(UUID orderId);
    List<ReturnEntity> findByCustomerId(UUID customerId);
    List<ReturnEntity> findByStatus(String status);
}

