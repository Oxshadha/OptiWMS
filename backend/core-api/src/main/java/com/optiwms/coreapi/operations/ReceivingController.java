package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.ReceivingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
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
        var order = receivingService.getOrderByNumber(orderNumber);
        return ResponseEntity.ok(new OrderDetailDto(
                order.getId().toString(),
                order.getOrderNumber(),
                order.getOrderType(),
                order.getStatus(),
                order.getWarehouseId().toString()
        ));
    }

    @PostMapping("/receive")
    public ResponseEntity<ReceivingResponse> receiveOrder(@Valid @RequestBody ReceiveOrderRequest request) {
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
    }

    @PostMapping("/blind-receive")
    public ResponseEntity<ReceivingResponse> blindReceive(@Valid @RequestBody ReceiveOrderRequest request) {
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
    }

    public record OrderDetailDto(
            String id,  // Changed to String to match frontend
            String orderNumber,
            String orderType,
            String status,
            String warehouseId  // Changed to String to match frontend
    ) {}

    public record ReceiveOrderRequest(
            @NotBlank String orderNumber,
            @NotEmpty List<@Valid ReceivedItemDto> items,
            String notes,
            List<String> photos,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,  // Worker's warehouse ID for blind receive
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String workerId      // Worker ID for tracking
    ) {}

    public record ReceivedItemDto(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String materialId,
            @NotBlank @Pattern(regexp = "^\\d+(\\.\\d+)?$") String quantity,
            String locationCode
    ) {}

    public record ReceivingResponse(
            boolean success,
            String message,
            String orderId
    ) {}
}
