package com.optiwms.infra.forecastspace;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InventoryPolicySimulationEvidenceRepository
        extends JpaRepository<InventoryPolicySimulationEvidenceEntity, UUID> {
    List<InventoryPolicySimulationEvidenceEntity> findByPolicyRunId(UUID policyRunId);
    Optional<InventoryPolicySimulationEvidenceEntity> findByPolicyRunIdAndMaterialId(UUID policyRunId, UUID materialId);
}
