package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierRepository extends JpaRepository<SupplierEntity, UUID>, JpaSpecificationExecutor<SupplierEntity> {
    Optional<SupplierEntity> findByCode(String code);
}
