package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialRepository extends JpaRepository<MaterialEntity, UUID> {
    Optional<MaterialEntity> findByMaterialCode(String materialCode);
    boolean existsByMaterialCode(String materialCode);
    java.util.List<MaterialEntity> findByMaterialType(String materialType);
}

