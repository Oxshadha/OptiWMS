package com.optiwms.infra.slotting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MaterialIssueStatsRollupRepository
        extends JpaRepository<MaterialIssueStatsRollupEntity, MaterialIssueStatsRollupEntity.RollupId> {
    List<MaterialIssueStatsRollupEntity> findByWarehouseId(UUID warehouseId);
}
