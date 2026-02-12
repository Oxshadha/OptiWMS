package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NonMovingItemRepository extends JpaRepository<NonMovingItemEntity, UUID> {
    Optional<NonMovingItemEntity> findByMaterialIdAndWarehouseId(UUID materialId, UUID warehouseId);
}
