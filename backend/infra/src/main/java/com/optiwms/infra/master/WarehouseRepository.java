package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WarehouseRepository extends JpaRepository<WarehouseEntity, UUID> {
    Optional<WarehouseEntity> findByCode(String code);
    boolean existsByCode(String code);
}


