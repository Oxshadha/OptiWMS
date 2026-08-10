package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.master.Material;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
                new HandlingUnitCapacityService());

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
                new HandlingUnitCapacityService());

        var result = service.suggestSplitPlan(warehouseId, materialId, 10, null);

        assertTrue(result.feasible());
        assertEquals("A-01-01-1-A", result.allocations().get(0).locationCode());
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
