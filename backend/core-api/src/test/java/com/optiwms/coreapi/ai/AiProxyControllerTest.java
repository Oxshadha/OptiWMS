package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceRequest;
import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AiProxyControllerTest {

    private MockMvc mockMvc;

    private AiProxyController aiProxyController;

    private AiProxyService aiProxyService;

    @BeforeEach
    void setUp() {
        aiProxyService = org.mockito.Mockito.mock(AiProxyService.class);
        aiProxyController = new AiProxyController(aiProxyService);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(aiProxyController)
                .setValidator(validator)
                .build();
    }

    @Test
    void inferBoostingOnline_shouldProxyValidRequest() throws Exception {
        AiBoostingOnlineInferenceResponse response = new AiBoostingOnlineInferenceResponse(
                "A",
                "XGBOOST",
                1,
                "production",
                1,
                List.of(new AiBoostingOnlineInferenceResponse.Item("sku_001", "FG001", "Soap", 123.45, 1)),
                List.of(),
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
                .andExpect(jsonPath("$.items[0].prediction").value(123.45));

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
}
