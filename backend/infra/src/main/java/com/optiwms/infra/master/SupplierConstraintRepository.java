package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupplierConstraintRepository extends JpaRepository<SupplierConstraintEntity, UUID> {
    List<SupplierConstraintEntity> findBySupplierId(UUID supplierId);
    List<SupplierConstraintEntity> findByMaterialId(UUID materialId);
}
