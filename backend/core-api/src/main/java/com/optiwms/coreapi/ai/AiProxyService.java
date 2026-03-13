package com.optiwms.coreapi.ai;

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

    @Value("${ai.services.forecast-base-url:http://localhost:8091}")
    private String forecastBaseUrl;

    @Value("${ai.services.orchestrator-base-url:http://localhost:8092}")
    private String orchestratorBaseUrl;

    @Value("${ai.services.auth-token:}")
    private String authToken;

    public AiProxyService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("forecast", getSimple(forecastBaseUrl + "/health"));
        out.put("orchestrator", getSimple(orchestratorBaseUrl + "/health"));
        return out;
    }

    public ResponseEntity<Object> getForecasts(String sku, Integer horizon, String dataset, String model, Integer runId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/forecasts");
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (horizon != null) ub.queryParam("horizon", horizon);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getForecastMetrics(String split, Integer horizon) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/forecast-metrics");
        if (split != null && !split.isBlank()) ub.queryParam("split", split);
        if (horizon != null) ub.queryParam("horizon", horizon);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> getInventoryRecommendations(String sku, String dataset, String model, Integer runId) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(forecastBaseUrl + "/inventory-recommendations");
        if (sku != null && !sku.isBlank()) ub.queryParam("sku", sku);
        if (dataset != null && !dataset.isBlank()) ub.queryParam("dataset", dataset);
        if (model != null && !model.isBlank()) ub.queryParam("model", model);
        if (runId != null) ub.queryParam("run_id", runId);
        return exchangeGet(ub.toUriString());
    }

    public ResponseEntity<Object> triggerForecastRun(String dataset, String modelName) {
        UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(orchestratorBaseUrl + "/jobs/forecast-run")
                .queryParam("dataset", dataset)
                .queryParam("model_name", modelName);

        HttpEntity<String> request = new HttpEntity<>(headers());
        ResponseEntity<Map> response = restTemplate.exchange(ub.toUriString(), HttpMethod.POST, request, Map.class);
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
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
