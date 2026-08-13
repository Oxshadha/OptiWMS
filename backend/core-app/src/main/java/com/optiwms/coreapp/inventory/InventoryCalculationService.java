package com.optiwms.coreapp.inventory;

import com.optiwms.coreapp.master.BinOccupancyService;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * Service to calculate missing inventory planning values
 * Replaces Excel formulas with Java calculations
 */
@Service
public class InventoryCalculationService {

    private final InventoryItemRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final BinOccupancyService binOccupancyService;
    private final HandlingUnitCapacityService handlingUnitCapacityService;

    public InventoryCalculationService(
            InventoryItemRepository inventoryRepository,
            MaterialRepository materialRepository,
            BinOccupancyService binOccupancyService,
            HandlingUnitCapacityService handlingUnitCapacityService) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.binOccupancyService = binOccupancyService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
    }

    /**
     * Calculate and update missing planning fields for all inventory items
     * This replaces Excel formula calculations with Java logic
     */
    @Transactional
    public int calculateAndUpdateMissingFields() {
        List<InventoryItemEntity> allInventory = inventoryRepository.findAll();
        int updated = 0;

        for (InventoryItemEntity inventory : allInventory) {
            boolean needsUpdate = false;

            // Get material for dimensions
            MaterialEntity material = materialRepository.findById(inventory.getMaterialId())
                    .orElse(null);

            // Calculate Pallet Requirement if null
            // Formula: CEILING(Quantity / Pallets per Material, 1)
            if (inventory.getPalletRequirement() == null && material != null) {
                BigDecimal unitsPerPallet = handlingUnitCapacityService.resolveUnitsPerPallet(material);
                if (unitsPerPallet.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal quantity = BigDecimal.valueOf(inventory.getQuantity());
                    BigDecimal palletReq = quantity.divide(unitsPerPallet, 2, RoundingMode.CEILING);
                    inventory.setPalletRequirement(palletReq);
                    needsUpdate = true;
                }
            }

            // Calculate ROP in Days if ROP and Lead Time are available
            // Formula: ROP / (Average Daily Demand)
            // Simplified: ROP in Days = (ROP / Quantity) * Lead Time Days
            if (inventory.getRopInDays() == null 
                    && inventory.getReorderPoint() != null 
                    && inventory.getLeadTimeDays() != null
                    && inventory.getQuantity() != null
                    && inventory.getQuantity() > 0) {
                try {
                    BigDecimal rop = inventory.getReorderPoint();
                    BigDecimal quantity = BigDecimal.valueOf(inventory.getQuantity());
                    
                    // Average daily demand = quantity / 30 (assuming monthly average)
                    BigDecimal avgDailyDemand = quantity.divide(BigDecimal.valueOf(30), 2, RoundingMode.HALF_UP);
                    if (avgDailyDemand.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal ropInDays = rop.divide(avgDailyDemand, 2, RoundingMode.HALF_UP);
                        inventory.setRopInDays(ropInDays);
                        needsUpdate = true;
                    }
                } catch (Exception e) {
                    // Skip if calculation fails
                }
            }

            // Calculate Min Stock if Max Stock and Buffer Stock are available
            // Formula: Min Stock = Max Stock - Buffer Stock (simplified)
            if (inventory.getMinStock() == null 
                    && inventory.getMaxStock() != null 
                    && inventory.getBufferStock() != null) {
                BigDecimal minStock = inventory.getMaxStock().subtract(inventory.getBufferStock());
                if (minStock.compareTo(BigDecimal.ZERO) > 0) {
                    inventory.setMinStock(minStock);
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                inventoryRepository.save(inventory);
                updated++;
            }
        }

        return updated;
    }

    /**
     * Calculate pallet requirement for a specific inventory item
     */
    public BigDecimal calculatePalletRequirement(InventoryItemEntity inventory) {
        MaterialEntity material = materialRepository.findById(inventory.getMaterialId())
                .orElse(null);

        if (material == null) {
            return null;
        }

        BigDecimal unitsPerPallet = handlingUnitCapacityService.resolveUnitsPerPallet(material);
        if (unitsPerPallet.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        BigDecimal quantity = BigDecimal.valueOf(inventory.getQuantity());
        return quantity.divide(unitsPerPallet, 2, RoundingMode.CEILING);
    }

    /**
     * Recalculate all fields for a specific inventory item
     */
    @Transactional
    public void recalculateInventoryItem(UUID inventoryId) {
        InventoryItemEntity inventory = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new RuntimeException("Inventory item not found: " + inventoryId));

        // Calculate pallet requirement
        BigDecimal palletReq = calculatePalletRequirement(inventory);
        if (palletReq != null) {
            inventory.setPalletRequirement(palletReq);
        }

        inventoryRepository.save(inventory);

        if (inventory.getWarehouseId() != null) {
            binOccupancyService.reconcileWarehouseLevelUsage(inventory.getWarehouseId());
        }
    }
}
