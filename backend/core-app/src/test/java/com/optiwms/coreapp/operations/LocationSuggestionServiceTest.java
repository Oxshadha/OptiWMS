package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.coreapp.master.MaterialService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocationSuggestionServiceTest {

    @Test
    void fallbackUsesOneBatchCapacityPlanInsteadOfPerRackValidation() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        LocationService locationService = mock(LocationService.class);
        InventoryService inventoryService = mock(InventoryService.class);
        MaterialService materialService = mock(MaterialService.class);
        AIServiceAdapter aiServiceAdapter = mock(AIServiceAdapter.class);
        MaterialDefaultLocationService defaults = mock(MaterialDefaultLocationService.class);
        PutawayCapacityPlanningService capacityPlanning = mock(PutawayCapacityPlanningService.class);

        when(aiServiceAdapter.suggestOptimalStorage(warehouseId, materialId, 25, "raw_material"))
                .thenReturn(Optional.empty());
        var allocation = new PutawayCapacityPlanningService.SplitPlanLine(
                "A-01-01-1-A", 25, "FMS-matched capacity", null);
        var plan = new PutawayCapacityPlanningService.SplitPlanResult(
                true, 25, 25, 0, null, null, null, List.of(allocation), List.of());
        when(capacityPlanning.suggestSplitPlan(warehouseId, materialId, 25, null)).thenReturn(plan);

        LocationSuggestionService service = new LocationSuggestionService(
                locationService,
                inventoryService,
                materialService,
                aiServiceAdapter,
                defaults,
                capacityPlanning);

        var suggestion = service.suggestPutawayLocation(
                warehouseId, materialId, 25, "raw_material");

        assertEquals("A-01-01-1-A", suggestion.getLocationCode());
        verify(capacityPlanning).suggestSplitPlan(warehouseId, materialId, 25, null);
        verify(inventoryService, never()).findByWarehouse(any());
        verify(locationService, never()).findByWarehouse(any());
    }

    /**
     * The planner spreads a multi-pallet receipt over several bins. Callers that create work need
     * every allocation; collapsing to the first one is what made a 25-pallet receipt one job.
     */
    @Test
    void planPreservesEveryAllocationRatherThanOnlyTheFirst() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        AIServiceAdapter aiServiceAdapter = mock(AIServiceAdapter.class);
        PutawayCapacityPlanningService capacityPlanning = mock(PutawayCapacityPlanningService.class);
        MaterialDefaultLocationService defaults = mock(MaterialDefaultLocationService.class);

        when(aiServiceAdapter.suggestOptimalStorage(warehouseId, materialId, 243, "raw_material"))
                .thenReturn(Optional.empty());
        var plan = new PutawayCapacityPlanningService.SplitPlanResult(
                true, 243, 243, 0, null, null, null,
                List.of(
                        new PutawayCapacityPlanningService.SplitPlanLine("A-01-01-1-A", 100, "r", null),
                        new PutawayCapacityPlanningService.SplitPlanLine("A-01-02-1-A", 143, "r", null)),
                List.of());
        when(capacityPlanning.suggestSplitPlan(warehouseId, materialId, 243, null)).thenReturn(plan);

        LocationSuggestionService service = new LocationSuggestionService(
                mock(LocationService.class),
                mock(InventoryService.class),
                mock(MaterialService.class),
                aiServiceAdapter,
                defaults,
                capacityPlanning);

        var result = service.suggestPutawayPlan(warehouseId, materialId, 243, "raw_material");

        assertEquals(2, result.allocations().size());
        assertEquals(243, result.allocations().stream()
                .mapToInt(PutawayCapacityPlanningService.SplitPlanLine::allocatedQuantity).sum());
    }

    /** A stale default/preferred bin must not be able to block putaway entirely. */
    @Test
    void anchorWithoutCapacityFallsBackToFreeSearch() {
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();

        PutawayCapacityPlanningService capacityPlanning = mock(PutawayCapacityPlanningService.class);
        var empty = new PutawayCapacityPlanningService.SplitPlanResult(
                false, 10, 0, 10, null, null, null, List.of(), List.of("no capacity"));
        var found = new PutawayCapacityPlanningService.SplitPlanResult(
                true, 10, 10, 0, null, null, null,
                List.of(new PutawayCapacityPlanningService.SplitPlanLine("B-02-01-1-A", 10, "r", null)),
                List.of());
        when(capacityPlanning.suggestSplitPlan(warehouseId, materialId, 10, "A-01-01-1-A")).thenReturn(empty);
        when(capacityPlanning.suggestSplitPlan(warehouseId, materialId, 10, null)).thenReturn(found);

        LocationSuggestionService service = new LocationSuggestionService(
                mock(LocationService.class),
                mock(InventoryService.class),
                mock(MaterialService.class),
                mock(AIServiceAdapter.class),
                mock(MaterialDefaultLocationService.class),
                capacityPlanning);

        var result = service.suggestPutawayPlan(
                warehouseId, materialId, 10, "raw_material", "A-01-01-1-A");

        assertEquals(1, result.allocations().size());
        assertEquals("B-02-01-1-A", result.allocations().get(0).locationCode());
    }
}
