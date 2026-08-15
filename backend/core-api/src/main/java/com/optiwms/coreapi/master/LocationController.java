package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.BinOccupancyService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping({"/api/locations", "/api/master/locations"}) // Support both routes for compatibility
public class LocationController {

    private final LocationService locationService;
    private final BinOccupancyService binOccupancyService;
    private final StockPlacementPlanner stockPlacementPlanner;
    private final JdbcTemplate jdbcTemplate;

    public LocationController(
            LocationService locationService,
            BinOccupancyService binOccupancyService,
            StockPlacementPlanner stockPlacementPlanner,
            JdbcTemplate jdbcTemplate) {
        this.locationService = locationService;
        this.binOccupancyService = binOccupancyService;
        this.stockPlacementPlanner = stockPlacementPlanner;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<List<LocationDto>> list(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String area
    ) {
        List<com.optiwms.domain.master.Location> locations;
        
        if (warehouseId != null) {
            if ("available".equals(status)) {
                locations = locationService.findAvailableByWarehouse(warehouseId);
            } else {
                locations = locationService.findByWarehouse(warehouseId);
            }
        } else {
            locations = locationService.listAll();
        }

        var data = locations.stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LocationDto> getById(@PathVariable UUID id) {
        try {
            var location = locationService.findById(id);
            return ResponseEntity.ok(toDto(location));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{locationCode}")
    public ResponseEntity<LocationDto> getByCode(@PathVariable String locationCode) {
        try {
            var location = locationService.findByLocationCode(locationCode);
            return ResponseEntity.ok(toDto(location));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/warehouse/{warehouseId}")
    public ResponseEntity<List<LocationDto>> getByWarehouse(@PathVariable UUID warehouseId) {
        var locations = locationService.findByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    /**
     * Get only storage locations (exclude staging, receiving, shipment, packing areas)
     * For warehouse map visualization - only show racks, not staging areas
     */
    @GetMapping("/warehouse/{warehouseId}/storage-only")
    public ResponseEntity<List<LocationDto>> getStorageLocationsByWarehouse(@PathVariable UUID warehouseId) {
        var locations = locationService.findStorageLocationsByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    @GetMapping("/warehouse/{warehouseId}/rack-occupancy")
    public ResponseEntity<List<BinOccupancyDto>> getWarehouseRackOccupancy(@PathVariable UUID warehouseId) {
        return ResponseEntity.ok(binOccupancyService.getWarehouseRackOccupancy(warehouseId).stream()
                .map(this::toOccupancyDto)
                .toList());
    }

    @GetMapping("/warehouse/{warehouseId}/operational-stations")
    public ResponseEntity<List<OperationalStationDto>> getOperationalStations(@PathVariable UUID warehouseId) {
        var rows = jdbcTemplate.query("""
                SELECT location_code, location_type, zone_type,
                       COALESCE(coordinate_x, 0)::double precision AS coordinate_x,
                       COALESCE(coordinate_y, 0)::double precision AS coordinate_y
                FROM locations
                WHERE warehouse_id = ?
                  AND dataset_version = COALESCE(
                      (SELECT dataset_version FROM warehouses WHERE id = ?), dataset_version)
                  AND UPPER(COALESCE(zone_type, '')) IN
                      ('RECEIVING', 'STAGING', 'DOOR', 'PACKING', 'DISPATCH', 'QUARANTINE')
                  AND COALESCE(is_active, true) = true
                ORDER BY coordinate_y, coordinate_x, location_code
                """, (rs, rowNum) -> new OperationalStationDto(
                rs.getString("location_code"),
                rs.getString("location_type"),
                rs.getString("zone_type"),
                rs.getDouble("coordinate_x"),
                rs.getDouble("coordinate_y")
        ), warehouseId, warehouseId);
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/warehouse/{warehouseId}/rack-summaries")
    public ResponseEntity<List<RackSummaryDto>> getWarehouseRackSummaries(
            @PathVariable UUID warehouseId,
            @RequestParam(defaultValue = "1200") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        int boundedLimit = Math.max(1, Math.min(limit, 2500));
        int boundedOffset = Math.max(0, offset);
        var sql = """
                WITH bin_load AS (
                    SELECT
                        l.id,
                        l.location_code,
                        l.area,
                        l.row_number,
                        l.bay_number,
                        l.level_number,
                        l.bin_position,
                        l.location_type,
                        l.rack_status,
                        l.amalgamated_class,
                        l.description,
                        l.is_active,
                        l.coordinate_x,
                        l.coordinate_y,
                        COALESCE(l.max_pallet_capacity, 1) AS max_pallet_capacity,
                        COALESCE(l.max_weight_kg, CASE WHEN l.level_number <= 3 THEN 500 ELSE 300 END) AS max_weight_kg,
                        COALESCE(SUM(i.quantity), 0) AS quantity,
                        COALESCE(SUM(CEIL(i.quantity::numeric / GREATEST(COALESCE(m.units_per_pallet, m.pallet_spaces, 1), 1))), 0) AS pallet_count,
                        COALESCE(SUM(
                            CEIL(i.quantity::numeric / GREATEST(COALESCE(m.units_per_pallet, m.pallet_spaces, 1), 1))
                            * COALESCE(m.max_pallet_weight_kg, m.weight_kg, 0)
                        ), 0) AS bin_weight_kg
                    FROM locations l
                    LEFT JOIN inventory i
                        ON i.location_code = l.location_code
                       AND i.warehouse_id = l.warehouse_id
                       AND i.quantity > 0
                       AND i.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                    LEFT JOIN materials m ON m.id = i.material_id
                    WHERE l.warehouse_id = ?
                      AND l.dataset_version = COALESCE(
                          (SELECT dataset_version FROM warehouses WHERE id = ?), l.dataset_version)
                      AND (
                          UPPER(COALESCE(l.zone_type, '')) IN ('STORAGE', 'PICK_FACE', 'RESERVE')
                          OR UPPER(COALESCE(l.location_type, '')) IN ('STORAGE', 'PICKING', 'BULK')
                      )
                      AND COALESCE(l.is_active, true) = true
                    GROUP BY l.id
                )
                SELECT
                    area,
                    row_number,
                    bay_number,
                    MIN(id::text) AS representative_location_id,
                    MIN(location_code) AS representative_location_code,
                    MIN(location_type) AS location_type,
                    COALESCE(
                        MAX(CASE WHEN rack_status = 'out_of_service' THEN rack_status END),
                        MAX(CASE WHEN rack_status = 'maintenance' THEN rack_status END),
                        MAX(CASE WHEN rack_status = 'reserved' THEN rack_status END),
                        'active'
                    ) AS rack_status,
                    MAX(amalgamated_class) AS amalgamated_class,
                    MAX(description) AS description,
                    AVG(coordinate_x)::double precision AS coordinate_x,
                    AVG(coordinate_y)::double precision AS coordinate_y,
                    COUNT(*)::int AS bin_count,
                    MAX(level_number)::int AS max_levels,
                    COUNT(DISTINCT bin_position)::int AS positions_per_level,
                    COUNT(*) FILTER (WHERE quantity > 0)::int AS occupied_bins,
                    COALESCE(SUM(quantity), 0)::int AS total_quantity,
                    COALESCE(SUM(pallet_count), 0)::int AS pallet_count,
                    COALESCE(SUM(bin_weight_kg), 0)::double precision AS total_weight_kg,
                    COALESCE(SUM(max_pallet_capacity), 0)::int AS pallet_capacity,
                    COALESCE(SUM(max_weight_kg), 0)::double precision AS weight_capacity_kg,
                    BOOL_OR(COALESCE(description, '') ILIKE 'Auto-generated%%') AS auto_generated
                FROM bin_load
                GROUP BY area, row_number, bay_number
                ORDER BY area, LPAD(row_number, 12, '0'), LPAD(bay_number, 12, '0')
                LIMIT ? OFFSET ?
                """;

        var rows = jdbcTemplate.query(sql, (rs, rowNum) -> new RackSummaryDto(
                deriveRackId(rs.getString("area"), rs.getString("row_number"), rs.getString("bay_number")),
                rs.getString("area"),
                rs.getString("row_number"),
                rs.getString("bay_number"),
                rs.getString("representative_location_id"),
                rs.getString("representative_location_code"),
                rs.getString("location_type"),
                rs.getString("rack_status"),
                rs.getString("amalgamated_class"),
                rs.getString("description"),
                rs.getDouble("coordinate_x"),
                rs.getDouble("coordinate_y"),
                rs.getInt("bin_count"),
                rs.getInt("max_levels"),
                rs.getInt("positions_per_level"),
                rs.getInt("occupied_bins"),
                rs.getInt("total_quantity"),
                rs.getInt("pallet_count"),
                rs.getDouble("total_weight_kg"),
                rs.getInt("pallet_capacity"),
                rs.getDouble("weight_capacity_kg"),
                rs.getBoolean("auto_generated")
        ), warehouseId, warehouseId, boundedLimit, boundedOffset);
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/warehouse/{warehouseId}/rack-detail")
    public ResponseEntity<List<BinOccupancyDto>> getRackDetail(
            @PathVariable UUID warehouseId,
            @RequestParam String rackId
    ) {
        var parts = parseRackId(rackId);
        if (parts == null) {
            return ResponseEntity.badRequest().build();
        }

        var sql = """
                WITH bin_load AS (
                    SELECT
                        l.id,
                        l.location_code,
                        l.area,
                        l.row_number,
                        l.bay_number,
                        l.level_number,
                        l.bin_position,
                        COALESCE(l.max_pallet_capacity, 1) AS max_pallet_capacity,
                        COALESCE(l.max_weight_kg, CASE WHEN l.level_number <= 3 THEN 500 ELSE 300 END) AS max_weight_kg,
                        COALESCE(SUM(i.quantity), 0)::int AS quantity,
                        MIN(m.material_code) FILTER (WHERE i.quantity > 0) AS material_code,
                        MAX(GREATEST(COALESCE(m.units_per_pallet, m.pallet_spaces, 1), 1))::double precision AS units_per_pallet,
                        COALESCE(SUM(CEIL(i.quantity::numeric / GREATEST(COALESCE(m.units_per_pallet, m.pallet_spaces, 1), 1))), 0)::int AS pallet_count,
                        COALESCE(SUM(
                            CEIL(i.quantity::numeric / GREATEST(COALESCE(m.units_per_pallet, m.pallet_spaces, 1), 1))
                            * COALESCE(m.max_pallet_weight_kg, m.weight_kg, 0)
                        ), 0)::double precision AS bin_weight_kg,
                        MAX(COALESCE(m.max_pallet_weight_kg, m.weight_kg, 0))::double precision AS pallet_weight_kg
                    FROM locations l
                    LEFT JOIN inventory i
                        ON i.location_code = l.location_code
                       AND i.warehouse_id = l.warehouse_id
                       AND i.quantity > 0
                       AND i.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                    LEFT JOIN materials m ON m.id = i.material_id
                    WHERE l.warehouse_id = ?
                      AND l.dataset_version = COALESCE(
                          (SELECT dataset_version FROM warehouses WHERE id = ?), l.dataset_version)
                      AND (
                          UPPER(COALESCE(l.zone_type, '')) IN ('STORAGE', 'PICK_FACE', 'RESERVE')
                          OR UPPER(COALESCE(l.location_type, '')) IN ('STORAGE', 'PICKING', 'BULK')
                      )
                      AND UPPER(l.area) = ?
                      AND LPAD(l.row_number, 2, '0') = ?
                      AND LPAD(l.bay_number, 3, '0') = ?
                    GROUP BY l.id
                ),
                level_load AS (
                    SELECT
                        level_number,
                        SUM(bin_weight_kg)::double precision AS level_weight_used_kg,
                        SUM(max_weight_kg)::double precision AS level_weight_capacity_kg,
                        SUM(max_pallet_capacity)::int AS level_pallet_capacity
                    FROM bin_load
                    GROUP BY level_number
                )
                SELECT
                    b.*,
                    ll.level_weight_used_kg,
                    ll.level_weight_capacity_kg,
                    ll.level_pallet_capacity
                FROM bin_load b
                JOIN level_load ll ON ll.level_number = b.level_number
                ORDER BY b.level_number DESC, b.bin_position
                """;

        var rows = jdbcTemplate.query(sql, (rs, rowNum) -> new BinOccupancyDto(
                rs.getString("id"),
                rs.getString("location_code"),
                deriveRackId(rs.getString("area"), rs.getString("row_number"), rs.getString("bay_number")),
                rs.getString("area"),
                rs.getString("row_number"),
                rs.getString("bay_number"),
                rs.getInt("level_number"),
                rs.getString("bin_position"),
                rs.getInt("quantity"),
                rs.getString("material_code"),
                readNullableDouble(rs, "units_per_pallet"),
                rs.getInt("pallet_count"),
                readNullableDouble(rs, "bin_weight_kg"),
                readNullableDouble(rs, "pallet_weight_kg"),
                rs.getInt("max_pallet_capacity"),
                readNullableDouble(rs, "max_weight_kg"),
                readNullableDouble(rs, "level_weight_capacity_kg"),
                readNullableDouble(rs, "level_weight_used_kg"),
                rs.getInt("level_pallet_capacity")
        ), warehouseId, warehouseId, parts.area(), parts.row(), parts.bay());
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/warehouse/{warehouseId}/integrity-summary")
    public ResponseEntity<IntegritySummaryDto> getIntegritySummary(@PathVariable UUID warehouseId) {
        var sql = """
                WITH material_counts AS (
                    SELECT COUNT(*)::int AS total_materials
                    FROM materials
                    WHERE data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                ),
                defaults AS (
                    SELECT
                        COUNT(DISTINCT mdl.material_id)::int AS defaults_assigned,
                        COUNT(*) FILTER (
                            WHERE mdl.priority = 1
                              AND mdl.location_code IN (
                                  SELECT mdl2.location_code
                                  FROM material_default_locations mdl2
                                  JOIN materials m2 ON m2.id = mdl2.material_id
                                  WHERE mdl2.warehouse_id = ?
                                    AND mdl2.priority = 1
                                    AND m2.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                                  GROUP BY mdl2.location_code
                                  HAVING COUNT(*) > 1
                              )
                        )::int AS duplicate_primary_location_count
                    FROM material_default_locations mdl
                    JOIN materials m ON m.id = mdl.material_id
                    WHERE mdl.warehouse_id = ?
                      AND m.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                ),
                invalid_defaults AS (
                    SELECT COUNT(*)::int AS defaults_to_inactive_or_blocked
                    FROM material_default_locations mdl
                    JOIN materials m ON m.id = mdl.material_id
                    LEFT JOIN locations l ON l.location_code = mdl.location_code
                    WHERE mdl.warehouse_id = ?
                      AND m.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                      AND (
                          l.location_code IS NULL
                          OR COALESCE(l.is_active, true) = false
                          OR COALESCE(l.rack_status, 'active') IN ('reserved', 'maintenance', 'out_of_service')
                      )
                ),
                inventory_rows AS (
                    SELECT
                        COUNT(*)::int AS inventory_rows,
                        COALESCE(SUM(quantity), 0)::int AS inventory_qty_sum,
                        COUNT(*) FILTER (WHERE i.location_code IS NULL)::int AS inventory_rows_null_location,
                        COUNT(*) FILTER (
                            WHERE LOWER(COALESCE(m.storage_type, 'pallet')) <> 'bulk'
                              AND LOWER(COALESCE(l.location_type, 'storage')) = 'bulk'
                        )::int AS wrong_type_non_bulk_in_bulk,
                        COUNT(*) FILTER (
                            WHERE LOWER(COALESCE(m.storage_type, 'pallet')) = 'bulk'
                              AND LOWER(COALESCE(l.location_type, 'storage')) NOT IN (
                                  'bulk',
                                  'storage_f',
                                  'storage_g',
                                  'storage_h',
                                  'storage_i',
                                  'storage_j',
                                  'storage_r'
                              )
                        )::int AS wrong_type_bulk_in_non_bulk
                    FROM inventory i
                    LEFT JOIN materials m ON m.id = i.material_id
                    LEFT JOIN locations l ON l.location_code = i.location_code
                    WHERE i.warehouse_id = ?
                      AND i.data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                ),
                material_stock AS (
                    SELECT
                        material_id,
                        SUM(quantity) AS qty,
                        MAX(COALESCE(reorder_point, 0)) AS reorder_point,
                        MAX(COALESCE(buffer_stock, 0)) AS buffer_stock
                    FROM inventory
                    WHERE warehouse_id = ?
                      AND data_quality_tier IN ('PROJECT_OPERATIONAL_SIMULATION', 'GENERATED_OPERATIONAL_BASELINE', 'OPERATIONAL_ENTRY')
                    GROUP BY material_id
                ),
                stock_health AS (
                    SELECT
                        COUNT(*) FILTER (WHERE qty <= reorder_point OR qty <= buffer_stock OR qty < 10)::int AS low_like,
                        COUNT(*) FILTER (WHERE NOT (qty <= reorder_point OR qty <= buffer_stock OR qty < 10))::int AS available_like
                    FROM material_stock
                )
                SELECT
                    mc.total_materials,
                    COALESCE(d.defaults_assigned, 0) AS defaults_assigned,
                    GREATEST(mc.total_materials - COALESCE(d.defaults_assigned, 0), 0) AS materials_without_default,
                    ir.inventory_rows,
                    ir.inventory_qty_sum,
                    ir.inventory_rows_null_location,
                    ir.wrong_type_non_bulk_in_bulk,
                    ir.wrong_type_bulk_in_non_bulk,
                    COALESCE(id.defaults_to_inactive_or_blocked, 0) AS defaults_to_inactive_or_blocked,
                    COALESCE(d.duplicate_primary_location_count, 0) AS duplicate_primary_location_count,
                    COALESCE(sh.low_like, 0) AS low_like,
                    COALESCE(sh.available_like, 0) AS available_like
                FROM material_counts mc
                CROSS JOIN defaults d
                CROSS JOIN invalid_defaults id
                CROSS JOIN inventory_rows ir
                CROSS JOIN stock_health sh
                """;

        var row = jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new IntegritySummaryDto(
                rs.getInt("total_materials"),
                rs.getInt("defaults_assigned"),
                rs.getInt("materials_without_default"),
                rs.getInt("inventory_rows"),
                rs.getInt("inventory_qty_sum"),
                rs.getInt("inventory_rows_null_location"),
                rs.getInt("wrong_type_non_bulk_in_bulk"),
                rs.getInt("wrong_type_bulk_in_non_bulk"),
                rs.getInt("defaults_to_inactive_or_blocked"),
                rs.getInt("duplicate_primary_location_count"),
                rs.getInt("low_like"),
                rs.getInt("available_like")
        ), warehouseId, warehouseId, warehouseId, warehouseId, warehouseId);
        return ResponseEntity.ok(row);
    }

    @PostMapping("/warehouse/{warehouseId}/reconcile-level-usage")
    public ResponseEntity<Map<String, Object>> reconcileLevelUsage(@PathVariable UUID warehouseId) {
        int updated = binOccupancyService.reconcileWarehouseLevelUsage(warehouseId);
        return ResponseEntity.ok(Map.of("warehouseId", warehouseId.toString(), "updatedRecords", updated));
    }

    @PostMapping("/placement-plan")
    public ResponseEntity<PlacementPlanDto> createPlacementPlan(@RequestBody PlacementPlanRequest request) {
        Set<String> exclude = request.excludeLocationCodes() != null
                ? new HashSet<>(request.excludeLocationCodes())
                : Set.of();
        StockPlacementPlanner.PlacementPlan plan = stockPlacementPlanner.planPlacement(
                UUID.fromString(request.warehouseId()),
                UUID.fromString(request.materialId()),
                request.totalQuantity(),
                request.preferredLocationCode(),
                exclude);
        return ResponseEntity.ok(toPlacementPlanDto(plan));
    }

    @GetMapping("/available")
    public ResponseEntity<List<LocationDto>> getAvailable(
            @RequestParam UUID warehouseId
    ) {
        var locations = locationService.findAvailableByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    @GetMapping("/hierarchy")
    public ResponseEntity<Map<String, Object>> getHierarchy(
            @RequestParam UUID warehouseId
    ) {
        var locations = locationService.findByWarehouse(warehouseId);
        
        // Group by area, row, bay
        var hierarchy = locations.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                    com.optiwms.domain.master.Location::getArea,
                    java.util.stream.Collectors.groupingBy(
                        com.optiwms.domain.master.Location::getRowNumber,
                        java.util.stream.Collectors.groupingBy(
                            com.optiwms.domain.master.Location::getBayNumber,
                            java.util.stream.Collectors.mapping(this::toDto, java.util.stream.Collectors.toList())
                        )
                    )
                ));
        
        return ResponseEntity.ok(Map.of("warehouseId", warehouseId.toString(), "hierarchy", hierarchy));
    }

    @PostMapping
    public ResponseEntity<LocationDto> create(@RequestBody CreateLocationRequest request) {
        try {
            var location = new com.optiwms.domain.master.Location();
            location.setWarehouseId(UUID.fromString(request.warehouseId()));
            location.setLocationCode(request.locationCode());
            location.setArea(request.area());
            location.setRowNumber(request.rowNumber());
            location.setBayNumber(request.bayNumber());
            location.setLevelNumber(request.levelNumber());
            location.setBinPosition(request.binPosition());
            location.setLocationType(request.locationType() != null ? request.locationType() : "storage");
            location.setCapacity(request.capacity() != null ? new java.math.BigDecimal(request.capacity()) : null);
            location.setIsActive(request.isActive() != null ? request.isActive() : true);
            location.setQrCode(request.qrCode());

            var created = locationService.create(location);
            return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/bulk-racks")
    public ResponseEntity<?> bulkCreateRacks(@RequestBody BulkCreateRacksRequest request) {
        try {
            if (request.warehouseId() == null || request.warehouseId().isBlank()) {
                throw new RuntimeException("warehouseId is required");
            }
            var result = locationService.bulkCreateStorageRacks(
                    UUID.fromString(request.warehouseId()),
                    request.area(),
                    request.rowsToAdd(),
                    request.baysPerRow(),
                    request.levelsPerRack(),
                    request.binsPerLevel(),
                    request.startRow(),
                    request.startBay()
            );
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Created %d racks (%d locations) in zone %s.",
                            result.createdRacks(), result.createdLocations(), result.area()),
                    "area", result.area(),
                    "createdRacks", result.createdRacks(),
                    "createdLocations", result.createdLocations(),
                    "skippedRacks", result.skippedRacks()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateLocationRequest request) {
        try {
            var location = new com.optiwms.domain.master.Location();
            location.setLocationCode(request.locationCode());
            location.setArea(request.area());
            location.setRowNumber(request.rowNumber());
            location.setBayNumber(request.bayNumber());
            location.setLevelNumber(request.levelNumber());
            location.setBinPosition(request.binPosition());
            location.setLocationType(request.locationType());
            location.setCapacity(request.capacity() != null ? new java.math.BigDecimal(request.capacity()) : null);
            location.setIsActive(request.isActive());
            location.setQrCode(request.qrCode());
            location.setRackStatus(request.rackStatus());
            location.setAmalgamatedClass(request.amalgamatedClass());
            location.setDescription(request.description());
            location.setNotes(request.notes());
            location.setAccessibilityRating(request.accessibilityRating());
            location.setCoordinateX(request.coordinateX() != null ? new java.math.BigDecimal(request.coordinateX()) : null);
            location.setCoordinateY(request.coordinateY() != null ? new java.math.BigDecimal(request.coordinateY()) : null);
            location.setMaxPalletCapacity(request.maxPalletCapacity());
            location.setCurrentPalletCount(request.currentPalletCount());
            location.setMaxWeightKg(request.maxWeightKg() != null ? new java.math.BigDecimal(request.maxWeightKg()) : null);
            location.setMaxVolumeCm3(request.maxVolumeCm3() != null ? new java.math.BigDecimal(request.maxVolumeCm3()) : null);
            location.setMaxLpnCount(request.maxLpnCount());

            var updated = locationService.update(id, location);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // Rack-specific update endpoint (updates only rack properties on a single bin)
    @PutMapping("/racks/{id}")
    public ResponseEntity<?> updateRack(@PathVariable UUID id, @RequestBody UpdateRackRequest request) {
        try {
            var updated = locationService.updateRackAttributes(id, toRackAttributes(request));
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /**
     * Update every bin of a rack in one call.
     *
     * The layout editor used to fan out one PUT per bin, which meant a partial failure
     * left the rack in mixed statuses and ran the stock guard once per bin.
     */
    @PutMapping("/racks/bulk")
    public ResponseEntity<?> updateRackBulk(@RequestBody BulkRackUpdateRequest request) {
        try {
            if (request.warehouseId() == null || request.warehouseId().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "warehouseId is required"));
            }
            var result = locationService.updateRack(
                    UUID.fromString(request.warehouseId()),
                    request.rackId(),
                    toRackAttributes(request.attributes()));
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Updated rack %s (%d bins).", result.rackId(), result.updatedLocations()),
                    "rackId", result.rackId(),
                    "updatedLocations", result.updatedLocations(),
                    "locations", result.locations().stream().map(this::toDto).toList()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "warehouseId must be a valid UUID"));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** Apply a per-level capacity profile across a zone (or the whole warehouse) in one transaction. */
    @PutMapping("/racks/capacity-profile")
    public ResponseEntity<?> applyCapacityProfile(@RequestBody CapacityProfileRequest request) {
        try {
            if (request.warehouseId() == null || request.warehouseId().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "warehouseId is required"));
            }
            var levelProfile = new java.util.HashMap<Integer, LocationService.RackAttributes>();
            if (request.levels() != null) {
                for (var level : request.levels()) {
                    if (level.level() != null) {
                        levelProfile.put(level.level(), toRackAttributes(level.attributes()));
                    }
                }
            }
            int updated = locationService.applyCapacityProfile(
                    UUID.fromString(request.warehouseId()),
                    request.zone(),
                    levelProfile,
                    request.defaults() == null ? null : toRackAttributes(request.defaults()));
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Applied capacity profile to %d bin(s).", updated),
                    "updatedLocations", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "warehouseId must be a valid UUID"));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    private LocationService.RackAttributes toRackAttributes(UpdateRackRequest request) {
        if (request == null) {
            return new LocationService.RackAttributes(null, null, null, null, null, null, null, null, null, null);
        }
        return new LocationService.RackAttributes(
                request.rackStatus(),
                request.amalgamatedClass(),
                request.description(),
                request.notes(),
                request.accessibilityRating(),
                toDecimal(request.capacity()),
                request.maxPalletCapacity(),
                toDecimal(request.maxWeightKg()),
                toDecimal(request.maxVolumeCm3()),
                request.maxLpnCount());
    }

    private java.math.BigDecimal toDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new java.math.BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            throw new RuntimeException("'" + value + "' is not a valid number");
        }
    }

    /**
     * Turn persistence failures into something an operator can act on.
     *
     * Without this, a foreign-key violation surfaced in the UI as the full generated SQL
     * statement, which is unreadable and leaks schema internals.
     */
    private ResponseEntity<?> badRequest(RuntimeException e) {
        if (e instanceof org.springframework.dao.DataIntegrityViolationException) {
            return ResponseEntity.badRequest().body(Map.of("message",
                    "This bin is still referenced by stock or material default locations, "
                            + "so its address cannot be changed. Move the stock out first."));
        }
        String message = e.getMessage();
        if (message == null || message.isBlank() || message.contains("could not execute")) {
            message = "The rack could not be updated. Please retry, or contact support if it keeps failing.";
        }
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            locationService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/racks")
    public ResponseEntity<?> deleteRack(
            @RequestParam UUID warehouseId,
            @RequestParam String area,
            @RequestParam String rowNumber,
            @RequestParam String bayNumber
    ) {
        try {
            var result = locationService.deleteRack(warehouseId, area, rowNumber, bayNumber);
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Deleted rack %s-%s-%s (%d locations).",
                            result.area(), result.rowNumber(), result.bayNumber(), result.deletedLocations()),
                    "area", result.area(),
                    "rowNumber", result.rowNumber(),
                    "bayNumber", result.bayNumber(),
                    "deletedLocations", result.deletedLocations()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private LocationDto toDto(com.optiwms.domain.master.Location location) {
        return new LocationDto(
                location.getId().toString(),
                location.getWarehouseId().toString(),
                location.getLocationCode(),
                location.getArea(),
                location.getRowNumber(),
                location.getBayNumber(),
                location.getLevelNumber(),
                location.getBinPosition(),
                location.getLocationType(),
                location.getZoneType(),
                location.getCapacity() != null ? location.getCapacity().toString() : null,
                location.getIsActive() != null ? location.getIsActive() : true,
                location.getQrCode(),
                location.getRackStatus(),
                location.getAmalgamatedClass(),
                location.getDescription(),
                location.getNotes(),
                location.getAccessibilityRating(),
                location.getCoordinateX() != null ? location.getCoordinateX().toString() : null,
                location.getCoordinateY() != null ? location.getCoordinateY().toString() : null,
                location.getMaxPalletCapacity(),
                location.getCurrentPalletCount(),
                location.getMaxWeightKg() != null ? location.getMaxWeightKg().toString() : null,
                location.getMaxVolumeCm3() != null ? location.getMaxVolumeCm3().toString() : null,
                location.getMaxLpnCount()
        );
    }

    public record LocationDto(
            String id,
            String warehouseId,
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String zoneType,
            String capacity,
            Boolean isActive,
            String qrCode,
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String coordinateX,
            String coordinateY,
            Integer maxPalletCapacity,
            Integer currentPalletCount,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}


    public record CreateLocationRequest(
            String warehouseId,
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String capacity,
            Boolean isActive,
            String qrCode
    ) {}

    public record UpdateLocationRequest(
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String capacity,
            Boolean isActive,
            String qrCode,
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String coordinateX,
            String coordinateY,
            Integer maxPalletCapacity,
            Integer currentPalletCount,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}

    public record UpdateRackRequest(
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String capacity,
            Integer maxPalletCapacity,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}

    public record BulkRackUpdateRequest(
            String warehouseId,
            String rackId,
            UpdateRackRequest attributes
    ) {}

    public record CapacityProfileLevel(
            Integer level,
            UpdateRackRequest attributes
    ) {}

    public record CapacityProfileRequest(
            String warehouseId,
            String zone,
            List<CapacityProfileLevel> levels,
            UpdateRackRequest defaults
    ) {}

    public record BulkCreateRacksRequest(
            String warehouseId,
            String area,
            Integer rowsToAdd,
            Integer baysPerRow,
            Integer levelsPerRack,
            Integer binsPerLevel,
            Integer startRow,
            Integer startBay
    ) {}

    private BinOccupancyDto toOccupancyDto(BinOccupancyService.BinOccupancyDto dto) {
        return new BinOccupancyDto(
                dto.locationId().toString(),
                dto.locationCode(),
                dto.rackId(),
                dto.area(),
                dto.rowNumber(),
                dto.bayNumber(),
                dto.levelNumber(),
                dto.binPosition(),
                dto.quantity(),
                dto.materialCode(),
                dto.unitsPerPallet() != null ? dto.unitsPerPallet().doubleValue() : null,
                dto.palletCount(),
                dto.binWeightKg() != null ? dto.binWeightKg().doubleValue() : null,
                dto.palletWeightKg() != null ? dto.palletWeightKg().doubleValue() : null,
                dto.maxPalletCapacity(),
                dto.maxWeightKg() != null ? dto.maxWeightKg().doubleValue() : null,
                dto.levelWeightCapacityKg() != null ? dto.levelWeightCapacityKg().doubleValue() : null,
                dto.levelWeightUsedKg() != null ? dto.levelWeightUsedKg().doubleValue() : null,
                dto.levelPalletCapacity());
    }

    private PlacementPlanDto toPlacementPlanDto(StockPlacementPlanner.PlacementPlan plan) {
        return new PlacementPlanDto(
                plan.requiredPallets(),
                plan.assignedPallets(),
                plan.remainingPallets(),
                plan.lines().stream()
                        .map(line -> new PlacementLineDto(
                                line.locationCode(),
                                line.palletCount(),
                                line.quantityAllocated(),
                                line.rackId(),
                                line.levelNumber()))
                        .toList(),
                plan.notes());
    }

    private static String deriveRackId(String area, String rowNumber, String bayNumber) {
        return String.format("%s-%s-%s",
                normalizeArea(area),
                normalizeNumber(rowNumber, 2),
                normalizeNumber(bayNumber, 3));
    }

    private static String normalizeArea(String value) {
        if (value == null || value.isBlank()) {
            return "C";
        }
        var upper = value.trim().toUpperCase();
        return upper.equals("ST") ? "C" : upper;
    }

    private static String normalizeNumber(String value, int width) {
        try {
            return String.format("%0" + width + "d", Integer.parseInt(value));
        } catch (RuntimeException ignored) {
            var fallback = value == null || value.isBlank() ? "1" : value.trim();
            return fallback.length() >= width ? fallback : "0".repeat(width - fallback.length()) + fallback;
        }
    }

    private static RackIdParts parseRackId(String rackId) {
        if (rackId == null || rackId.isBlank()) {
            return null;
        }
        var parts = rackId.trim().toUpperCase().split("-");
        if (parts.length != 3) {
            return null;
        }
        return new RackIdParts(normalizeArea(parts[0]), normalizeNumber(parts[1], 2), normalizeNumber(parts[2], 3));
    }

    private static Double readNullableDouble(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    public record BinOccupancyDto(
            String locationId,
            String locationCode,
            String rackId,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            int quantity,
            String materialCode,
            Double unitsPerPallet,
            int palletCount,
            Double binWeightKg,
            Double palletWeightKg,
            int maxPalletCapacity,
            Double maxWeightKg,
            Double levelWeightCapacityKg,
            Double levelWeightUsedKg,
            Integer levelPalletCapacity) {}

    public record RackSummaryDto(
            String rackId,
            String area,
            String rowNumber,
            String bayNumber,
            String representativeLocationId,
            String representativeLocationCode,
            String locationType,
            String rackStatus,
            String amalgamatedClass,
            String description,
            double coordinateX,
            double coordinateY,
            int binCount,
            int maxLevels,
            int positionsPerLevel,
            int occupiedBins,
            int totalQuantity,
            int palletCount,
            double totalWeightKg,
            int palletCapacity,
            double weightCapacityKg,
            boolean autoGenerated) {}

    public record OperationalStationDto(
            String locationCode,
            String locationType,
            String zoneType,
            double coordinateX,
            double coordinateY) {}

    private record RackIdParts(String area, String row, String bay) {}

    public record IntegritySummaryDto(
            int totalMaterials,
            int defaultsAssigned,
            int materialsWithoutDefault,
            int inventoryRows,
            int inventoryQtySum,
            int inventoryRowsNullLocation,
            int wrongTypeNonBulkInBulk,
            int wrongTypeBulkInNonBulk,
            int defaultsToInactiveOrBlocked,
            int duplicatePrimaryLocationCount,
            int lowLike,
            int availableLike) {}

    public record PlacementPlanRequest(
            String warehouseId,
            String materialId,
            int totalQuantity,
            String preferredLocationCode,
            List<String> excludeLocationCodes) {}

    public record PlacementLineDto(
            String locationCode,
            int palletCount,
            int quantityAllocated,
            String rackId,
            Integer levelNumber) {}

    public record PlacementPlanDto(
            int requiredPallets,
            int assignedPallets,
            int remainingPallets,
            List<PlacementLineDto> lines,
            List<String> notes) {}

}
