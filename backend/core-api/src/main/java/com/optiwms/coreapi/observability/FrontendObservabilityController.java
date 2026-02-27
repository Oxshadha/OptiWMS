package com.optiwms.coreapi.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/observability")
public class FrontendObservabilityController {

    private static final Logger log = LoggerFactory.getLogger(FrontendObservabilityController.class);

    @PostMapping("/frontend-events")
    public ResponseEntity<Map<String, Object>> ingestFrontendEvent(
            Authentication authentication,
            @RequestBody FrontendEventRequest request
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";

        String summary = String.format(
                "[FrontendEvent] level=%s actor=%s page=%s message=%s at=%s",
                safe(request.level()),
                actor,
                safe(request.page()),
                safe(request.message()),
                OffsetDateTime.now()
        );

        if ("error".equalsIgnoreCase(request.level())) {
            log.error(summary + " context={}", request.context());
        } else if ("warn".equalsIgnoreCase(request.level())) {
            log.warn(summary + " context={}", request.context());
        } else {
            log.info(summary + " context={}", request.context());
        }

        return ResponseEntity.ok(Map.of("success", true));
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record FrontendEventRequest(
            String level,
            String message,
            String page,
            Map<String, Object> context
    ) {}
}
