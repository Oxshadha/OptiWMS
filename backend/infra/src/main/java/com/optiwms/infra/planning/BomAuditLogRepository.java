package com.optiwms.infra.planning;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BomAuditLogRepository extends JpaRepository<BomAuditLogEntity, UUID> {

    List<BomAuditLogEntity> findByEntityTypeOrderByCreatedAtDesc(String entityType, Pageable pageable);

    List<BomAuditLogEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
