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
                    order.getId().toString(),
                    order.getOrderNumber(),
                    order.getOrderType(),
                    order.getStatus(),
                    order.getWarehouseId().toString()
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

            var result = receivingService.receiveOrder(
                    request.orderNumber(), 
                    receivedItems,
                    request.notes(),
                    request.photos(),
                    request.warehouseId() != null ? UUID.fromString(request.warehouseId()) : null,
                    request.workerId() != null ? UUID.fromString(request.workerId()) : null
            );
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

    @PostMapping("/blind-receive")
    public ResponseEntity<ReceivingResponse> blindReceive(@RequestBody ReceiveOrderRequest request) {
        try {
            // Blind receive is same as regular receive but without order validation
            List<ReceivingService.ReceivedItem> receivedItems = request.items().stream()
                    .map(item -> new ReceivingService.ReceivedItem(
                            UUID.fromString(item.materialId()),
                            new BigDecimal(item.quantity()),
                            item.locationCode()
                    ))
                    .toList();

            var result = receivingService.blindReceive(
                    request.orderNumber(), 
                    receivedItems,
                    request.notes(),
                    request.photos(),
                    request.warehouseId() != null ? UUID.fromString(request.warehouseId()) : null,
                    request.workerId() != null ? UUID.fromString(request.workerId()) : null
            );
            return ResponseEntity.ok(new ReceivingResponse(
                    result.success(),
                    result.message(),
                    result.orderId() != null ? result.orderId().toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new ReceivingResponse(false, e.getMessage(), null));
        }
    }

    public record OrderDetailDto(
            String id,  // Changed to String to match frontend
            String orderNumber,
            String orderType,
            String status,
            String warehouseId  // Changed to String to match frontend
    ) {}

    public record ReceiveOrderRequest(
            String orderNumber,
            List<ReceivedItemDto> items,
            String notes,
            List<String> photos,
            String warehouseId,  // Worker's warehouse ID for blind receive
            String workerId      // Worker ID for tracking
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

