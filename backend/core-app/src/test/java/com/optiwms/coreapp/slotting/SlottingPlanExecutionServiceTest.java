package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.coreapp.operations.StockTransferService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanLineRepository;
import com.optiwms.infra.slotting.SlottingPlanReserveLineRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SlottingPlanExecutionServiceTest {

    @Test
    void relocationDoesNotChangeDefaultLocationUntilWorkerConfirmsTransfer() {
        MaterialDefaultLocationService defaults = mock(MaterialDefaultLocationService.class);
        StockTransferService transfers = mock(StockTransferService.class);
        InventoryService inventory = mock(InventoryService.class);
        MaterialRepository materials = mock(MaterialRepository.class);
        SlottingPlanLineRepository lines = mock(SlottingPlanLineRepository.class);
        SlottingPlanReserveLineRepository reserves = mock(SlottingPlanReserveLineRepository.class);
        SlottingPlanExecutionService service = new SlottingPlanExecutionService(
                defaults, transfers, inventory, materials, lines, reserves);

        UUID warehouse = UUID.randomUUID();
        UUID material = UUID.randomUUID();
        SlottingPlanEntity plan = new SlottingPlanEntity();
        plan.setWarehouseId(warehouse);
        plan.setPlanCode("SLOT-TEST");

        SlottingPlanLineEntity line = new SlottingPlanLineEntity();
        line.setMaterialId(material);
        line.setMaterialType("raw_material");
        line.setCurrentPrimaryLocationCode("A-01-001");
        line.setRecommendedPrimaryLocationCode("A-01-002");
        line.setRelocationFlag(true);

        InventoryItem stock = new InventoryItem();
        stock.setLocationCode("A-01-001");
        stock.setQuantity(10);
        when(inventory.findByMaterialAndWarehouse(material, warehouse)).thenReturn(List.of(stock));
        when(materials.findById(material)).thenReturn(java.util.Optional.empty());

        StockTransfer created = new StockTransfer();
        created.setId(UUID.randomUUID());
        StockTransfer released = new StockTransfer();
        released.setId(created.getId());
        when(transfers.create(any(StockTransfer.class))).thenReturn(created);
        when(transfers.releaseForSlotting(created.getId())).thenReturn(released);

        var result = service.executeApprovedPlan(plan, List.of(line));

        assertEquals("PENDING_MOVE", line.getStatus());
        assertEquals("PENDING_MOVES", result.executionStatus());
        verifyNoInteractions(defaults);
    }
}
