package com.optiwms.infra.quality;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QualityCheckRepository extends JpaRepository<QualityCheckEntity, UUID> {
    List<QualityCheckEntity> findByGrnId(UUID grnId);
    List<QualityCheckEntity> findByMaterialId(UUID materialId);
    List<QualityCheckEntity> findByCheckedBy(UUID checkedBy);
}

