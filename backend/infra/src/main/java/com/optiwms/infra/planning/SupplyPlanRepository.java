package com.optiwms.infra.planning;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupplyPlanRepository extends JpaRepository<SupplyPlanEntity, UUID> {
    
    List<SupplyPlanEntity> findByMaterialId(UUID materialId);
    
    List<SupplyPlanEntity> findByWarehouseId(UUID warehouseId);
    
    List<SupplyPlanEntity> findByMaterialIdAndWarehouseId(UUID materialId, UUID warehouseId);
    
    List<SupplyPlanEntity> findByMaterialIdAndWarehouseIdAndPlanYear(
        UUID materialId, UUID warehouseId, Integer planYear);
    
    java.util.Optional<SupplyPlanEntity> findByMaterialIdAndWarehouseIdAndPlanYearAndPlanMonth(
        UUID materialId, UUID warehouseId, Integer planYear, Integer planMonth);
    
    void deleteByMaterialId(UUID materialId);
    
    void deleteByWarehouseId(UUID warehouseId);
}
