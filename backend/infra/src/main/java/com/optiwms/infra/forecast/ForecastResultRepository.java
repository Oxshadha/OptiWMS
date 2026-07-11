package com.optiwms.infra.forecast;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface ForecastResultRepository extends JpaRepository<ForecastResultEntity, UUID> {

    @Query("""
            SELECT f FROM ForecastResultEntity f
            WHERE f.materialId = :materialId
              AND f.decisionEligible = TRUE
              AND (:warehouseId IS NULL OR f.warehouseId IS NULL OR f.warehouseId = :warehouseId)
              AND f.forecastPeriod >= :fromPeriod
              AND f.forecastPeriod < :toPeriod
            ORDER BY f.forecastPeriod ASC, f.createdAt DESC
            """)
    List<ForecastResultEntity> findForecastsForMaterial(
            @Param("materialId") UUID materialId,
            @Param("warehouseId") UUID warehouseId,
            @Param("fromPeriod") LocalDate fromPeriod,
            @Param("toPeriod") LocalDate toPeriod);

    @Query("""
            SELECT f FROM ForecastResultEntity f
            WHERE (:warehouseId IS NULL OR f.warehouseId IS NULL OR f.warehouseId = :warehouseId)
              AND f.decisionEligible = TRUE
              AND f.forecastPeriod >= :fromPeriod
              AND f.forecastPeriod < :toPeriod
            ORDER BY f.materialId, f.forecastPeriod ASC, f.createdAt DESC
            """)
    List<ForecastResultEntity> findForecastsForWarehouse(
            @Param("warehouseId") UUID warehouseId,
            @Param("fromPeriod") LocalDate fromPeriod,
            @Param("toPeriod") LocalDate toPeriod);
}
