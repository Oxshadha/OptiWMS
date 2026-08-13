package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceRequest;
import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceResponse;
import com.optiwms.coreapi.ai.dto.AiInferenceAlertsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AiProxyControllerTest {

    private MockMvc mockMvc;

    private AiProxyController aiProxyController;

    private AiProxyService aiProxyService;

    private ForecastResultReadService forecastResultReadService;
    private ForecastJobService forecastJobService;

    @BeforeEach
    void setUp() {
        aiProxyService = org.mockito.Mockito.mock(AiProxyService.class);
        forecastResultReadService = org.mockito.Mockito.mock(ForecastResultReadService.class);
        forecastJobService = org.mockito.Mockito.mock(ForecastJobService.class);
        aiProxyController = new AiProxyController(aiProxyService, forecastResultReadService, forecastJobService);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(aiProxyController)
                .setValidator(validator)
                .build();
    }

    @Test
    void forecasts_shouldPreferWmsForecastResultsWhenRowsExist() throws Exception {
        when(aiProxyService.resolveWarehouseScope(null, "1")).thenReturn("1");
        when(forecastResultReadService.hasRows("RM-001", 1, "LIGHTGBM", "1")).thenReturn(true);
        when(forecastResultReadService.getForecasts("RM-001", 1, "P", "LIGHTGBM", null, "1", 0, 100))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "source", "wms_forecast_results",
                        "model_used", "V7_RM_PM_DIRECT",
                        "count", 1
                )));

        mockMvc.perform(get("/api/ai/forecasts?sku=RM-001&horizon=1&dataset=P&model=LIGHTGBM&warehouseId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("wms_forecast_results"))
                .andExpect(jsonPath("$.model_used").value("V7_RM_PM_DIRECT"))
                .andExpect(jsonPath("$.count").value(1));

        verify(forecastResultReadService).getForecasts("RM-001", 1, "P", "LIGHTGBM", null, "1", 0, 100);
    }

    @Test
    void forecasts_shouldNotFallBackToPythonWhenCanonicalRowsMissing() throws Exception {
        when(aiProxyService.resolveWarehouseScope(null, "1")).thenReturn("1");
        when(forecastResultReadService.getForecasts("FG-001", 1, "P", "LIGHTGBM", null, "1", 0, 100))
                .thenReturn(ResponseEntity.ok(Map.of("source", "wms_forecast_results", "count", 0,
                        "items", List.of())));

        mockMvc.perform(get("/api/ai/forecasts?sku=FG-001&horizon=1&dataset=P&model=LIGHTGBM&warehouseId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("wms_forecast_results"))
                .andExpect(jsonPath("$.count").value(0));

        verify(forecastResultReadService).getForecasts("FG-001", 1, "P", "LIGHTGBM", null, "1", 0, 100);
    }

    @Test
    void gatewayModels_shouldExposeWmsChampionWhenCanonicalRowsExist() throws Exception {
        when(forecastResultReadService.hasCanonicalForecasts()).thenReturn(true);
        when(forecastResultReadService.getGatewayModels())
                .thenReturn(ResponseEntity.ok(Map.of(
                        "champion", Map.of("name", "V7_RM_PM_DIRECT", "source", "wms_forecast_results"),
                        "available_models", List.of()
                )));

        mockMvc.perform(get("/api/ai/gateway/models"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.champion.name").value("V7_RM_PM_DIRECT"))
                .andExpect(jsonPath("$.champion.source").value("wms_forecast_results"));
    }

    @Test
    void inferBoostingOnline_shouldProxyValidRequest() throws Exception {
        AiBoostingOnlineInferenceResponse response = new AiBoostingOnlineInferenceResponse(
                "A",
                "XGBOOST",
                1,
                "production",
                1,
                List.of(new AiBoostingOnlineInferenceResponse.Item("sku_001", "FG001", "Soap", 123.45, 1, false, null, null)),
                List.of(),
                false,
                null,
                0,
                Map.of("model_version", "v1")
        );

        when(aiProxyService.inferBoostingOnline(any(AiBoostingOnlineInferenceRequest.class)))
                .thenReturn(ResponseEntity.ok(response));

        String payload = """
                {
                  "dataset": "A",
                  "model_name": "XGBOOST",
                  "horizon": 1,
                  "stage": "production",
                  "clip_negative": true,
                  "series": [
                    {
                      "series_id": "sku_001",
                      "fg_code": "FG001",
                      "fg_category": "Soap",
                      "history": [
                        { "month": "2025-01", "demand_units": 120.0 },
                        { "month": "2025-02", "demand_units": 130.0 }
                      ],
                      "static_features": { "warehouse_id": "W1" }
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/ai/artifacts/infer-boosting-online")
                        .contentType(APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataset").value("A"))
                .andExpect(jsonPath("$.model_name").value("XGBOOST"))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.items[0].series_id").value("sku_001"))
                .andExpect(jsonPath("$.items[0].prediction").value(123.45))
                .andExpect(jsonPath("$.fallback_used").value(false))
                .andExpect(jsonPath("$.fallback_count").value(0));

        verify(aiProxyService).inferBoostingOnline(any(AiBoostingOnlineInferenceRequest.class));
    }

    @Test
    void inferBoostingOnline_shouldRejectInvalidPayload() throws Exception {
        String invalidPayload = """
                {
                  "dataset": "A",
                  "model_name": "XGBOOST",
                  "horizon": 13,
                  "series": [
                    {
                      "series_id": "sku_001",
                      "fg_code": "FG001",
                      "history": [
                        { "month": "2025-01" }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/ai/artifacts/infer-boosting-online")
                        .contentType(APPLICATION_JSON)
                        .content(invalidPayload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void inferenceAlerts_shouldReturnTypedResponse() throws Exception {
        AiInferenceAlertsResponse response = new AiInferenceAlertsResponse(
                "warn",
                new AiInferenceAlertsResponse.Summary(10, 0.2, 0, 120.0, 510.0),
                List.of(new AiInferenceAlertsResponse.RuleTriggered("p95_latency_ms", "warn", 500.0, 510.0, "P95 latency above threshold.")),
                200,
                "A",
                "XGBOOST"
        );
        when(aiProxyService.getInferenceAlerts(200, "A", "XGBOOST")).thenReturn(ResponseEntity.ok(response));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/ai/artifacts/inference-alerts?limit=200&dataset=A&model_name=XGBOOST"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("warn"))
                .andExpect(jsonPath("$.summary.fallback_rate").value(0.2))
                .andExpect(jsonPath("$.rules_triggered[0].rule").value("p95_latency_ms"));
    }

    @Test
    void acceptanceGate_shouldProxyResponse() throws Exception {
        when(aiProxyService.getAcceptanceGate("A", "XGBOOST", "test", 500))
                .thenReturn(ResponseEntity.ok(Map.of("ready", true)));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/ai/artifacts/acceptance-gate?dataset=A&model_name=XGBOOST&split=test&inference_window=500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ready").value(true));

        verify(aiProxyService).getAcceptanceGate(eq("A"), eq("XGBOOST"), eq("test"), eq(500));
    }
}
