package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.PickingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operations/picking")
public class PickingController {

    private final PickingService pickingService;

    public PickingController(PickingService pickingService) {
        this.pickingService = pickingService;
    }

    @PostMapping("/complete/{taskId}")
    public ResponseEntity<PickingResponse> completePicking(
            @PathVariable UUID taskId,
            @RequestBody CompletePickingRequest request) {
        try {
            List<PickingService.PickedItem> pickedItems = request.items().stream()
                    .map(item -> new PickingService.PickedItem(
                            UUID.fromString(item.materialId()),
                            new BigDecimal(item.quantity()),
                            item.locationCode()
                    ))
                    .toList();

            UUID workerId = request.workerId() != null ? UUID.fromString(request.workerId()) : null;
            var result = pickingService.completePicking(taskId, pickedItems, workerId);
            return ResponseEntity.ok(new PickingResponse(
                    result.success(),
                    result.message(),
                    result.taskId().toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new PickingResponse(false, e.getMessage(), null));
        }
    }

    @PostMapping("/issue/{taskId}")
    public ResponseEntity<PickingIssueResponse> reportPickingIssue(
            @PathVariable UUID taskId,
            @RequestBody PickingIssueRequest request) {
        try {
            UUID materialId = UUID.fromString(request.materialId());
            UUID workerId = request.workerId() != null ? UUID.fromString(request.workerId()) : null;
            var result = pickingService.reportPickingIssue(
                    taskId,
                    materialId,
                    request.locationCode(),
                    request.requestedQuantity() != null ? new BigDecimal(request.requestedQuantity()) : BigDecimal.ZERO,
                    request.availableQuantity() != null ? new BigDecimal(request.availableQuantity()) : BigDecimal.ZERO,
                    request.reason(),
                    workerId
            );

            return ResponseEntity.ok(new PickingIssueResponse(
                    result.success(),
                    result.message(),
                    result.anomalyId() != null ? result.anomalyId().toString() : null,
                    result.taskId() != null ? result.taskId().toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new PickingIssueResponse(false, e.getMessage(), null, null));
        }
    }

    public record CompletePickingRequest(List<PickedItemDto> items, String workerId) {}
    public record PickedItemDto(String materialId, String quantity, String locationCode) {}
    public record PickingResponse(boolean success, String message, String taskId) {}
    public record PickingIssueRequest(
            String materialId,
            String locationCode,
            String requestedQuantity,
            String availableQuantity,
            String reason,
            String workerId
    ) {}
    public record PickingIssueResponse(boolean success, String message, String anomalyId, String taskId) {}
}
