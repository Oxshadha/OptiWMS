package com.optiwms.infra.planning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BomComponentRepository extends JpaRepository<BomComponentEntity, UUID> {

    List<BomComponentEntity> findByBomHeaderId(UUID bomHeaderId);

    void deleteByBomHeaderId(UUID bomHeaderId);
}
