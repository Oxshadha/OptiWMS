package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.LocationSuggestionService;
import com.optiwms.coreapp.operations.PutawayService;
import com.optiwms.coreapp.operations.PutawayCapacityPlanningService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operations/putaway")
public class PutawayController {

        private final PutawayService putawayService;
        private final LocationSuggestionService locationSuggestionService;
        private final PutawayCapacityPlanningService putawayCapacityPlanningService;

        public PutawayController(
                        PutawayService putawayService,
                        LocationSuggestionService locationSuggestionService,
                        PutawayCapacityPlanningService putawayCapacityPlanningService) {
                this.putawayService = putawayService;
                this.locationSuggestionService = locationSuggestionService;
                this.putawayCapacityPlanningService = putawayCapacityPlanningService;
        }

        @PostMapping("/complete/{taskId}")
        public ResponseEntity<PutawayResponse> completePutaway(
                        @PathVariable UUID taskId,
                        @RequestBody CompletePutawayRequest request) {
                try {
                        var result = putawayService.completePutaway(
                                        taskId,
                                        request.locationCode(),
                                        request.lpn(),
                                        request.quantity(),
                                        request.materialId() != null ? UUID.fromString(request.materialId()) : null,
                                        request.workerId() != null ? UUID.fromString(request.workerId()) : null);
                        return ResponseEntity.ok(new PutawayResponse(
                                        result.success(),
                                        result.message(),
                                        result.taskId().toString()));
                } catch (RuntimeException e) {
                        return ResponseEntity.badRequest()
                                        .body(new PutawayResponse(false, e.getMessage(), null));
                }
        }

        @PostMapping("/skip/{taskId}")
        public ResponseEntity<PutawayResponse> skipPutaway(
                        @PathVariable UUID taskId,
                        @RequestBody SkipPutawayRequest request) {
                try {
                        var result = putawayService.skipPutawayItem(
                                        taskId,
                                        request.reason(),
                                        request.workerId() != null ? UUID.fromString(request.workerId()) : null);
                        return ResponseEntity.ok(new PutawayResponse(
                                        result.success(),
                                        result.message(),
                                        result.taskId().toString()));
                } catch (RuntimeException e) {
                        return ResponseEntity.badRequest()
                                        .body(new PutawayResponse(false, e.getMessage(), null));
                }
        }

        @PostMapping("/suggest-location")
        public ResponseEntity<LocationSuggestionResponse> suggestLocation(
                        @RequestBody SuggestLocationRequest request) {
                try {
                        var suggestion = locationSuggestionService.suggestPutawayLocation(
                                        UUID.fromString(request.warehouseId()),
                                        UUID.fromString(request.materialId()),
                                        request.quantity(),
                                        request.materialType());

                        return ResponseEntity.ok(new LocationSuggestionResponse(
                                        suggestion.getLocationCode(),
                                        suggestion.getReason(),
                                        suggestion.isAiEnhanced()));
                } catch (RuntimeException e) {
                        return ResponseEntity.badRequest()
                                        .body(new LocationSuggestionResponse(null, e.getMessage(), false));
                }
        }

        @PostMapping("/split-plan")
        public ResponseEntity<?> splitPlan(@RequestBody SplitPlanRequest request) {
                try {
                        if (request == null
                                        || request.warehouseId() == null || request.warehouseId().isBlank()
                                        || request.materialId() == null || request.materialId().isBlank()) {
                                throw new IllegalArgumentException("warehouseId and materialId are required");
                        }
                        var result = putawayCapacityPlanningService.suggestSplitPlan(
                                        UUID.fromString(request.warehouseId()),
                                        UUID.fromString(request.materialId()),
                                        request.quantity(),
                                        request.preferredLocationCode());
                        return ResponseEntity.ok(result);
                } catch (IllegalArgumentException e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false, e.getMessage(), null));
                } catch (RuntimeException e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false, e.getMessage(), null));
                } catch (Exception e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false,
                                        "Capacity planning failed: " + e.getMessage(), null));
                }
        }

        @PostMapping("/split-plan/batch")
        public ResponseEntity<?> splitPlanBatch(@RequestBody BatchSplitPlanRequest request) {
                try {
                        if (request == null
                                        || request.warehouseId() == null || request.warehouseId().isBlank()) {
                                throw new IllegalArgumentException("warehouseId is required");
                        }
                        List<PutawayCapacityPlanningService.SplitPlanRequest> items = request.items() != null
                                        ? request.items().stream()
                                                        .map(item -> new PutawayCapacityPlanningService.SplitPlanRequest(
                                                                        item.itemIndex(),
                                                                        item.materialId() != null && !item.materialId().isBlank()
                                                                                        ? UUID.fromString(item.materialId())
                                                                                        : null,
                                                                        item.quantity(),
                                                                        item.preferredLocationCode()))
                                                        .toList()
                                        : List.of();
                        var result = putawayCapacityPlanningService.suggestBatchSplitPlan(
                                        UUID.fromString(request.warehouseId()),
                                        items);
                        return ResponseEntity.ok(result);
                } catch (IllegalArgumentException e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false, e.getMessage(), null));
                } catch (RuntimeException e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false, e.getMessage(), null));
                } catch (Exception e) {
                        return ResponseEntity.badRequest().body(new PutawayResponse(false,
                                        "Batch capacity planning failed: " + e.getMessage(), null));
                }
        }

        public record CompletePutawayRequest(
                        String locationCode,
                        String lpn,
                        Integer quantity,
                        String materialId,
                        String workerId) {
        }

        public record SkipPutawayRequest(String reason, String workerId) {
        }

        public record PutawayResponse(boolean success, String message, String taskId) {
        }

        public record SuggestLocationRequest(
                        String warehouseId,
                        String materialId,
                        Integer quantity,
                        String materialType) {
        }

        public record SplitPlanRequest(
                        String warehouseId,
                        String materialId,
                        Integer quantity,
                        String preferredLocationCode) {
        }

        public record BatchSplitPlanRequest(
                        String warehouseId,
                        List<BatchSplitPlanItemRequest> items) {
        }

        public record BatchSplitPlanItemRequest(
                        Integer itemIndex,
                        String materialId,
                        Integer quantity,
                        String preferredLocationCode) {
        }

        public record LocationSuggestionResponse(
                        String suggestedLocation,
                        String reason,
                        boolean aiEnhanced) {
        }
}
