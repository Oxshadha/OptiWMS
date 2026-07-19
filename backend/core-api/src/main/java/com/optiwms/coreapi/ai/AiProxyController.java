package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceRequest;
import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceResponse;
import com.optiwms.coreapi.ai.dto.AiInferenceAlertsResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiProxyController {

    private final AiProxyService service;
    private final ForecastResultReadService forecastResultReadService;
    private final ForecastJobService forecastJobService;

    public AiProxyController(AiProxyService service, ForecastResultReadService forecastResultReadService,
            ForecastJobService forecastJobService) {
        this.service = service;
        this.forecastResultReadService = forecastResultReadService;
        this.forecastJobService = forecastJobService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return service.health();
    }

    @GetMapping("/health/runtime-contract")
    public ResponseEntity<Object> runtimeContractHealth(
            @RequestParam(required = false) Boolean force
    ) {
        return service.getRuntimeContractHealth(force);
    }

    @GetMapping("/forecasts")
    public ResponseEntity<Object> forecasts(
            Authentication authentication,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false, name = "run_id") Integer runId,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "100") Integer size
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        if (forecastResultReadService.hasRows(sku, horizon, model, scopedWarehouse)) {
            return forecastResultReadService.getForecasts(sku, horizon, dataset, model, runId, scopedWarehouse, page, size);
        }
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
        if (forecastResultReadService.hasCanonicalForecasts()) {
            return forecastResultReadService.getForecastMetrics(split, horizon, dataset, model, scopedWarehouse);
        }
        return service.getForecastMetrics(split, horizon, dataset, model, scopedWarehouse);
    }

    @GetMapping("/forecast-skus")
    public ResponseEntity<Object> forecastSkus(
            Authentication authentication,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId
    ) {
        return forecastResultReadService.getForecastSkus(
                model, service.resolveWarehouseScope(authentication, warehouseId));
    }

    @GetMapping("/forecast-history")
    public ResponseEntity<Object> forecastHistory(Authentication authentication,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "100") Integer size) {
        return forecastResultReadService.getDemandHistory(
                sku, service.resolveWarehouseScope(authentication, warehouseId), page, size);
    }

    @GetMapping("/forecast-backtests")
    public ResponseEntity<Object> forecastBacktests(Authentication authentication,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "100") Integer size) {
        return forecastResultReadService.getBacktests(
                sku, model, service.resolveWarehouseScope(authentication, warehouseId), page, size);
    }

    @GetMapping("/forecast-interval-calibration")
    public ResponseEntity<Object> forecastIntervalCalibration(Authentication authentication,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId) {
        return forecastResultReadService.getIntervalCalibration(
                model, service.resolveWarehouseScope(authentication, warehouseId));
    }

    @GetMapping("/generation-provenance")
    public ResponseEntity<Object> generationProvenance() {
        return forecastResultReadService.getGenerationProvenance();
    }

    @PostMapping("/forecast-models/{model}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Object> approveForecastModel(
            Authentication authentication, @PathVariable String model) {
        return forecastResultReadService.approveModel(model, authentication.getName());
    }

    @GetMapping("/forecast-run-summary")
    public ResponseEntity<Object> runSummary(
            Authentication authentication,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false, name = "run_id") Integer runId,
            @RequestParam(required = false) String warehouseId
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return service.getForecastRunSummary(dataset, model, runId, scopedWarehouse);
    }

    @GetMapping("/forecast-dashboard-summary")
    public ResponseEntity<Object> dashboardSummary(
            Authentication authentication,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false, name = "run_id") Integer runId,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(required = false, name = "top_n") Integer topN
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        if (forecastResultReadService.hasRows(sku, horizon, model, scopedWarehouse)) {
            return forecastResultReadService.getDashboardSummary(dataset, model, runId, scopedWarehouse, sku, horizon, topN);
        }
        return service.getDashboardSummary(dataset, model, runId, scopedWarehouse, sku, horizon, topN);
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
        if (forecastResultReadService.hasCanonicalForecasts()) {
            return forecastResultReadService.getInventoryRecommendations(sku, model, scopedWarehouse);
        }
        return service.getInventoryRecommendations(sku, dataset, model, runId, scopedWarehouse);
    }

    @GetMapping("/raw-material-requirements")
    public ResponseEntity<Object> rawMaterialRequirements(
            Authentication authentication,
            @RequestParam(required = false, name = "run_id") Integer runId,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false, name = "rm_sku") String rmSku
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        if (forecastResultReadService.hasCanonicalForecasts()) {
            return forecastResultReadService.getRawMaterialRequirements(rmSku, model, scopedWarehouse);
        }
        return service.getRawMaterialRequirements(runId, dataset, model, scopedWarehouse, rmSku);
    }

    @GetMapping("/bom-mappings")
    public ResponseEntity<Object> bomMappings(
            @RequestParam(required = false, name = "fg_sku") String fgSku,
            @RequestParam(required = false, name = "rm_sku") String rmSku,
            @RequestParam(required = false, defaultValue = "true", name = "active_only") Boolean activeOnly
    ) {
        return service.getBomMappings(fgSku, rmSku, activeOnly);
    }

    @PutMapping("/bom-mappings")
    public ResponseEntity<Object> upsertBomMappings(@RequestBody Map<String, Object> payload) {
        return service.putBomMappings(payload);
    }

    @PostMapping("/jobs/forecast-run")
    public ResponseEntity<Object> trigger(
            Authentication authentication,
            @RequestParam(defaultValue = "PROJECT_OPERATIONAL_BASELINE_RM_PM") String dataset,
            @RequestParam(defaultValue = "EXTRA_TREES_RESPONSIVE") String modelName,
            @RequestParam(defaultValue = "online") String mode,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(defaultValue = "false", name = "critical_override") boolean criticalOverride
    ) {
        String scopedWarehouse = service.resolveWarehouseScope(authentication, warehouseId);
        return forecastJobService.queue(authentication, dataset, modelName, mode, scopedWarehouse, criticalOverride);
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Object> getForecastJob(@PathVariable java.util.UUID jobId) {
        return forecastJobService.get(jobId);
    }

    @GetMapping("/runs/{runId}/jobs")
    public ResponseEntity<Object> getRunJobs(@PathVariable("runId") Integer runId) {
        return service.getRunJobs(runId);
    }

    @GetMapping("/gateway/models")
    public ResponseEntity<Object> gatewayModels() {
        if (forecastResultReadService.hasCanonicalForecasts()) {
            return forecastResultReadService.getGatewayModels();
        }
        return service.getGatewayModels();
    }

    @GetMapping("/artifacts")
    public ResponseEntity<Object> artifacts(
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false) String model
    ) {
        return service.getArtifacts(dataset, model);
    }

    @GetMapping("/artifacts/inference-audit")
    public ResponseEntity<Object> inferenceAudit(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false, name = "model_name") String modelName
    ) {
        return service.getInferenceAudit(limit, dataset, modelName);
    }

    @GetMapping("/artifacts/inference-alerts")
    public ResponseEntity<AiInferenceAlertsResponse> inferenceAlerts(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false, name = "model_name") String modelName
    ) {
        return service.getInferenceAlerts(limit, dataset, modelName);
    }

    @GetMapping("/artifacts/acceptance-gate")
    public ResponseEntity<Object> acceptanceGate(
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false, name = "model_name") String modelName,
            @RequestParam(required = false, defaultValue = "test") String split,
            @RequestParam(required = false, name = "inference_window") Integer inferenceWindow
    ) {
        return service.getAcceptanceGate(dataset, modelName, split, inferenceWindow);
    }

    @GetMapping("/artifacts/production-readiness")
    public ResponseEntity<Object> productionReadiness(
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false, name = "model_name") String modelName,
            @RequestParam(required = false, defaultValue = "test") String split,
            @RequestParam(required = false, name = "inference_window") Integer inferenceWindow,
            @RequestParam(required = false, name = "soak_hours") Integer soakHours
    ) {
        return service.getProductionReadiness(dataset, modelName, split, inferenceWindow, soakHours);
    }

    @GetMapping("/artifacts/release-evidence")
    public ResponseEntity<Object> releaseEvidence(
            @RequestParam(required = false) String dataset,
            @RequestParam(required = false, name = "model_name") String modelName,
            @RequestParam(required = false, defaultValue = "test") String split,
            @RequestParam(required = false, name = "inference_window") Integer inferenceWindow,
            @RequestParam(required = false, name = "soak_hours") Integer soakHours,
            @RequestParam(required = false, name = "history_limit") Integer historyLimit
    ) {
        return service.getReleaseEvidence(dataset, modelName, split, inferenceWindow, soakHours, historyLimit);
    }

    @GetMapping("/artifacts/operational-health")
    public ResponseEntity<Object> operationalHealth() {
        return service.getOperationalHealth();
    }

    @GetMapping("/artifacts/operational-health/history")
    public ResponseEntity<Object> operationalHealthHistory(
            @RequestParam(required = false) Integer limit
    ) {
        return service.getOperationalHealthHistory(limit);
    }

    @PostMapping("/artifacts/operational-health/refresh")
    public ResponseEntity<Object> refreshOperationalHealth() {
        return service.refreshOperationalHealth();
    }

    @GetMapping("/artifacts/governance/status")
    public ResponseEntity<Object> governanceStatus() {
        return service.getGovernanceStatus();
    }

    @PostMapping("/artifacts/governance/tick")
    public ResponseEntity<Object> governanceTick() {
        return service.runGovernanceTick();
    }

    @PostMapping("/artifacts/infer-classical")
    public ResponseEntity<Object> inferClassical(@RequestBody Map<String, Object> payload) {
        return service.postForecastService("/artifacts/infer-classical", payload);
    }

    @PostMapping("/artifacts/infer-boosting")
    public ResponseEntity<Object> inferBoosting(@RequestBody Map<String, Object> payload) {
        return service.postForecastService("/artifacts/infer-boosting", payload);
    }

    @PostMapping("/artifacts/infer-boosting-online")
    public ResponseEntity<AiBoostingOnlineInferenceResponse> inferBoostingOnline(
            @Valid @RequestBody AiBoostingOnlineInferenceRequest payload
    ) {
        return service.inferBoostingOnline(payload);
    }
}
