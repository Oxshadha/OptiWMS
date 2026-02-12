package com.optiwms.infra.cyclecount;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CycleCountAuditLogRepository extends JpaRepository<CycleCountAuditLogEntity, UUID> {
    List<CycleCountAuditLogEntity> findByCycleCountIdOrderByCreatedAtDesc(UUID cycleCountId);
}
