package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.PutawayService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/operations/putaway")
public class PutawayController {

    private final PutawayService putawayService;

    public PutawayController(PutawayService putawayService) {
        this.putawayService = putawayService;
    }

    @PostMapping("/complete/{taskId}")
    public ResponseEntity<PutawayResponse> completePutaway(
            @PathVariable @NonNull UUID taskId,
            @RequestBody CompletePutawayRequest request) {
        try {
            var result = putawayService.completePutaway(taskId, request.locationCode(), request.lpn());
            return ResponseEntity.ok(new PutawayResponse(
                    result.success(),
                    result.message(),
                    result.taskId().toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new PutawayResponse(false, e.getMessage(), null));
        }
    }

    public record CompletePutawayRequest(String locationCode, String lpn) {}
    public record PutawayResponse(boolean success, String message, String taskId) {}
}

