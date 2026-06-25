package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceRequest;
import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceResponse;
import com.optiwms.coreapi.ai.dto.AiInferenceAlertsResponse;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;

@Service
public class AiProxyService {

    private final RestTemplate restTemplate;
    private final UserRepository userRepository;

    @Value("${ai.services.forecast-base-url:http://localhost:8082}")
    private String forecastBaseUrl;

    @Value("${ai.services.orchestrator-base-url:http://localhost:8084}")
    private String orchestratorBaseUrl;

    @Value("${ai.services.slotting-base-url:http://localhost:8093}")
    private String slottingBaseUrl;

    @Value("${ai.services.auth-token:}")
    private String authToken;

    @Value("${ai.monitoring.trigger-block-on-critical:true}")
    private boolean blockTriggerOnCritical;

    @Value("${ai.monitoring.trigger-guard-window:200}")
    private int triggerGuardWindow;

    @Value("${ai.monitoring.allow-critical-override:false}")
    private boolean allowCriticalOverride;

    @Value("${ai.monitoring.trigger-fail-open-on-guard-error:true}")
    private boolean triggerFailOpenOnGuardError;

    public AiProxyService(RestTemplate restTemplate, UserRepository userRepository) {
        this.restTemplate = restTemplate;
        this.userRepository = userRepository;
    }

    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("forecast", getSimple(forecastBaseUrl + "/health"));
        out.put("forecast_runtime_contract", getSimple(forecastBaseUrl + "/health/runtime-contract"));
        out.put("orchestrator", getSimple(orchestratorBaseUrl + "/health"));
        out.put("slotting", getSimple(slottingBaseUrl + "/health"));
        return out;
    }

    public ResponseEntity<Object> getRuntimeContractHealth(Boolean force) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/health/runtime-contract");
        if (force != null) ub.queryParam("force", force);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getForecasts(String sku, Integer horizon, String dataset, String model, Integer runId, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/forecasts");
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (horizon != null) ub.queryParam("horizon", horizon);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getForecastMetrics(String split, Integer horizon, String dataset, String model, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/forecast-metrics");
        if (split != null && !split.isBlank()) ub.queryParam("split", split);
        if (horizon != null) ub.queryParam("horizon", horizon);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getForecastRunSummary(String dataset, String model, Integer runId, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/forecast-metrics/run-summary");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getDashboardSummary(
            String dataset,
            String model,
            Integer runId,
            String warehouseId,
            String sku,
            Integer horizon,
            Integer topN
    ) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/dashboard/summary");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (horizon != null) ub.queryParam("horizon", horizon);
        if (topN != null) ub.queryParam("top_n", topN);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getInventoryRecommendations(String sku, String dataset, String model, Integer runId, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/inventory-recommendations");
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getRawMaterialRequirements(Integer runId, String dataset, String model, String warehouseId, String rmSku) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/raw-material-requirements");
        if (runId != null) ub.queryParam("run_id", runId);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        if (rmSku != null && !rmSku.isBlank()) ub.queryParam("rm_sku", rmSku);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getBomMappings(String fgSku, String rmSku, Boolean activeOnly) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/bom-mappings");
        if (fgSku != null && !fgSku.isBlank()) ub.queryParam("fg_sku", fgSku);
        if (rmSku != null && !rmSku.isBlank()) ub.queryParam("rm_sku", rmSku);
        if (activeOnly != null) ub.queryParam("active_only", activeOnly);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> putBomMappings(Object payload) {
        HttpEntity<Object> request = new HttpEntity<>(payload, headers());
        ResponseEntity<Map> response = restTemplate.exchange(forecastBaseUrl + "/bom-mappings", HttpMethod.PUT, request, Map.class);
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<Object> triggerForecastRun(String dataset, String modelName, String mode, String warehouseId) {
        ResponseEntity<Object> orchestratorResult = triggerForecastRunViaOrchestrator(dataset, modelName, mode, warehouseId);
        if (orchestratorResult.getStatusCode().is2xxSuccessful()) {
            return orchestratorResult;
        }
        return triggerForecastRunViaForecastService(dataset, modelName, mode, warehouseId, orchestratorResult);
    }

    private ResponseEntity<Object> triggerForecastRunViaOrchestrator(String dataset, String modelName, String mode, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(orchestratorBaseUrl + "/jobs/forecast-run")
                .queryParam("dataset", dataset)
                .queryParam("model_name", modelName)
                ;
        if (mode != null && !mode.isBlank()) ub.queryParam("mode", mode);
        if (warehouseId != null && !warehouseId.isBlank()) {
            ub.queryParam("warehouse_id", warehouseId);
        }

        HttpEntity<String> request = new HttpEntity<>(headers());
        try {
            ResponseEntity<Map> response = restTemplate.exchange(ub.toUriString(), HttpMethod.POST, request, Map.class);
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        } catch (ResourceAccessException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "ok", false,
                    "reason", "orchestrator_timeout",
                    "message", "Forecast trigger timed out while waiting for orchestrator.",
                    "orchestrator_url", ub.toUriString(),
                    "error", ex.getMessage()
            ));
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
                    "ok", false,
                    "reason", "orchestrator_http_error",
                    "message", "Orchestrator returned an HTTP error.",
                    "orchestrator_url", ub.toUriString(),
                    "status", ex.getStatusCode().value(),
                    "error", ex.getResponseBodyAsString()
            ));
        }
    }

    private ResponseEntity<Object> triggerForecastRunViaForecastService(
            String dataset,
            String modelName,
            String mode,
            String warehouseId,
            ResponseEntity<Object> orchestratorFailure
    ) {
        String publishMode = (mode == null || mode.isBlank()) ? "online" : mode;
        Map<String, Object> createBody = new HashMap<>();
        createBody.put("dataset", dataset);
        createBody.put("model_name", modelName);
        createBody.put("model_version", "v1");
        if (warehouseId != null && !warehouseId.isBlank()) {
            createBody.put("warehouse_id", warehouseId);
        }

        try {
            HttpEntity<Map<String, Object>> createRequest = new HttpEntity<>(createBody, headers());
            ResponseEntity<Map> createResponse = restTemplate.exchange(
                    forecastBaseUrl + "/runs",
                    HttpMethod.POST,
                    createRequest,
                    Map.class
            );
            Map<?, ?> createPayload = createResponse.getBody();
            if (createPayload == null || createPayload.get("id") == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                        "ok", false,
                        "reason", "forecast_create_failed",
                        "message", "Forecast service did not return a run id.",
                        "orchestrator_failure", orchestratorFailure.getBody()
                ));
            }

            Number runId = (Number) createPayload.get("id");
            UriComponentsBuilder publishUrl = UriComponentsBuilder
                    .fromHttpUrl(forecastBaseUrl + "/runs/" + runId.longValue() + "/publish")
                    .queryParam("mode", publishMode)
                    .queryParam("async_run", "true");

            HttpEntity<String> publishRequest = new HttpEntity<>(headers());
            ResponseEntity<Map> publishResponse = restTemplate.exchange(
                    publishUrl.toUriString(),
                    HttpMethod.POST,
                    publishRequest,
                    Map.class
            );

            Map<String, Object> body = new HashMap<>();
            body.put("ok", true);
            body.put("job", "forecast-run");
            body.put("run_id", runId.longValue());
            body.put("status", publishResponse.getBody() != null
                    ? publishResponse.getBody().getOrDefault("status", "publishing")
                    : "publishing");
            body.put("mode_requested", publishMode);
            body.put("fallback", "forecast_service_direct");
            body.put("orchestrator_failure", orchestratorFailure.getBody());
            body.put("publish_result", publishResponse.getBody());
            return ResponseEntity.status(publishResponse.getStatusCode()).body(body);
        } catch (ResourceAccessException ex) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of(
                    "ok", false,
                    "reason", "forecast_timeout",
                    "message", "Forecast trigger failed: orchestrator unavailable and direct forecast-service call timed out.",
                    "orchestrator_failure", orchestratorFailure.getBody(),
                    "error", ex.getMessage()
            ));
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
                    "ok", false,
                    "reason", "forecast_http_error",
                    "message", "Forecast trigger failed: orchestrator unavailable and direct forecast-service call failed.",
                    "orchestrator_failure", orchestratorFailure.getBody(),
                    "status", ex.getStatusCode().value(),
                    "error", ex.getResponseBodyAsString()
            ));
        }
    }

    public ResponseEntity<Object> getGatewayModels() {
        return exchangeGetSafe(forecastBaseUrl + "/gateway/models", "forecast");
    }

    public ResponseEntity<Object> triggerForecastRunWithGuard(
            Authentication authentication,
            String dataset,
            String modelName,
            String mode,
            String warehouseId,
            boolean criticalOverrideRequested
    ) {
        if (!blockTriggerOnCritical) {
            return triggerForecastRun(dataset, modelName, mode, warehouseId);
        }

        try {
            ResponseEntity<AiInferenceAlertsResponse> alertsResponse = getInferenceAlerts(
                    triggerGuardWindow,
                    dataset,
                    modelName
            );
            AiInferenceAlertsResponse alerts = alertsResponse.getBody();
            String status = alerts == null || alerts.status() == null ? "unknown" : alerts.status().toLowerCase();
            boolean isCritical = "critical".equals(status);
            if (!isCritical) {
                return triggerForecastRun(dataset, modelName, mode, warehouseId);
            }

            boolean adminLike = isAdminLike(authentication);
            boolean overrideAllowed = criticalOverrideRequested && allowCriticalOverride && adminLike;
            if (!overrideAllowed) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "ok", false,
                        "blocked", true,
                        "reason", "inference_health_critical",
                        "message", "Forecast trigger blocked because inference health is CRITICAL.",
                        "status", status,
                        "override_allowed", allowCriticalOverride && adminLike
                ));
            }

            return triggerForecastRun(dataset, modelName, mode, warehouseId);
        } catch (Exception ex) {
            if (triggerFailOpenOnGuardError) {
                return triggerForecastRun(dataset, modelName, mode, warehouseId);
            }
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "ok", false,
                    "blocked", true,
                    "reason", "inference_guard_unavailable",
                    "message", "Forecast trigger blocked because inference guard check failed.",
                    "error", ex.getMessage()
            ));
        }
    }

    // Backwards-compatible overload for callers/tests that pass the older five-arg signature
    public ResponseEntity<Object> triggerForecastRunWithGuard(
            Authentication authentication,
            String dataset,
            String modelName,
            String warehouseId,
            boolean criticalOverrideRequested
    ) {
        return triggerForecastRunWithGuard(authentication, dataset, modelName, null, warehouseId, criticalOverrideRequested);
    }

    public ResponseEntity<Object> getArtifacts(String dataset, String model) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> postForecastService(String path, Object payload) {
        HttpEntity<Object> request = new HttpEntity<>(payload, headers());
        ResponseEntity<Map> response = restTemplate.exchange(forecastBaseUrl + path, HttpMethod.POST, request, Map.class);
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<AiBoostingOnlineInferenceResponse> inferBoostingOnline(AiBoostingOnlineInferenceRequest payload) {
        HttpEntity<AiBoostingOnlineInferenceRequest> request = new HttpEntity<>(payload, headers());
        ResponseEntity<AiBoostingOnlineInferenceResponse> response = restTemplate.exchange(
                forecastBaseUrl + "/artifacts/infer-boosting-online",
                HttpMethod.POST,
                request,
                AiBoostingOnlineInferenceResponse.class
        );
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<Object> getInferenceAudit(Integer limit, String dataset, String modelName) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/inference-audit");
        if (limit != null) ub.queryParam("limit", limit);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (modelName != null && !modelName.isBlank()) ub.queryParam("model_name", modelName);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<AiInferenceAlertsResponse> getInferenceAlerts(Integer limit, String dataset, String modelName) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/inference-alerts");
        if (limit != null) ub.queryParam("limit", limit);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (modelName != null && !modelName.isBlank()) ub.queryParam("model_name", modelName);

        HttpEntity<String> request = new HttpEntity<>(headers());
        ResponseEntity<AiInferenceAlertsResponse> response = restTemplate.exchange(
                ub.toUriString(),
                HttpMethod.GET,
                request,
                AiInferenceAlertsResponse.class
        );
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<Object> getAcceptanceGate(String dataset, String modelName, String split, Integer inferenceWindow) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/acceptance-gate");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (modelName != null && !modelName.isBlank()) ub.queryParam("model_name", modelName);
        if (split != null && !split.isBlank()) ub.queryParam("split", split);
        if (inferenceWindow != null) ub.queryParam("inference_window", inferenceWindow);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getProductionReadiness(
            String dataset,
            String modelName,
            String split,
            Integer inferenceWindow,
            Integer soakHours
    ) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/production-readiness");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (modelName != null && !modelName.isBlank()) ub.queryParam("model_name", modelName);
        if (split != null && !split.isBlank()) ub.queryParam("split", split);
        if (inferenceWindow != null) ub.queryParam("inference_window", inferenceWindow);
        if (soakHours != null) ub.queryParam("soak_hours", soakHours);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getReleaseEvidence(
            String dataset,
            String modelName,
            String split,
            Integer inferenceWindow,
            Integer soakHours,
            Integer historyLimit
    ) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/release-evidence");
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (modelName != null && !modelName.isBlank()) ub.queryParam("model_name", modelName);
        if (split != null && !split.isBlank()) ub.queryParam("split", split);
        if (inferenceWindow != null) ub.queryParam("inference_window", inferenceWindow);
        if (soakHours != null) ub.queryParam("soak_hours", soakHours);
        if (historyLimit != null) ub.queryParam("history_limit", historyLimit);
        return exchangeGetSafe(ub.toUriString(), "forecast");
    }

    public ResponseEntity<Object> getOperationalHealth() {
        return exchangeGet(forecastBaseUrl + "/artifacts/operational-health");
    }

    public ResponseEntity<Object> getOperationalHealthHistory(Integer limit) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/artifacts/operational-health/history");
        if (limit != null) ub.queryParam("limit", limit);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> refreshOperationalHealth() {
        HttpEntity<String> request = new HttpEntity<>(headers());
        ResponseEntity<Map> response = restTemplate.exchange(
                forecastBaseUrl + "/artifacts/operational-health/refresh",
                HttpMethod.POST,
                request,
                Map.class
        );
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<Object> getGovernanceStatus() {
        return exchangeGetSafe(forecastBaseUrl + "/artifacts/governance/status", "forecast");
    }

    public ResponseEntity<Object> runGovernanceTick() {
        return exchangePostSafe(forecastBaseUrl + "/artifacts/governance/tick", null, "forecast");
    }

    public String resolveWarehouseScope(Authentication authentication, String requestedWarehouseId) {
        UserEntity user = resolveUser(authentication);
        if (user == null) {
            return requestedWarehouseId;
        }

        if (isAdminLike(authentication)) {
            return requestedWarehouseId;
        }

        return user.getWarehouseId() != null ? user.getWarehouseId().toString() : null;
    }

    private UserEntity resolveUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return userRepository.findByUsername(authentication.getName())
                .or(() -> userRepository.findByEmail(authentication.getName()))
                .orElse(null);
    }

    private boolean isAdminLike(Authentication authentication) {
        UserEntity user = resolveUser(authentication);
        if (user == null || user.getRole() == null) {
            return false;
        }
        String role = user.getRole().toLowerCase();
        return role.contains("admin") || role.contains("supervisor");
    }

    private ResponseEntity<Object> exchangeGet(String url) {
        HttpEntity<String> request = new HttpEntity<>(headers());
        ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, request, byte[].class);
        return ResponseEntity.status(response.getStatusCode())
                .headers(response.getHeaders())
                .body(response.getBody());
    }

    private ResponseEntity<Object> exchangeGetSafe(String url, String upstream) {
        try {
            return exchangeGet(url);
        } catch (ResourceAccessException ex) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_timeout",
                    "message", "Upstream service timed out.",
                    "url", url,
                    "error", ex.getMessage()
            ));
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_http_error",
                    "message", "Upstream service returned HTTP error.",
                    "url", url,
                    "status", ex.getStatusCode().value(),
                    "error", ex.getResponseBodyAsString()
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_proxy_error",
                    "message", "Unexpected error while proxying upstream response.",
                    "url", url,
                    "error", ex.getMessage()
            ));
        }
    }

    private ResponseEntity<Object> exchangePostSafe(String url, Object payload, String upstream) {
        try {
            HttpEntity<Object> request = new HttpEntity<>(payload, headers());
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, request, Map.class);
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        } catch (ResourceAccessException ex) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_timeout",
                    "message", "Upstream service timed out.",
                    "url", url,
                    "error", ex.getMessage()
            ));
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_http_error",
                    "message", "Upstream service returned HTTP error.",
                    "url", url,
                    "status", ex.getStatusCode().value(),
                    "error", ex.getResponseBodyAsString()
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "ok", false,
                    "reason", upstream + "_proxy_error",
                    "message", "Unexpected error while proxying upstream response.",
                    "url", url,
                    "error", ex.getMessage()
            ));
        }
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (authToken != null && !authToken.isBlank()) {
            headers.setBearerAuth(authToken);
        }
        return headers;
    }

    private Map<String, Object> getSimple(String url) {
        try {
            HttpEntity<String> request = new HttpEntity<>(headers());
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
            Map<String, Object> m = new HashMap<>();
            m.put("ok", response.getStatusCode().is2xxSuccessful());
            m.put("status", response.getStatusCode().value());
            m.put("body", response.getBody());
            return m;
        } catch (Exception ex) {
            Map<String, Object> m = new HashMap<>();
            m.put("ok", false);
            m.put("error", ex.getMessage());
            return m;
        }
    }
}
