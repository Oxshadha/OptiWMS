package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.ReceivingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operations/receiving")
public class ReceivingController {

    private final ReceivingService receivingService;

    public ReceivingController(ReceivingService receivingService) {
        this.receivingService = receivingService;
    }

    @GetMapping("/order/{orderNumber}")
    public ResponseEntity<OrderDetailDto> getOrderByNumber(@PathVariable String orderNumber) {
        try {
            var order = receivingService.getOrderByNumber(orderNumber);
            return ResponseEntity.ok(new OrderDetailDto(
                    order.getId(),
                    order.getOrderNumber(),
                    order.getOrderType(),
                    order.getStatus(),
                    order.getWarehouseId()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/receive")
    public ResponseEntity<ReceivingResponse> receiveOrder(@RequestBody ReceiveOrderRequest request) {
        try {
            List<ReceivingService.ReceivedItem> receivedItems = request.items().stream()
                    .map(item -> new ReceivingService.ReceivedItem(
                            UUID.fromString(item.materialId()),
                            new BigDecimal(item.quantity()),
                            item.locationCode()
                    ))
                    .toList();

            var result = receivingService.receiveOrder(request.orderNumber(), receivedItems);
            return ResponseEntity.ok(new ReceivingResponse(
                    result.success(),
                    result.message(),
                    result.orderId().toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new ReceivingResponse(false, e.getMessage(), null));
        }
    }

    public record OrderDetailDto(
            UUID id,
            String orderNumber,
            String orderType,
            String status,
            UUID warehouseId
    ) {}

    public record ReceiveOrderRequest(
            String orderNumber,
            List<ReceivedItemDto> items
    ) {}

    public record ReceivedItemDto(
            String materialId,
            String quantity,
            String locationCode
    ) {}

    public record ReceivingResponse(
            boolean success,
            String message,
            String orderId
    ) {}
}

