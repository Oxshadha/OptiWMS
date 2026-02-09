package com.optiwms.coreapi.monitoring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/monitoring")
public class MonitoringLogController {

    private static final Logger log = LoggerFactory.getLogger(MonitoringLogController.class);
    private static final List<String> ALLOWED_LEVELS = List.of("error", "warn", "info");

    @PostMapping("/logs")
    public ResponseEntity<Map<String, Object>> ingestLog(@RequestBody MonitoringLogRequest request) {
        if (request == null || request.level() == null || request.message() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "level and message are required"
            ));
        }

        String normalizedLevel = request.level().trim().toLowerCase();
        if (!ALLOWED_LEVELS.contains(normalizedLevel)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "invalid log level"
            ));
        }

        String sanitizedMessage = sanitize(request.message());
        String metadata = String.format(
                "ts=%s, clientTs=%s, url=%s, userAgent=%s, context=%s, args=%s",
                OffsetDateTime.now(),
                sanitize(request.timestamp()),
                sanitize(request.url()),
                sanitize(request.userAgent()),
                sanitize(request.context()),
                sanitize(request.args())
        );

        switch (normalizedLevel) {
            case "error" -> log.error("[ClientLog] {} | {}", sanitizedMessage, metadata);
            case "warn" -> log.warn("[ClientLog] {} | {}", sanitizedMessage, metadata);
            default -> log.info("[ClientLog] {} | {}", sanitizedMessage, metadata);
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "receivedAt", OffsetDateTime.now().toString()
        ));
    }

    private String sanitize(Object value) {
        if (value == null) return "null";
        String text = String.valueOf(value);
        if (text.length() > 1000) {
            return text.substring(0, 1000) + "...";
        }
        return text.replaceAll("[\\r\\n]+", " ");
    }

    public record MonitoringLogRequest(
            String level,
            String message,
            String timestamp,
            String url,
            String userAgent,
            String context,
            String args
    ) {}
}

