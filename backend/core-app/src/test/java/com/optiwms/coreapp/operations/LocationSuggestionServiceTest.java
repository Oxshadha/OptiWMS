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
}
