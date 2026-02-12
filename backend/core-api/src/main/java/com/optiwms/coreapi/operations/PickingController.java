package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.PickingService;
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
@RequestMapping("/api/operations/picking")
public class PickingController {

    private final PickingService pickingService;

    public PickingController(PickingService pickingService) {
        this.pickingService = pickingService;
    }

    @PostMapping("/complete/{taskId}")
    public ResponseEntity<PickingResponse> completePicking(
            @PathVariable UUID taskId,
            @Valid @RequestBody CompletePickingRequest request) {
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
    }

    public record CompletePickingRequest(
            @NotEmpty List<@Valid PickedItemDto> items,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String workerId
    ) {}

    public record PickedItemDto(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String materialId,
            @NotBlank @Pattern(regexp = "^\\d+(\\.\\d+)?$") String quantity,
            String locationCode
    ) {}

    public record PickingResponse(boolean success, String message, String taskId) {}
}
