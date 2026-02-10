package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GrnRepository extends JpaRepository<GrnEntity, UUID> {
    Optional<GrnEntity> findFirstByPoIdOrderByCreatedAtDesc(UUID poId);
    List<GrnEntity> findByPoId(UUID poId);
}
