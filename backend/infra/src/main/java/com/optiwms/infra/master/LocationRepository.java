package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, UUID> {
    List<LocationEntity> findByWarehouseId(UUID warehouseId);
    List<LocationEntity> findByWarehouseIdAndIsActive(UUID warehouseId, Boolean isActive);

    /**
     * Placement candidates only. Filtering in SQL matters: a warehouse can hold
     * ~195k location rows of which only a few thousand are active storage, and
     * loading them all to discard 99% in Java dominated the slotting run.
     */
    List<LocationEntity> findByWarehouseIdAndZoneTypeAndIsActive(UUID warehouseId, String zoneType, Boolean isActive);
    Optional<LocationEntity> findByLocationCode(String locationCode);
    List<LocationEntity> findByWarehouseIdAndLocationType(UUID warehouseId, String locationType);
    List<LocationEntity> findByWarehouseIdAndArea(UUID warehouseId, String area);

    /**
     * Load the bins of a single rack without dragging the whole warehouse into memory.
     *
     * Row/bay are stored inconsistently across legacy seeds ("7", "07" and "007" all
     * describe the same bay), so callers pass every zero-padded spelling instead of a
     * normalising SQL expression - the IN lists still hit the
     * (warehouse_id, area, row_number, bay_number, ...) index.
     */
    @Query("SELECT l FROM LocationEntity l "
            + "WHERE l.warehouseId = :warehouseId "
            + "AND UPPER(TRIM(l.area)) = :area "
            + "AND TRIM(l.rowNumber) IN :rowVariants "
            + "AND TRIM(l.bayNumber) IN :bayVariants")
    List<LocationEntity> findRackLocations(
            @Param("warehouseId") UUID warehouseId,
            @Param("area") String area,
            @Param("rowVariants") Collection<String> rowVariants,
            @Param("bayVariants") Collection<String> bayVariants);

    @Query("SELECT COUNT(l) FROM LocationEntity l WHERE l.warehouseId = :warehouseId")
    long countByWarehouseId(@Param("warehouseId") UUID warehouseId);
}

