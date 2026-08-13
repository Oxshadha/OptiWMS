package com.optiwms.coreapi.assistant;

import com.optiwms.coreapi.ai.AiProxyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/v1/assistant/tools")
public class AssistantToolController {
    private static final Logger log = LoggerFactory.getLogger(AssistantToolController.class);
    private final AssistantToolService tools;
    private final AiProxyService aiProxyService;

    public AssistantToolController(AssistantToolService tools, AiProxyService aiProxyService) {
        this.tools = tools;
        this.aiProxyService = aiProxyService;
    }

    @GetMapping("/sku-outlook")
    public ResponseEntity<Map<String, Object>> skuOutlook(Authentication auth,
            @RequestParam(required = false, name = "warehouse") String requestedWarehouse,
            @RequestParam String sku, @RequestParam(defaultValue = "12") int horizon,
            @RequestHeader(value = "X-Correlation-ID", required = false) String requestedCorrelation) {
        String correlation = correlation(requestedCorrelation);
        UUID warehouse = warehouse(auth, requestedWarehouse);
        audit("get_sku_outlook", auth, warehouse, "sku=" + sku + ";horizon=" + horizon, correlation);
        return response(tools.skuOutlook(warehouse, sku, Math.max(1, Math.min(horizon, 12)), correlation), correlation);
    }

    @GetMapping("/inventory-risks")
    public ResponseEntity<Map<String, Object>> inventoryRisks(Authentication auth,
            @RequestParam(required = false, name = "warehouse") String requestedWarehouse,
            @RequestParam(required = false) String severity, @RequestParam(defaultValue = "20") int limit,
            @RequestHeader(value = "X-Correlation-ID", required = false) String requestedCorrelation) {
        String correlation = correlation(requestedCorrelation);
        UUID warehouse = warehouse(auth, requestedWarehouse);
        audit("list_inventory_risks", auth, warehouse, "severity=" + severity + ";limit=" + limit, correlation);
        return response(tools.inventoryRisks(warehouse, severity, limit, correlation), correlation);
    }

    @GetMapping("/recommendations/{id}/explanation")
    public ResponseEntity<Map<String, Object>> explanation(Authentication auth, @PathVariable UUID id,
            @RequestParam(required = false, name = "warehouse") String requestedWarehouse,
            @RequestHeader(value = "X-Correlation-ID", required = false) String requestedCorrelation) {
        String correlation = correlation(requestedCorrelation);
        UUID warehouse = warehouse(auth, requestedWarehouse);
        audit("explain_recommendation", auth, warehouse, "recommendationId=" + id, correlation);
        return response(tools.recommendationExplanation(warehouse, id, correlation), correlation);
    }

    @GetMapping("/planning-cycles/{id}")
    public ResponseEntity<Map<String, Object>> planningCycle(Authentication auth, @PathVariable UUID id,
            @RequestParam(required = false, name = "warehouse") String requestedWarehouse,
            @RequestHeader(value = "X-Correlation-ID", required = false) String requestedCorrelation) {
        String correlation = correlation(requestedCorrelation);
        UUID warehouse = warehouse(auth, requestedWarehouse);
        audit("get_planning_cycle_status", auth, warehouse, "planningCycleId=" + id, correlation);
        return response(tools.planningCycleStatus(warehouse, id, correlation), correlation);
    }

    private UUID warehouse(Authentication auth, String requested) {
        String scoped = aiProxyService.resolveWarehouseScope(auth, requested);
        if (scoped == null || scoped.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "The signed-in user has no authorized warehouse assignment.");
        }
        try { return UUID.fromString(scoped); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid authorized warehouse scope."); }
    }

    private ResponseEntity<Map<String, Object>> response(Map<String, Object> body, String correlation) {
        int resultCount = 1;
        Object facts = body.get("facts");
        if (facts instanceof Map<?, ?> factMap && factMap.get("resultCount") instanceof Number count) {
            resultCount = count.intValue();
        } else if (body.get("warnings") instanceof java.util.List<?> warnings && !warnings.isEmpty()
                && facts instanceof Map<?, ?> factMap && factMap.size() <= 1) {
            resultCount = 0;
        }
        log.info("assistant_tool_result resultCount={} correlationId={}", resultCount, correlation);
        return ResponseEntity.ok().header("X-Correlation-ID", correlation).body(body);
    }

    private String correlation(String supplied) {
        return supplied == null || supplied.isBlank() ? UUID.randomUUID().toString() : supplied.trim();
    }

    private void audit(String tool, Authentication auth, UUID warehouse, String parameters, String correlation) {
        log.info("assistant_tool tool={} user={} warehouse={} params={} correlationId={}",
                tool, auth != null ? auth.getName() : "anonymous", warehouse, parameters, correlation);
    }
}
