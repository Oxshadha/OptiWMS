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

            var result = pickingService.completePicking(taskId, pickedItems);
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

    public record CompletePickingRequest(List<PickedItemDto> items) {}
    public record PickedItemDto(String materialId, String quantity, String locationCode) {}
    public record PickingResponse(boolean success, String message, String taskId) {}
}

