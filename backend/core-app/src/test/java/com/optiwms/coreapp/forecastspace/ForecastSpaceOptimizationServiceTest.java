package com.optiwms.coreapp.forecastspace;

import com.optiwms.infra.inventory.InventoryItemEntity;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ForecastSpaceOptimizationServiceTest {

    @Test
    void acceptsOperationalPickAndReserveZonesOnly() {
        assertTrue(ForecastSpaceOptimizationService.isOptimizerStorageZone("PICK_FACE"));
        assertTrue(ForecastSpaceOptimizationService.isOptimizerStorageZone("RESERVE"));
        assertTrue(ForecastSpaceOptimizationService.isOptimizerStorageZone("STORAGE"));
        assertTrue(ForecastSpaceOptimizationService.isOptimizerStorageZone(null));
        assertFalse(ForecastSpaceOptimizationService.isOptimizerStorageZone("STAGING"));
        assertFalse(ForecastSpaceOptimizationService.isOptimizerStorageZone("DISPATCH"));
    }

    @Test
    void derivesIncumbentFromHighestQuantityInventoryBin() {
        InventoryItemEntity low = inventory("A-01", 10);
        InventoryItemEntity high = inventory("B-01", 40);
        InventoryItemEntity empty = inventory("C-01", 0);

        assertEquals("B-01", ForecastSpaceOptimizationService.selectInventoryPrimary(List.of(low, high, empty)));
        assertNull(ForecastSpaceOptimizationService.selectInventoryPrimary(List.of(empty)));
    }

    private InventoryItemEntity inventory(String locationCode, int quantity) {
        InventoryItemEntity item = new InventoryItemEntity();
        item.setLocationCode(locationCode);
        item.setQuantity(quantity);
        return item;
    }
}
