package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.LocationSuggestionService;
import com.optiwms.coreapp.operations.PutawayService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/operations/putaway")
public class PutawayController {

    private final PutawayService putawayService;
    private final LocationSuggestionService locationSuggestionService;

    public PutawayController(
            PutawayService putawayService,
            LocationSuggestionService locationSuggestionService) {
        this.putawayService = putawayService;
        this.locationSuggestionService = locationSuggestionService;
    }

    @PostMapping("/complete/{taskId}")
    public ResponseEntity<PutawayResponse> completePutaway(
            @PathVariable UUID taskId,
            @Valid @RequestBody CompletePutawayRequest request) {
        var result = putawayService.completePutaway(
                taskId,
                request.locationCode(),
                request.lpn(),
                request.quantity(),
                request.materialId() != null ? UUID.fromString(request.materialId()) : null
        );
        return ResponseEntity.ok(new PutawayResponse(
                result.success(),
                result.message(),
                result.taskId().toString()
        ));
    }

    @PostMapping("/suggest-location")
    public ResponseEntity<LocationSuggestionResponse> suggestLocation(
            @Valid @RequestBody SuggestLocationRequest request) {
        var suggestion = locationSuggestionService.suggestPutawayLocation(
                UUID.fromString(request.warehouseId()),
                UUID.fromString(request.materialId()),
                request.quantity(),
                request.materialType()
        );

        return ResponseEntity.ok(new LocationSuggestionResponse(
                suggestion.getLocationCode(),
                suggestion.getReason(),
                suggestion.isAiEnhanced()
        ));
    }

    public record CompletePutawayRequest(
            @NotBlank String locationCode,
            String lpn,
            @NotNull Integer quantity,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String materialId) {}
    public record PutawayResponse(boolean success, String message, String taskId) {}
    
    public record SuggestLocationRequest(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String materialId,
            @NotNull Integer quantity,
            String materialType) {}
    
    public record LocationSuggestionResponse(
            String suggestedLocation,
            String reason,
            boolean aiEnhanced) {}
}
