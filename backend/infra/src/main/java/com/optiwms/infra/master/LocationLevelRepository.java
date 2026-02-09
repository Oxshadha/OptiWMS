package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LocationLevelRepository extends JpaRepository<LocationLevelEntity, UUID> {
    List<LocationLevelEntity> findByLocationId(UUID locationId);
    Optional<LocationLevelEntity> findByLocationIdAndLevelNumber(UUID locationId, Integer levelNumber);
}

