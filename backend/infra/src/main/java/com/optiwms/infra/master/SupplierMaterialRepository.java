package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierMaterialRepository extends JpaRepository<SupplierMaterialEntity, UUID> {
    List<SupplierMaterialEntity> findBySupplierId(UUID supplierId);
    List<SupplierMaterialEntity> findByMaterialId(UUID materialId);
    Optional<SupplierMaterialEntity> findBySupplierIdAndMaterialId(UUID supplierId, UUID materialId);
    boolean existsBySupplierIdAndMaterialId(UUID supplierId, UUID materialId);
    long countBySupplierId(UUID supplierId);
    void deleteBySupplierId(UUID supplierId);
    void deleteBySupplierIdAndMaterialId(UUID supplierId, UUID materialId);
}
