package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.WarehouseService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.quality.QualityCheckService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The SOP pallet weight limit applies to one pallet, not to the whole delivery.
 * Comparing the full receipt against a per-pallet ceiling rejected every multi-pallet
 * inbound, which is how a legitimate 243-unit order became "6075.00 kg > 255.15 kg".
 */
class ReceivingServiceWeightValidationTest {

    private static final UUID MATERIAL_ID = UUID.randomUUID();

    @Test
    void multiPalletReceiptIsAcceptedWhenEachPalletIsWithinTheLimit() {
        // 243 units x 25 kg = 6075 kg total, but only ~10 units (250 kg) ride on a pallet.
        Fixture fixture = fixture(material(25, 10, new BigDecimal("255.15")));

        assertDoesNotThrow(() -> fixture.service.receiveOrder(
                "PO-20260810-000001",
                List.of(receivedItem(new BigDecimal("243"))),
                null, null, fixture.warehouseId, null));
    }

    @Test
    void overloadedSinglePalletIsStillRejected() {
        // 20 units of a 25 kg item all on one pallet is 500 kg, above the 255.15 kg limit.
        Fixture fixture = fixture(material(25, 20, new BigDecimal("255.15")));

        RuntimeException error = assertThrows(RuntimeException.class, () -> fixture.service.receiveOrder(
                "PO-20260810-000001",
                List.of(receivedItem(new BigDecimal("20"))),
                null, null, fixture.warehouseId, null));

        assertTrue(error.getMessage().contains("Pallet weight limit exceeded"), error.getMessage());
        // The message reports the real per-pallet figure, not the whole-receipt total.
        assertTrue(error.getMessage().contains("500.00 kg"), error.getMessage());
    }

    @Test
    void materialWithoutConfiguredLimitIsNotBlocked() {
        Fixture fixture = fixture(material(25, 10, null));

        assertDoesNotThrow(() -> fixture.service.receiveOrder(
                "PO-20260810-000001",
                List.of(receivedItem(new BigDecimal("1000"))),
                null, null, fixture.warehouseId, null));
    }

    private static Material material(int unitWeightKg, int unitsPerPallet, BigDecimal maxPalletWeightKg) {
        Material material = new Material();
        material.setId(MATERIAL_ID);
        material.setMaterialCode("100037");
        material.setMaterialType("raw_material");
        material.setUnitType("pallet");
        material.setWeightKg(BigDecimal.valueOf(unitWeightKg));
        material.setUnitsPerPallet(unitsPerPallet);
        material.setMaxPalletWeightKg(maxPalletWeightKg);
        return material;
    }

    private static ReceivingService.ReceivedItem receivedItem(BigDecimal quantity) {
        return new ReceivingService.ReceivedItem(MATERIAL_ID, quantity, null, null, null);
    }

    private Fixture fixture(Material material) {
        UUID orderId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        OrderService orderService = mock(OrderService.class);
        OrderStatusService orderStatusService = mock(OrderStatusService.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        InventoryService inventoryService = mock(InventoryService.class);
        MaterialService materialService = mock(MaterialService.class);
        WarehouseService warehouseService = mock(WarehouseService.class);
        PutawayTaskService putawayTaskService = mock(PutawayTaskService.class);
        QualityCheckService qualityCheckService = mock(QualityCheckService.class);
        GrnService grnService = mock(GrnService.class);
        TaskService taskService = mock(TaskService.class);
        OperationEventService operationEventService = mock(OperationEventService.class);

        Order order = new Order();
        order.setId(orderId);
        order.setOrderNumber("PO-20260810-000001");
        order.setOrderType("inbound");
        order.setStatus("pending");
        order.setWarehouseId(warehouseId);
        when(orderService.findByOrderNumber("PO-20260810-000001")).thenReturn(order);
        when(orderService.findById(orderId)).thenReturn(order);

        OrderItemEntity item = new OrderItemEntity();
        item.setId(itemId);
        item.setOrderId(orderId);
        item.setMaterialId(MATERIAL_ID);
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));

        when(materialService.findById(MATERIAL_ID)).thenReturn(material);
        when(inventoryService.findByWarehouse(any())).thenReturn(List.of());
        when(grnService.getOrCreateForOrder(any(), any(), any())).thenReturn(UUID.randomUUID());

        ReceivingService service = new ReceivingService(
                orderService,
                orderStatusService,
                orderItemRepository,
                inventoryService,
                materialService,
                warehouseService,
                putawayTaskService,
                qualityCheckService,
                grnService,
                taskService,
                operationEventService,
                new HandlingUnitCapacityService());
        return new Fixture(service, warehouseId);
    }

    private record Fixture(ReceivingService service, UUID warehouseId) {}
}
