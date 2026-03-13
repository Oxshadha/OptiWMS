package com.optiwms.coreapi.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiProxyController {

    private final AiProxyService service;

    public AiProxyController(AiProxyService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return service.health();
    }

    @GetMapping("/forecasts")
    public ResponseEntity<Object> forecasts(
            Authentication authentication,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false, name = "run_id") Integer runId
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return service.getForecasts(sku, horizon, dataset, model, runId, scopedWarehouse);
    }

    @GetMapping("/forecast-metrics")
    public ResponseEntity<Object> metrics(
            Authentication authentication,
            @RequestParam(required = false) String split,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return service.getForecastMetrics(split, horizon, dataset, model, scopedWarehouse);
    }

    @GetMapping("/inventory-recommendations")
    public ResponseEntity<Object> inventory(
            Authentication authentication,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false, name = "run_id") Integer runId
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return service.getInventoryRecommendations(sku, dataset, model, runId, scopedWarehouse);
    }

    @PostMapping("/jobs/forecast-run")
    public ResponseEntity<Object> trigger(
            Authentication authentication,
            @RequestParam(defaultValue = "B") String dataset,
            @RequestParam(defaultValue = "CATBOOST") String modelName,
            @RequestParam(required = false) String warehouseId
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return service.triggerForecastRun(dataset, modelName, scopedWarehouse);
    }
}
