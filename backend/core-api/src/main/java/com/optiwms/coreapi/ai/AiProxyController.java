package com.optiwms.coreapi.ai;

import org.springframework.http.ResponseEntity;
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
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false, name = "run_id") Integer runId
    ) {
        return service.getForecasts(sku, horizon, dataset, model, runId);
    }

    @GetMapping("/forecast-metrics")
    public ResponseEntity<Object> metrics(
            @RequestParam(required = false) String split,
            @RequestParam(required = false) Integer horizon
    ) {
        return service.getForecastMetrics(split, horizon);
    }

    @GetMapping("/inventory-recommendations")
    public ResponseEntity<Object> inventory(
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false, name = "run_id") Integer runId
    ) {
        return service.getInventoryRecommendations(sku, dataset, model, runId);
    }

    @PostMapping("/jobs/forecast-run")
    public ResponseEntity<Object> trigger(
            @RequestParam(defaultValue = "B") String dataset,
            @RequestParam(defaultValue = "CATBOOST") String modelName
    ) {
        return service.triggerForecastRun(dataset, modelName);
    }
}
