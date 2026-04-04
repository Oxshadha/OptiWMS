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
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;

@Service
public class AiProxyService {

    private final RestTemplate restTemplate;
    private final UserRepository userRepository;

    @Value("${ai.services.forecast-base-url:http://localhost:8091}")
    private String forecastBaseUrl;

    @Value("${ai.services.orchestrator-base-url:http://localhost:8092}")
    private String orchestratorBaseUrl;

    @Value("${ai.services.auth-token:}")
    private String authToken;

    @Value("${ai.monitoring.trigger-block-on-critical:true}")
    private boolean blockTriggerOnCritical;

    @Value("${ai.monitoring.trigger-guard-window:200}")
    private int triggerGuardWindow;

    @Value("${ai.monitoring.allow-critical-override:false}")
    private boolean allowCriticalOverride;

    @Value("${ai.monitoring.trigger-fail-open-on-guard-error:false}")
    private boolean triggerFailOpenOnGuardError;

    public AiProxyService(RestTemplate restTemplate, UserRepository userRepository) {
        this.restTemplate = restTemplate;
        this.userRepository = userRepository;
    }

    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("forecast", getSimple(forecastBaseUrl + "/health"));
        out.put("orchestrator", getSimple(orchestratorBaseUrl + "/health"));
        return out;
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

    public ResponseEntity<Object> getInventoryRecommendations(String sku, String dataset, String model, Integer runId, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/inventory-recommendations");
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        if (warehouseId != null && !warehouseId.isBlank()) ub.queryParam("warehouse_id", warehouseId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> triggerForecastRun(String dataset, String modelName, String warehouseId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(orchestratorBaseUrl + "/jobs/forecast-run")
                .queryParam("dataset", dataset)
                .queryParam("model_name", modelName);
        if (warehouseId != null && !warehouseId.isBlank()) {
            ub.queryParam("warehouse_id", warehouseId);
        }

        HttpEntity<String> request = new HttpEntity<>(headers());
        ResponseEntity<Map> response = restTemplate.exchange(ub.toUriString(), HttpMethod.POST, request, Map.class);
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }

    public ResponseEntity<Object> triggerForecastRunWithGuard(
            Authentication authentication,
            String dataset,
            String modelName,
            String warehouseId,
            boolean criticalOverrideRequested
    ) {
        if (!blockTriggerOnCritical) {
            return triggerForecastRun(dataset, modelName, warehouseId);
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
                return triggerForecastRun(dataset, modelName, warehouseId);
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

            return triggerForecastRun(dataset, modelName, warehouseId);
        } catch (Exception ex) {
            if (triggerFailOpenOnGuardError) {
                return triggerForecastRun(dataset, modelName, warehouseId);
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
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
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
