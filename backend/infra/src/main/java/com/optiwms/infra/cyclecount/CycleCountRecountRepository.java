package com.optiwms.infra.cyclecount;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CycleCountRecountRepository extends JpaRepository<CycleCountRecountEntity, UUID> {
    
    /**
     * Find all recounts for a specific cycle count
     */
    List<CycleCountRecountEntity> findByCycleCountIdOrderByRecountNumberAsc(UUID cycleCountId);
    
    /**
     * Count recounts for a specific cycle count
     */
    long countByCycleCountId(UUID cycleCountId);
}
