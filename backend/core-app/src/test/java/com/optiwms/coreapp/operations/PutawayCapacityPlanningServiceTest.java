package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.master.Material;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PutawayCapacityPlanningServiceTest {

    @Test
    void treatsVersionedBinCapacityAsPalletSlotsForPalletizedMaterial() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);
        StockPlacementPlanner placementPlanner = mock(StockPlacementPlanner.class);

        Material material = new Material();
        material.setId(materialId);
        material.setUnitsPerPallet(75_030);
        material.setPalletSpaces(BigDecimal.ONE);

        Location bin = new Location();
        bin.setWarehouseId(warehouseId);
        bin.setLocationCode("A-01-01-1-A");
        bin.setLocationType("storage");
        bin.setZoneType("STORAGE");
        bin.setIsActive(true);
        bin.setRackStatus("active");
        bin.setCapacity(BigDecimal.ONE);
        bin.setMaxPalletCapacity(1);
        bin.setCurrentPalletCount(0);

        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(List.of());
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(bin));
        when(placementPlanner.planPlacement(warehouseId, materialId, 25_010, null, Set.of()))
                .thenReturn(new StockPlacementPlanner.PlacementPlan(1, 0, 1, List.of(), List.of()));

        PutawayCapacityPlanningService service = new PutawayCapacityPlanningService(
                inventoryService,
                locationService,
                materialService,
                placementPlanner,
                new HandlingUnitCapacityService(),
                noReservations());

        PutawayCapacityPlanningService.SplitPlanResult result = service.suggestSplitPlan(
                warehouseId,
                materialId,
                25_010,
                null);

        assertTrue(result.feasible());
        assertEquals(25_010, result.plannedQuantity());
        assertEquals(0, result.unplannedQuantity());
        assertEquals(1, result.requiredPalletSlots());
        assertEquals(1, result.allocations().size());
        assertEquals(25_010, result.allocations().get(0).allocatedQuantity());
        assertEquals(75_030, result.allocations().get(0).projectedAfter().quantityCapacity());
    }

    @Test
    void prefersRackVelocityZoneMatchingMaterialFmsClass() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);

        Material material = new Material();
        material.setId(materialId);
        material.setFmsClass("F");

        Location slowRack = storageLocation(warehouseId, "E-01-01-1-A", "AS");
        Location fastRack = storageLocation(warehouseId, "A-01-01-1-A", "AF");

        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(List.of());
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(slowRack, fastRack));

        PutawayCapacityPlanningService service = new PutawayCapacityPlanningService(
                inventoryService,
                locationService,
                materialService,
                mock(StockPlacementPlanner.class),
                new HandlingUnitCapacityService(),
                noReservations());

        var result = service.suggestSplitPlan(warehouseId, materialId, 10, null);

        assertTrue(result.feasible());
        assertEquals("A-01-01-1-A", result.allocations().get(0).locationCode());
    }

    /**
     * The reported failure: a worker is sent to a bin the planner called empty and is told
     * "Location pallet capacity reached". The bin really is empty; only the denormalised
     * current_pallet_count column says otherwise, and nothing in the putaway path maintains it.
     */
    @Test
    void acceptsEmptyBinWhoseDenormalisedPalletCountIsStaleHigh() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 100);
        Location bin = palletBin(warehouseId, "A-01-01-1-A");
        bin.setCurrentPalletCount(1); // stale: nothing has cleared it since the stock left

        Fixture fixture = fixture(warehouseId, materialId, material, bin, List.of());

        var validation = fixture.service.validateSingleLocation(warehouseId, materialId, 100, "A-01-01-1-A");

        assertTrue(validation.valid(), "empty bin must accept a pallet regardless of the stale column");
        assertTrue(validation.violations().isEmpty(), () -> "unexpected violations: " + validation.violations());
    }

    /**
     * The same drift in the other direction, which silently overfilled bins: the column reads zero
     * while the bin physically holds a pallet, and a one-pallet bin accepted a second.
     */
    @Test
    void rejectsOccupiedBinWhoseDenormalisedPalletCountIsStaleLow() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 100);
        Location bin = palletBin(warehouseId, "A-01-01-1-A");
        bin.setCurrentPalletCount(0); // stale: never incremented when the pallet was put away

        InventoryItem occupying = new InventoryItem();
        occupying.setMaterialId(materialId);
        occupying.setWarehouseId(warehouseId);
        occupying.setLocationCode("A-01-01-1-A");
        occupying.setQuantity(100); // exactly one pallet, so the single slot is taken

        Fixture fixture = fixture(warehouseId, materialId, material, bin, List.of(occupying));

        var validation = fixture.service.validateSingleLocation(warehouseId, materialId, 100, "A-01-01-1-A");

        assertFalse(validation.valid(), "a full one-pallet bin must not accept a second pallet");
        assertTrue(
                validation.violations().stream().anyMatch(v -> v.contains("pallet capacity")),
                () -> "expected a pallet-capacity violation, got: " + validation.violations());
    }

    /**
     * The planner weighs one pallet against the bin; putaway additionally refuses a weight-capped
     * bin when the material carries no weight_kg. A bin only the planner accepts must never reach
     * a worker -- it is dropped and the planner is asked again with that bin excluded.
     */
    @Test
    void dropsPlannerBinsThatPutawayWouldRefuseAndReplansAroundThem() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 100);
        material.setWeightKg(null); // the metric the weight-capped bin needs and does not have

        Location weightCapped = palletBin(warehouseId, "A-01-01-1-A");
        weightCapped.setMaxWeightKg(BigDecimal.valueOf(500)); // planner-OK, putaway-blocked
        Location usable = palletBin(warehouseId, "A-01-02-1-A");

        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);
        StockPlacementPlanner planner = mock(StockPlacementPlanner.class);

        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(List.of());
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(weightCapped, usable));
        when(locationService.findByLocationCodeOptional("A-01-01-1-A"))
                .thenReturn(java.util.Optional.of(weightCapped));
        when(locationService.findByLocationCodeOptional("A-01-02-1-A"))
                .thenReturn(java.util.Optional.of(usable));

        // First pass offers the bin putaway would refuse; once excluded, the planner offers a good one.
        when(planner.planPlacement(warehouseId, materialId, 100, null, Set.of()))
                .thenReturn(placementPlan("A-01-01-1-A", 100));
        when(planner.planPlacement(warehouseId, materialId, 100, null, Set.of("A-01-01-1-A")))
                .thenReturn(placementPlan("A-01-02-1-A", 100));

        PutawayCapacityPlanningService service = new PutawayCapacityPlanningService(
                inventoryService, locationService, materialService, planner,
                new HandlingUnitCapacityService(), noReservations());

        var result = service.suggestSplitPlan(warehouseId, materialId, 100, null);

        assertEquals(1, result.allocations().size());
        assertEquals("A-01-02-1-A", result.allocations().get(0).locationCode(),
                "the bin putaway would refuse must not be handed to a worker");
    }

    /**
     * A bin already claimed by other inbound work -- another line of the same PO, or a concurrent
     * order -- must not be offered again. Every line used to be planned against identical warehouse
     * state, so the same bin was promised repeatedly and only the first worker there could use it.
     */
    @Test
    void doesNotOfferBinsAlreadyClaimedByOtherInboundWork() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 100);
        Location claimed = palletBin(warehouseId, "A-01-01-1-A");
        Location free = palletBin(warehouseId, "A-01-02-1-A");

        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);
        StockPlacementPlanner planner = mock(StockPlacementPlanner.class);
        PutawayReservationService reservations = mock(PutawayReservationService.class);

        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(List.of());
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(claimed, free));
        when(locationService.findByLocationCodeOptional("A-01-02-1-A"))
                .thenReturn(java.util.Optional.of(free));

        // A-01-01-1-A is physically empty but spoken for by an earlier line.
        when(reservations.reservedPalletsByLocation(warehouseId))
                .thenReturn(java.util.Map.of("A-01-01-1-A", 1));
        when(planner.planPlacement(warehouseId, materialId, 100, null, Set.of("A-01-01-1-A")))
                .thenReturn(placementPlan("A-01-02-1-A", 100));

        PutawayCapacityPlanningService service = new PutawayCapacityPlanningService(
                inventoryService, locationService, materialService, planner,
                new HandlingUnitCapacityService(), reservations);

        var result = service.suggestSplitPlan(warehouseId, materialId, 100, null);

        assertEquals(1, result.allocations().size());
        assertEquals("A-01-02-1-A", result.allocations().get(0).locationCode(),
                "a bin another line has claimed must not be offered again");
    }

    private StockPlacementPlanner.PlacementPlan placementPlan(String locationCode, int quantity) {
        return new StockPlacementPlanner.PlacementPlan(
                1, 1, 0,
                List.of(new StockPlacementPlanner.PlacementLine(locationCode, 1, quantity, "RACK", 1)),
                List.of());
    }

    /**
     * Numbers taken from VITAMINE E (100128) against the live rack layout: a pallet is rated
     * 1500 kg and the heaviest bin holds 1200 kg, but the order is only 30 units (750 kg).
     *
     * The empty-bin rule used to test the pallet rating, so every free bin was refused and the
     * material could not be received at any quantity.
     */
    @Test
    void acceptsAPartialPalletIntoABinRatedBelowAFullPallet() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 267);
        material.setWeightKg(new BigDecimal("25.00"));
        material.setMaxPalletWeightKg(new BigDecimal("1500.00"));
        material.setVolumeCm3(new BigDecimal("1000.00"));

        Location bin = palletBin(warehouseId, "A-01-01-3-A");
        bin.setMaxWeightKg(new BigDecimal("1200.00"));
        bin.setMaxVolumeCm3(new BigDecimal("1800000.00"));

        var result = fixture(warehouseId, materialId, material, bin, List.of())
                .service()
                .suggestSplitPlan(warehouseId, materialId, 30, null);

        assertTrue(result.feasible(), () -> "expected feasible, notes: " + result.notes());
        assertEquals(30, result.plannedQuantity());
        assertEquals(1, result.allocations().size());
        assertEquals(30, result.allocations().get(0).allocatedQuantity());
    }

    /**
     * Relaxing the empty-bin rule must not make the bin's weight limit toothless. A 1200 kg bin
     * bears 48 units of a 25 kg SKU, which is one whole 267-unit pallet's worth of slot and no
     * more, so a full pallet still cannot be placed.
     */
    @Test
    void stillCapsAllocationAtTheBinWeightLimit() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 267);
        material.setWeightKg(new BigDecimal("25.00"));
        material.setMaxPalletWeightKg(new BigDecimal("1500.00"));

        Location bin = palletBin(warehouseId, "A-01-01-3-A");
        bin.setMaxWeightKg(new BigDecimal("1200.00"));

        var result = fixture(warehouseId, materialId, material, bin, List.of())
                .service()
                .suggestSplitPlan(warehouseId, materialId, 267, null);

        assertFalse(result.feasible());
        // 1200 kg / 25 kg = 48 units. Under a pallet, so it is placed whole rather than trimmed
        // to a pallet boundary that would leave the bin part-used and the receipt short.
        assertEquals(48, result.plannedQuantity());
        assertEquals(219, result.unplannedQuantity());
        assertTrue(
                result.notes().stream().anyMatch(note -> note.contains("Could not place 219 of 267")),
                () -> "expected the shortfall to be quantified, got: " + result.notes());
    }

    /** An infeasible plan names the constraint that refused the bins, not just "insufficient". */
    @Test
    void namesTheConstraintThatRefusedEveryBin() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 10);
        material.setWeightKg(new BigDecimal("500.00"));

        // No whole unit fits: one unit alone is heavier than the bin can bear.
        Location bin = palletBin(warehouseId, "A-01-01-3-A");
        bin.setMaxWeightKg(new BigDecimal("300.00"));

        var result = fixture(warehouseId, materialId, material, bin, List.of())
                .service()
                .suggestSplitPlan(warehouseId, materialId, 10, null);

        assertFalse(result.feasible());
        assertEquals(0, result.plannedQuantity());
        assertTrue(
                result.notes().stream().anyMatch(note -> note.contains("bin weight limit")),
                () -> "expected the weight limit to be named, got: " + result.notes());
    }

    /**
     * A receipt of two pallets must not produce three putaway tasks.
     *
     * Bin headroom that cut an allocation mid-pallet left a stub that started a fresh partial
     * pallet in the next bin, so the receipt ended up with more pallets than it needed.
     */
    @Test
    void alignsAllocationsToWholePalletsSoTaskCountMatchesPalletCount() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        Material material = palletisedMaterial(materialId, 25);
        material.setWeightKg(new BigDecimal("1.00"));

        // 30 units of headroom: enough for one whole pallet plus a 5-unit stub.
        Location roomy = palletBin(warehouseId, "A-01-01-1-A");
        roomy.setMaxPalletCapacity(2);
        roomy.setMaxWeightKg(new BigDecimal("30.00"));
        Location second = palletBin(warehouseId, "A-01-02-1-A");
        second.setMaxPalletCapacity(2);
        second.setMaxWeightKg(new BigDecimal("100.00"));

        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);
        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(List.of());
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(roomy, second));

        var service = new PutawayCapacityPlanningService(
                inventoryService,
                locationService,
                materialService,
                exhaustedPlanner(),
                new HandlingUnitCapacityService(),
                noReservations());

        var result = service.suggestSplitPlan(warehouseId, materialId, 50, null);

        assertTrue(result.feasible(), () -> "expected feasible, notes: " + result.notes());
        // Every allocation is a whole pallet, so slicing them yields exactly ceil(50/25) = 2.
        int pallets = result.allocations().stream()
                .mapToInt(line -> (line.allocatedQuantity() + 24) / 25)
                .sum();
        assertEquals(2, pallets);
    }

    /**
     * A planner that offers nothing, so planning falls through to the generic capacity search.
     *
     * This is the live behaviour, not a convenience: the pallet planner only considers bins it
     * can seat a whole handling unit in, and returns nothing when none qualify.
     */
    private static StockPlacementPlanner exhaustedPlanner() {
        StockPlacementPlanner planner = mock(StockPlacementPlanner.class);
        when(planner.planPlacement(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(new StockPlacementPlanner.PlacementPlan(0, 0, 0, List.of(), List.of()));
        return planner;
    }

    /** An empty warehouse: nothing is claimed, so capacity is decided by physical contents alone. */
    private static PutawayReservationService noReservations() {
        PutawayReservationService reservations = mock(PutawayReservationService.class);
        when(reservations.reservedPalletsByLocation(org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.Map.of());
        return reservations;
    }

    private record Fixture(PutawayCapacityPlanningService service) {}

    private Fixture fixture(
            UUID warehouseId,
            UUID materialId,
            Material material,
            Location bin,
            List<InventoryItem> warehouseInventory) {
        InventoryService inventoryService = mock(InventoryService.class);
        LocationService locationService = mock(LocationService.class);
        MaterialService materialService = mock(MaterialService.class);

        when(materialService.findById(materialId)).thenReturn(material);
        when(inventoryService.findByWarehouse(warehouseId)).thenReturn(warehouseInventory);
        when(locationService.findAvailableByWarehouse(warehouseId)).thenReturn(List.of(bin));
        when(locationService.findByLocationCodeOptional(bin.getLocationCode()))
                .thenReturn(java.util.Optional.of(bin));

        return new Fixture(new PutawayCapacityPlanningService(
                inventoryService,
                locationService,
                materialService,
                exhaustedPlanner(),
                new HandlingUnitCapacityService(),
                noReservations()));
    }

    private Material palletisedMaterial(UUID materialId, int unitsPerPallet) {
        Material material = new Material();
        material.setId(materialId);
        material.setUnitsPerPallet(unitsPerPallet);
        material.setPalletSpaces(BigDecimal.ONE);
        return material;
    }

    private Location palletBin(UUID warehouseId, String code) {
        Location bin = new Location();
        bin.setWarehouseId(warehouseId);
        bin.setLocationCode(code);
        bin.setLocationType("storage");
        bin.setZoneType("STORAGE");
        bin.setIsActive(true);
        bin.setRackStatus("active");
        bin.setMaxPalletCapacity(1);
        bin.setLevelNumber(1);
        return bin;
    }

    private Location storageLocation(UUID warehouseId, String code, String rackClass) {
        Location location = new Location();
        location.setWarehouseId(warehouseId);
        location.setLocationCode(code);
        location.setLocationType("storage");
        location.setZoneType("STORAGE");
        location.setIsActive(true);
        location.setRackStatus("active");
        location.setCapacity(BigDecimal.valueOf(100));
        location.setAmalgamatedClass(rackClass);
        location.setLevelNumber(1);
        return location;
    }
}
