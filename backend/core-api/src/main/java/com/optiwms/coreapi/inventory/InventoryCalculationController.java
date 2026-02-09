package com.optiwms.coreapi.inventory;

import com.optiwms.coreapp.inventory.InventoryCalculationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/inventory/calculate")
@PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
public class InventoryCalculationController {

    private final InventoryCalculationService calculationService;

    public InventoryCalculationController(InventoryCalculationService calculationService) {
        this.calculationService = calculationService;
    }

    /**
     * Calculate and update missing planning fields for all inventory items
     * This will calculate:
     * - Pallet Requirement (from quantity and pallet spaces)
     * - ROP in Days (from ROP and lead time)
     * - Min Stock (from Max Stock and Buffer Stock)
     */
    @PostMapping("/missing-fields")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CalculationResult> calculateMissingFields() {
        int updated = calculationService.calculateAndUpdateMissingFields();
        return ResponseEntity.ok(new CalculationResult(
                updated,
                "Successfully calculated and updated " + updated + " inventory items"
        ));
    }

    /**
     * Recalculate fields for a specific inventory item
     */
    @PostMapping("/{inventoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CalculationResult> recalculateItem(@PathVariable UUID inventoryId) {
        try {
            calculationService.recalculateInventoryItem(inventoryId);
            return ResponseEntity.ok(new CalculationResult(
                    1,
                    "Successfully recalculated inventory item " + inventoryId
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new CalculationResult(
                    0,
                    "Error: " + e.getMessage()
            ));
        }
    }

    public record CalculationResult(
            int itemsUpdated,
            String message
    ) {}
}
